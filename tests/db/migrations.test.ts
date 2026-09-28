import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { buildSandboxDataset } from "@/server/sandbox/fixtures";
import { asUser, createDatabase } from "../support/pglite";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

let db: PGlite;
let orgA: string;
let orgB: string;

async function createOrg(userId: string, name: string): Promise<string> {
  return asUser(db, userId, async () => {
    const res = await db.query<{ id: string }>(`select public.sgk_create_organization($1, 'family') as id`, [name]);
    return res.rows[0]!.id;
  });
}

beforeAll(async () => {
  db = await createDatabase();
  await db.query(`insert into auth.users (id, email) values ($1, 'a@example.invalid'), ($2, 'b@example.invalid')`, [USER_A, USER_B]);
  orgA = await createOrg(USER_A, "Organization A");
  orgB = await createOrg(USER_B, "Organization B");
  const now = new Date("2026-09-28T15:00:00Z");
  for (const org of [orgA, orgB]) {
    await db.query(`select public.sgk_replace_sandbox($1, $2::jsonb)`, [org, JSON.stringify(buildSandboxDataset({ organizationId: org, seedDate: now }))]);
  }
}, 60_000);

describe("schema", () => {
  it("mirrors auth users and creates owner memberships", async () => {
    const members = await db.query<{ role: string }>(`select role from public.organization_members where organization_id = $1`, [orgA]);
    expect(members.rows).toEqual([{ role: "owner" }]);
    const settings = await db.query(`select production_execute_enabled from public.organization_settings where organization_id = $1`, [orgA]);
    expect(settings.rows).toEqual([{ production_execute_enabled: false }]);
  });

  it("loads the TypeScript sandbox dataset through sgk_replace_sandbox", async () => {
    const counts = await db.query<{ properties: number; documents: number; transactions: number }>(
      `select (select count(*)::int from properties where organization_id = $1) as properties,
              (select count(*)::int from documents where organization_id = $1) as documents,
              (select count(*)::int from account_transactions where organization_id = $1) as transactions`,
      [orgA],
    );
    expect(counts.rows[0]).toEqual({ properties: 3, documents: 22, transactions: 38 });
  });

  it("replacing the sandbox is idempotent and never touches production", async () => {
    await db.query(
      `insert into properties (organization_id, environment, reference, status, address_line1, city, region, postal_code, property_type)
       values ($1, 'production', 'SGK-2001', 'owned', '1 Real Street', 'Austin', 'TX', '78701', 'condo')`,
      [orgA],
    );
    await db.query(`select public.sgk_replace_sandbox($1, $2::jsonb)`, [orgA, JSON.stringify(buildSandboxDataset({ organizationId: orgA, seedDate: new Date() }))]);
    const res = await db.query<{ environment: string; n: number }>(
      `select environment::text, count(*)::int as n from properties where organization_id = $1 group by environment order by 1`,
      [orgA],
    );
    expect(res.rows).toEqual([{ environment: "production", n: 1 }, { environment: "sandbox", n: 3 }]);
  });

  it("rejects datasets that target production or another organization", async () => {
    const bad = buildSandboxDataset({ organizationId: orgA, seedDate: new Date() });
    bad.properties[0]!.environment = "production";
    await expect(db.query(`select public.sgk_replace_sandbox($1, $2::jsonb)`, [orgA, JSON.stringify(bad)])).rejects.toThrow(/sandbox dataset rows/);
  });
});

describe("environment and tenant isolation (composite foreign keys)", () => {
  it("prevents production rows from referencing sandbox rows", async () => {
    const sandboxProperty = await db.query<{ id: string }>(`select id from properties where organization_id = $1 and environment = 'sandbox' limit 1`, [orgA]);
    await expect(
      db.query(
        `insert into transactions (organization_id, environment, property_id, reference, status, current_stage, purchase_price_cents, down_payment_cents)
         values ($1, 'production', $2, 'TX-2026-9999', 'active', 'offer', 1, 1)`,
        [orgA, sandboxProperty.rows[0]!.id],
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it("prevents one organization from referencing another's rows", async () => {
    const propertyB = await db.query<{ id: string }>(`select id from properties where organization_id = $1 limit 1`, [orgB]);
    await expect(
      db.query(
        `insert into obligations (organization_id, environment, property_id, kind, payee, amount_cents, frequency, source, confidence, status)
         values ($1, 'sandbox', $2, 'hoa', 'X', 1, 'monthly', 'user', 'confirmed', 'active')`,
        [orgA, propertyB.rows[0]!.id],
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it("forbids simulated automation in production", async () => {
    await expect(
      db.query(`update autopilot_rules set environment = 'production' where organization_id = $1 and execution_mode = 'simulated'`, [orgA]),
    ).rejects.toThrow();
  });
});

describe("row level security", () => {
  it("members only see their own organization's rows", async () => {
    const seenByA = await asUser(db, USER_A, () => db.query<{ organization_id: string }>(`select distinct organization_id from properties`));
    expect(seenByA.rows).toEqual([{ organization_id: orgA }]);
    const seenByB = await asUser(db, USER_B, () => db.query<{ n: number }>(`select count(*)::int as n from properties where organization_id = $1`, [orgA]));
    expect(seenByB.rows[0]!.n).toBe(0);
    const orgs = await asUser(db, USER_B, () => db.query<{ id: string }>(`select id from organizations`));
    expect(orgs.rows).toEqual([{ id: orgB }]);
  });

  it("anonymous requests read nothing", async () => {
    await expect(asUser(db, null, () => db.query(`select * from properties`))).rejects.toThrow(/permission denied/);
  });

  it("browser roles cannot write, even to their own organization", async () => {
    await expect(
      asUser(db, USER_A, () =>
        db.query(`insert into organization_members (organization_id, user_id, role) values ($1, $2, 'owner')`, [orgB, USER_A]),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(asUser(db, USER_A, () => db.query(`update properties set status = 'sold' where organization_id = $1`, [orgA]))).rejects.toThrow(/permission denied/);
  });

  it("secret-bearing tables and columns are unreadable by browser roles", async () => {
    await expect(asUser(db, USER_A, () => db.query(`select * from mcp_credentials`))).rejects.toThrow(/permission denied/);
    await expect(asUser(db, USER_A, () => db.query(`select * from webhook_endpoint_secrets`))).rejects.toThrow(/permission denied/);
    await expect(asUser(db, USER_A, () => db.query(`select * from integration_credentials`))).rejects.toThrow(/permission denied/);
    await expect(asUser(db, USER_A, () => db.query(`select client_secret_hash from mcp_clients`))).rejects.toThrow(/permission denied/);
    const visible = await asUser(db, USER_A, () => db.query(`select id, client_name from mcp_clients`));
    expect(visible.rows).toEqual([]);
  });

  it("connections reject wildcard or unknown scopes", async () => {
    await db.query(`insert into mcp_clients (id, client_name, client_type, token_endpoint_auth_method, registration_source) values ('c1', 'Claude', 'claude', 'none', 'dynamic')`);
    const insert = (scopes: string[]) =>
      db.query(
        `insert into mcp_connections (organization_id, environment, user_id, client_id, name, client_type, auth_method, status, scopes, max_execution_class)
         values ($1, 'sandbox', $2, 'c1', 'Claude', 'claude', 'oauth', 'active', $3, 'read')`,
        [orgA, USER_A, scopes],
      );
    await expect(insert(["*"])).rejects.toThrow(/check constraint/);
    await expect(insert([])).rejects.toThrow(/check constraint/);
    await expect(insert(["property.read"])).resolves.toBeDefined();
    const seen = await asUser(db, USER_A, () => db.query(`select client_name from mcp_clients`));
    expect(seen.rows).toEqual([{ client_name: "Claude" }]);
  });
});

describe("audit log", () => {
  async function appendAudit(org: string, tool: string) {
    const res = await db.query<{ sequence: number; prev_hash: string; record_hash: string }>(
      `insert into mcp_audit_logs (id, organization_id, environment, client_name, client_type, request_id, source, tool_name, status, duration_ms, state_changed, summary, prev_hash, record_hash)
       values (gen_random_uuid(), $1, 'sandbox', 'Claude', 'claude', 'req', 'mcp', $2, 'success', 12, false, 'Claude used ' || $2, '', '')
       returning sequence::int, prev_hash, record_hash`,
      [org, tool],
    );
    return res.rows[0]!;
  }

  it("assigns sequences and chains hashes per organization", async () => {
    const a1 = await appendAudit(orgA, "get_closing_status");
    const a2 = await appendAudit(orgA, "identify_closing_blockers");
    const b1 = await appendAudit(orgB, "get_property");
    expect(a1.sequence).toBe(1);
    expect(a1.prev_hash).toBe("0".repeat(64));
    expect(a2.sequence).toBe(2);
    expect(a2.prev_hash).toBe(a1.record_hash);
    expect(b1.sequence).toBe(1);
    const verify = await db.query<{ broken: number | null }>(`select public.sgk_verify_audit_chain($1) as broken`, [orgA]);
    expect(verify.rows[0]!.broken).toBeNull();
  });

  it("is append-only, even for privileged roles", async () => {
    await expect(db.query(`update mcp_audit_logs set summary = 'edited'`)).rejects.toThrow(/append-only/);
    await expect(db.query(`delete from mcp_audit_logs`)).rejects.toThrow(/append-only/);
    await expect(db.query(`truncate mcp_audit_logs cascade`)).rejects.toThrow(/append-only/);
  });

  it("detects tampering when triggers are bypassed", async () => {
    await db.exec(`alter table mcp_audit_logs disable trigger mcp_audit_logs_no_update`);
    await db.query(`update mcp_audit_logs set tool_name = 'activate_property_autopilot' where organization_id = $1 and sequence = 1`, [orgA]);
    await db.exec(`alter table mcp_audit_logs enable trigger mcp_audit_logs_no_update`);
    const verify = await db.query<{ broken: number | null }>(`select public.sgk_verify_audit_chain($1) as broken`, [orgA]);
    expect(verify.rows[0]!.broken).toBe(1);
  });

  it("members can read their organization's audit trail only", async () => {
    const rows = await asUser(db, USER_B, () => db.query<{ organization_id: string }>(`select organization_id from mcp_audit_logs`));
    expect(rows.rows.every((r) => r.organization_id === orgB)).toBe(true);
  });
});

describe("rate limiting and statistics", () => {
  it("increments fixed-window counters atomically", async () => {
    const first = await db.query<{ c: number[] }>(`select public.sgk_increment_rate_counters(array['k1','k2'], 60) as c`);
    const second = await db.query<{ c: number[] }>(`select public.sgk_increment_rate_counters(array['k1'], 60) as c`);
    expect(first.rows[0]!.c).toEqual([1, 1]);
    expect(second.rows[0]!.c).toEqual([2]);
  });

  it("aggregates activity for dashboards", async () => {
    const res = await db.query<{ s: { total: number; byTool: unknown[] } }>(`select public.sgk_activity_stats($1, 'sandbox', now() - interval '1 day') as s`, [orgB]);
    expect(res.rows[0]!.s.total).toBe(1);
    expect(res.rows[0]!.s.byTool).toHaveLength(1);
  });
});

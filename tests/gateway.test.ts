import { describe, expect, it } from "vitest";
import { sha256Hex } from "@/server/crypto/hash";
import { decideApproval } from "@/server/gateway/approvals";
import { evaluatePolicy } from "@/server/gateway/policy";
import { resolveTool } from "@/server/tools/registry";
import { AUDIT_GENESIS_HASH, auditHashInput } from "@/server/store/memory";
import { createHarness, ORG_A, ORG_B, USER_A, USER_B, VIEWER_A } from "./support/harness";

type Data = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function checkingAccountId(h: ReturnType<typeof createHarness>, organizationId = ORG_A) {
  await h.ready;
  const accounts = await h.store.listAccounts({ organizationId, environment: "sandbox" });
  return accounts.find((a) => a.mask === "4821")!.id;
}

describe("policy engine", () => {
  const h = createHarness();
  const settings = { organization_id: ORG_A, production_execute_enabled: false, approval_ttl_minutes: 60, session_ttl_minutes: 60, rate_limit_per_minute: 120, loop_threshold: 5, max_transaction_amount_cents: null, updated_at: "" };
  const now = new Date("2026-09-28T15:00:00Z");

  it("allows READ with the right scope and records the reasoning", () => {
    const result = evaluatePolicy({ tool: resolveTool("get_closing_status")!, caller: h.caller({ scopes: ["closing.read"] }), settings, now });
    expect(result.decision).toBe("allowed");
    expect(result.reasons.map((r) => r.rule)).toContain("scopes");
  });

  it("denies missing scopes and names them", () => {
    const result = evaluatePolicy({ tool: resolveTool("verify_funds_readiness")!, caller: h.caller({ scopes: ["closing.read"] }), settings, now });
    expect(result.decision).toBe("denied");
    expect(result.missingScopes).toEqual(["finance.read"]);
    expect(result.code).toBe("insufficient_scope");
  });

  it("requires approval for EXECUTE even with every scope", () => {
    const result = evaluatePolicy({ tool: resolveTool("activate_property_autopilot")!, caller: h.caller(), settings, now });
    expect(result.decision).toBe("approval_required");
  });

  it("enforces role ceilings, connection ceilings and the production guard", () => {
    const tool = resolveTool("activate_property_autopilot")!;
    expect(evaluatePolicy({ tool, caller: h.caller({ role: "member" }), settings, now }).code).toBe("role_not_permitted");
    expect(evaluatePolicy({ tool, caller: h.caller({ maxClass: "prepare" }), settings, now }).code).toBe("execution_class_not_permitted");
    expect(evaluatePolicy({ tool, caller: h.caller({ environment: "production" }), settings, now }).code).toBe("production_execute_disabled");
    expect(evaluatePolicy({ tool, caller: h.caller({ environment: "production" }), settings: { ...settings, production_execute_enabled: true }, now }).decision).toBe("approval_required");
  });

  it("enforces transaction limits once the amount is known", () => {
    const tool = resolveTool("activate_property_autopilot")!;
    const result = evaluatePolicy({ tool, caller: h.caller({ transactionLimitCents: 100_000 }), settings, now, amountCents: 409_417 });
    expect(result.code).toBe("transaction_limit_exceeded");
  });
});

describe("KNOW → ANALYZE → SIMULATE → PREPARE → APPROVE → EXECUTE → AUDIT", () => {
  it("runs the full Autopilot workflow with a human approval gate", async () => {
    const h = createHarness();
    const { connection } = await h.connect();
    const claude = h.caller({ connectionId: connection.id });
    const account = await checkingAccountId(h);

    // PREPARE: ambiguous funding account → clarification, never a guess.
    const ambiguous = await h.call(claude, "prepare_property_autopilot", { property_id: "SGK-1017" });
    expect(ambiguous.status).toBe("needs_clarification");
    expect(ambiguous.clarification?.options?.length).toBe(2);

    const prepared = await h.call(claude, "prepare_property_autopilot", { property_id: "SGK-1017", funding_account_id: account });
    expect(prepared.status).toBe("success");
    expect(prepared.meta.state_changed).toBe(true);
    const planId = (prepared.data as Data).plan_id as string;

    // EXECUTE without approval → approval_required with a specific summary.
    const requested = await h.call(claude, "activate_property_autopilot", { plan_id: planId });
    expect(requested.status).toBe("approval_required");
    expect(requested.requires_approval).toBe(true);
    expect(requested.approval?.summary).toMatch(/^Claude is requesting permission to activate Sagolik Autopilot for Property #SGK-1017 \(1106 Juniper Street, Austin, TX\)/);
    expect(requested.meta.state_changed).toBe(false);
    const approvalId = requested.approval!.approval_id;

    // Repeating the request does not create a second approval.
    const again = await h.call(claude, "activate_property_autopilot", { plan_id: planId });
    expect(again.approval?.approval_id).toBe(approvalId);

    // Calling with the approval before the user decides → still pending.
    const early = await h.call(claude, "activate_property_autopilot", { plan_id: planId, approval_id: approvalId });
    expect(early.status).toBe("approval_required");

    // A viewer cannot approve EXECUTE actions; the owner can.
    const byViewer = await decideApproval(h.store, { organizationId: ORG_A, approvalId, userId: VIEWER_A, role: "viewer", decision: "approve", now: h.clock.now() });
    expect(byViewer.ok).toBe(false);
    const decided = await decideApproval(h.store, { organizationId: ORG_A, approvalId, userId: USER_A, role: "owner", decision: "approve", now: h.clock.now() });
    expect(decided.ok).toBe(true);

    // Different arguments cannot ride on the approval.
    const mismatch = await h.call(claude, "activate_property_autopilot", { plan_id: crypto.randomUUID(), approval_id: approvalId });
    expect(mismatch.error?.code).toBe("approval_mismatch");

    const executed = await h.call(claude, "activate_property_autopilot", { plan_id: planId, approval_id: approvalId });
    expect(executed.status).toBe("success");
    expect(executed.meta.state_changed).toBe(true);
    expect((executed.data as Data).funds_moved).toBe(false);
    expect((executed.data as Data).rules.some((r: Data) => r.execution_mode === "simulated")).toBe(true);

    // Single use: replay returns the original result without executing again.
    // (Advance past the per-tool EXECUTE rate limit of 5 calls per minute.)
    h.advance(61_000);
    const rulesBefore = (await h.store.listAutopilotRules({ organizationId: ORG_A, environment: "sandbox" }, {})).length;
    const replay = await h.call(claude, "activate_property_autopilot", { plan_id: planId, approval_id: approvalId });
    expect(replay.replayed).toBe(true);
    expect(replay.data).toEqual(executed.data);
    expect((await h.store.listAutopilotRules({ organizationId: ORG_A, environment: "sandbox" }, {})).length).toBe(rulesBefore);

    const approval = await h.store.getApproval(ORG_A, approvalId);
    expect(approval?.status).toBe("completed");

    // AUDIT: every step recorded, hash-chained, with approval context.
    const audit = await h.store.listAudit(ORG_A, { limit: 100 });
    expect(audit.length).toBe(8);
    const execRecord = audit.find((a) => a.id === executed.audit_id)!;
    expect(execRecord.approval_id).toBe(approvalId);
    expect(execRecord.state_changed).toBe(true);
    expect(execRecord.summary).toBe("Claude used activate_property_autopilot. Sandbox records changed. No production changes made.");
    const chain = [...audit].sort((a, b) => a.sequence - b.sequence);
    let prev = AUDIT_GENESIS_HASH;
    for (const record of chain) {
      expect(record.prev_hash).toBe(prev);
      const { record_hash, ...rest } = record;
      expect(sha256Hex(auditHashInput(rest))).toBe(record_hash);
      prev = record_hash;
    }

    await h.flush();
    expect(h.published.map((e) => e.type)).toEqual(expect.arrayContaining(["autopilot.action_required", "approval.requested", "approval.completed"]));
  });

  it("denied approvals cannot be executed", async () => {
    const h = createHarness();
    const { connection } = await h.connect();
    const claude = h.caller({ connectionId: connection.id });
    const prepared = await h.call(claude, "prepare_property_autopilot", { property_id: "SGK-1017", funding_account_id: await checkingAccountId(h) });
    const planId = (prepared.data as Data).plan_id;
    const requested = await h.call(claude, "activate_property_autopilot", { plan_id: planId });
    await decideApproval(h.store, { organizationId: ORG_A, approvalId: requested.approval!.approval_id, userId: USER_A, role: "owner", decision: "deny", now: h.clock.now() });
    const attempt = await h.call(claude, "activate_property_autopilot", { plan_id: planId, approval_id: requested.approval!.approval_id });
    expect(attempt.status).toBe("denied");
    expect(attempt.error?.code).toBe("approval_denied");
  });

  it("expired approvals cannot be executed", async () => {
    const h = createHarness();
    const { connection } = await h.connect();
    const claude = h.caller({ connectionId: connection.id });
    const prepared = await h.call(claude, "prepare_property_autopilot", { property_id: "SGK-1017", funding_account_id: await checkingAccountId(h) });
    const requested = await h.call(claude, "activate_property_autopilot", { plan_id: (prepared.data as Data).plan_id });
    h.advance(61 * 60_000);
    const decided = await decideApproval(h.store, { organizationId: ORG_A, approvalId: requested.approval!.approval_id, userId: USER_A, role: "owner", decision: "approve", now: h.clock.now() });
    expect(decided.ok).toBe(false);
    const status = await h.call(claude, "get_approval_status", { approval_id: requested.approval!.approval_id });
    expect((status.data as Data).status).toBe("expired");
  });

  it("approvals are bound to the requesting connection", async () => {
    const h = createHarness();
    const a = await h.connect({ name: "Claude" });
    const b = await h.connect({ name: "Cursor", clientType: "cursor" });
    const claude = h.caller({ connectionId: a.connection.id });
    const cursor = h.caller({ connectionId: b.connection.id });
    const prepared = await h.call(claude, "prepare_property_autopilot", { property_id: "SGK-1017", funding_account_id: await checkingAccountId(h) });
    const requested = await h.call(claude, "activate_property_autopilot", { plan_id: (prepared.data as Data).plan_id });
    await decideApproval(h.store, { organizationId: ORG_A, approvalId: requested.approval!.approval_id, userId: USER_A, role: "owner", decision: "approve", now: h.clock.now() });
    const hijack = await h.call(cursor, "activate_property_autopilot", { plan_id: (prepared.data as Data).plan_id, approval_id: requested.approval!.approval_id });
    expect(hijack.error?.code).toBe("approval_not_found");
  });
});

describe("safety controls", () => {
  it("returns needs_input with missing fields instead of guessing", async () => {
    const h = createHarness();
    const env = await h.call(h.caller(), "get_property", {});
    expect(env.status).toBe("needs_input");
    expect(env.missing_fields).toEqual(["property_id"]);
  });

  it("rejects unknown arguments rather than silently ignoring them", async () => {
    const h = createHarness();
    const env = await h.call(h.caller(), "get_property", { property_id: "SGK-1042", amount: 5 });
    expect(env.status).toBe("needs_input");
    expect(env.invalid_fields?.[0]?.message).toMatch(/Unknown field/);
  });

  it("never interprets free text as an identifier", async () => {
    const h = createHarness();
    const env = await h.call(h.caller(), "get_closing_status", { property_id: "245 Mercer" });
    expect(env.status).toBe("needs_clarification");
    expect(env.clarification?.options?.[0]?.value).toBe("SGK-1042");
  });

  it("denies tools outside the granted scopes and explains why", async () => {
    const h = createHarness();
    const env = await h.call(h.caller({ scopes: ["property.read"] }), "get_closing_status", { property_id: "SGK-1042" });
    expect(env.status).toBe("denied");
    expect(env.policy?.missing_scopes).toEqual(["closing.read"]);
    const audit = await h.store.getAudit(ORG_A, env.audit_id);
    expect(audit?.policy_decision).toBe("denied");
  });

  it("makes PREPARE calls idempotent and rejects key reuse with different arguments", async () => {
    const h = createHarness();
    const c = h.caller();
    const first = await h.call(c, "prepare_closing_checklist", { property_id: "SGK-1042", idempotency_key: "checklist-0001" });
    const second = await h.call(c, "prepare_closing_checklist", { property_id: "SGK-1042", idempotency_key: "checklist-0001" });
    expect(second.replayed).toBe(true);
    expect((second.data as Data).checklist_id).toBe((first.data as Data).checklist_id);
    const executions = await h.store.listExecutions(ORG_A);
    expect(executions.filter((e) => e.tool_name === "prepare_closing_checklist")).toHaveLength(1);
    const conflict = await h.call(c, "prepare_closing_checklist", { transaction_id: "TX-2026-0419", idempotency_key: "checklist-0001" });
    expect(conflict.error?.code).toBe("idempotency_conflict");
    // Without a key, identical calls are deduplicated automatically.
    const auto1 = await h.call(c, "prepare_document_request", { property_id: "SGK-1042", category: "hoa" });
    const auto2 = await h.call(c, "prepare_document_request", { property_id: "SGK-1042", category: "hoa" });
    expect((auto2.data as Data).request_id).toBe((auto1.data as Data).request_id);
  });

  it("detects agent loops of identical calls", async () => {
    const h = createHarness();
    const c = h.caller();
    const statuses: string[] = [];
    for (let i = 0; i < 7; i++) statuses.push((await h.call(c, "get_closing_status", { property_id: "SGK-1042" })).status);
    expect(statuses.slice(0, 5).every((s) => s === "success")).toBe(true);
    const blocked = await h.call(c, "get_closing_status", { property_id: "SGK-1042" });
    expect(blocked.error?.code).toBe("loop_detected");
    expect(blocked.error?.retryable).toBe(true);
  });

  it("isolates tenants: another organization's identifiers do not resolve", async () => {
    const h = createHarness();
    await h.ready;
    const orgBProperty = (await h.store.listProperties({ organizationId: ORG_B, environment: "sandbox" }))[0]!;
    const env = await h.call(h.caller(), "get_property", { property_id: orgBProperty.id });
    expect(env.status).toBe("needs_clarification");
    const own = await h.call(h.caller({ organizationId: ORG_B, userId: USER_B }), "get_property", { property_id: orgBProperty.id });
    expect(own.status).toBe("success");
  });

  it("isolates environments: sandbox records never appear in production", async () => {
    const h = createHarness();
    const env = await h.call(h.caller({ environment: "production" }), "search_properties", {});
    expect(env.status).toBe("success");
    expect((env.data as Data).count).toBe(0);
  });

  it("audits unknown tools as denied", async () => {
    const h = createHarness();
    const env = await h.call(h.caller(), "execute_sql", { query: "select 1" });
    expect(env.status).toBe("denied");
    expect(env.error?.code).toBe("unknown_tool");
    expect((await h.store.getAudit(ORG_A, env.audit_id))?.tool_name).toBe("execute_sql");
  });

  it("does not store raw arguments in the audit log", async () => {
    const h = createHarness();
    const env = await h.call(h.caller(), "analyze_property_purchase", { purchase_price: 750000, gross_monthly_income: 21000 });
    const record = await h.store.getAudit(ORG_A, env.audit_id);
    expect(JSON.stringify(record)).not.toContain("21000");
    expect(record?.arguments_hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

import type { McpConnectionRow } from "@/domain/entities";
import { DEFAULT_SCOPES, type Scope } from "@/domain/scopes";
import { callerForConnection } from "@/server/auth/bearer";
import { createConnection, type Clock } from "@/server/auth/connections";
import { callTool, type GatewayDeps } from "@/server/gateway/gateway";
import type { MemoryStore } from "@/server/store/memory";
import { seedOrganization } from "@/server/store/memory";
import { buildSandboxDataset } from "./fixtures";

export const DEMO_ORGANIZATION_ID = "5a901116-0000-4000-8000-00000000d3e0";
export const DEMO_USER_ID = "5a901116-0000-4000-8000-000000005e01";

/**
 * Demo mode (no database configured): one clearly-labelled demo workspace
 * with a synthetic sandbox. Its activity is produced by running a scripted
 * agent session through the real gateway — every audit record, approval and
 * plan below is the genuine output of the platform, not fabricated rows.
 * Production is empty in demo mode.
 */
export async function seedDemoWorkspace(store: MemoryStore, deps: GatewayDeps): Promise<void> {
  const now = deps.clock();
  seedOrganization(store, {
    organizationId: DEMO_ORGANIZATION_ID,
    name: "Demo Workspace",
    kind: "family",
    userId: DEMO_USER_ID,
    email: "operator@demo.sagolik.invalid",
    fullName: "Demo Operator",
    role: "owner",
    now,
  });
  await store.replaceSandboxData(DEMO_ORGANIZATION_ID, buildSandboxDataset({ organizationId: DEMO_ORGANIZATION_ID, seedDate: now }));
  // Keep the demo approval reviewable for a full day.
  await store.updateOrganizationSettings(DEMO_ORGANIZATION_ID, { approval_ttl_minutes: 1440 });

  // Replay the session over the last two hours so activity reads naturally.
  let t = now.getTime() - 118 * 60_000;
  const clock: Clock = { now: () => new Date(t), newId: deps.newId };
  const timeline: GatewayDeps = { ...deps, clock: () => new Date(t) };
  const step = (minutes: number) => {
    t += minutes * 60_000;
  };

  const claudeScopes: Scope[] = [...DEFAULT_SCOPES, "finance.read", "closing.prepare", "documents.prepare", "autopilot.prepare", "autopilot.execute"];
  const claude = await createConnection(store, clock, {
    organizationId: DEMO_ORGANIZATION_ID,
    environment: "sandbox",
    userId: DEMO_USER_ID,
    name: "Claude",
    clientType: "claude",
    authMethod: "oauth",
    scopes: claudeScopes,
    expiresAt: new Date(now.getTime() + 30 * 86_400_000).toISOString(),
    isDemo: true,
  });
  const cursor = await createConnection(store, clock, {
    organizationId: DEMO_ORGANIZATION_ID,
    environment: "sandbox",
    userId: DEMO_USER_ID,
    name: "Cursor",
    clientType: "cursor",
    authMethod: "token",
    scopes: ["property.read", "ownership.read", "autopilot.read"],
    expiresAt: new Date(now.getTime() + 7 * 86_400_000).toISOString(),
    isDemo: true,
  });
  await store.updateConnection(claude.id, { last_connected_at: new Date(t).toISOString() });

  const run = async (connection: McpConnectionRow, name: string, args: Record<string, unknown>, gap = 1) => {
    step(gap);
    const caller = await callerForConnection(store, connection, { sessionId: null, sessionExpiresAt: connection.expires_at, ip: null, userAgent: `${connection.name} (demo)` });
    if (!caller) throw new Error("Demo caller could not be built");
    return (await callTool(timeline, caller, { name, arguments: args })).envelope;
  };

  // "Use Sagolik to tell me what remains before this property can close."
  await run(claude, "get_authorization_context", {});
  await run(claude, "get_closing_status", {}, 1);
  await run(claude, "get_closing_status", { property_id: "SGK-1042" }, 1);
  await run(claude, "identify_closing_blockers", { property_id: "SGK-1042" }, 1);
  await run(claude, "verify_funds_readiness", { property_id: "SGK-1042" }, 2);
  await run(claude, "calculate_cash_to_close", { property_id: "SGK-1042" }, 6);
  await run(claude, "compare_financing_scenarios", {
    property_id: "SGK-1042",
    scenarios: [
      { label: "30-year fixed", down_payment_percent: 25, interest_rate_percent: 6.375, term_years: 30 },
      { label: "15-year fixed", down_payment_percent: 25, interest_rate_percent: 5.75, term_years: 15 },
    ],
  }, 3);

  // A read-only agent attempting something outside its grant.
  await run(cursor, "get_property", { property_id: "SGK-1017" }, 21);
  await run(cursor, "get_autopilot_status", { property_id: "SGK-1017" }, 1);
  await run(cursor, "verify_funds_readiness", { property_id: "SGK-1042" }, 1);

  // "Prepare autopilot for this property." — PREPARE, then EXECUTE awaiting approval.
  await run(claude, "inspect_property_obligations", { property_id: "SGK-1042" }, 38);
  await run(claude, "prepare_property_autopilot", { property_id: "SGK-1042" }, 1);
  const accounts = await store.listAccounts({ organizationId: DEMO_ORGANIZATION_ID, environment: "sandbox" });
  const checking = accounts.find((a) => a.mask === "4821");
  const prepared = await run(claude, "prepare_property_autopilot", { property_id: "SGK-1042", funding_account_id: checking?.id }, 3);
  const planId = (prepared.data as { plan_id?: string } | undefined)?.plan_id;
  if (planId) await run(claude, "activate_property_autopilot", { plan_id: planId }, 1);
  await run(claude, "prepare_document_request", { property_id: "SGK-1042", category: "hoa" }, 30);
}

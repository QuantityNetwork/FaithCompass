import { z } from "zod";
import { EXECUTION_CLASS_META } from "@/domain/execution-classes";
import { SCOPE_DEFINITIONS } from "@/domain/scopes";
import { PROVIDER_CATALOG } from "@/server/integrations/registry";
import { operational } from "./meta";
import { defineTool } from "./types";

/* ───────────────────────── get_authorization_context (Identity) ───────────────────────── */

export const getAuthorizationContext = defineTool({
  name: "get_authorization_context",
  title: "Get authorization context",
  version: "1.0.0",
  category: "identity",
  executionClass: "read",
  ...operational("read"),
  owner: "sagolik-platform",
  requiredScopes: [],
  approvalRequired: false,
  idempotency: "none",
  providers: [],
  description: {
    summary: "Describe exactly what this connection is authorized to do: organization, environment, granted scopes, maximum execution class, available and unavailable tools, and the approval policy.",
    whenToUse: [
      "At the start of a session, or before attempting an action, to understand your own authority.",
      "When a call was denied, to explain to the user which permission is missing.",
    ],
    whenNotToUse: ["To change permissions — only the user can grant scopes, in Sagolik."],
    requiredContext: ["None."],
    effect: "Read-only.",
    example: { request: "What are you allowed to do in Sagolik?", arguments: {} },
  },
  input: z.strictObject({}),
  output: z.object({
    organization: z.object({ name: z.string(), kind: z.string() }),
    environment: z.enum(["sandbox", "production"]),
    client: z.object({ name: z.string(), type: z.string(), connection_id: z.string().nullable() }),
    role: z.string(),
    granted_scopes: z.array(z.object({ scope: z.string(), label: z.string(), description: z.string() })),
    max_execution_class: z.string(),
    session_expires_at: z.string().nullable(),
    tools: z.object({ available: z.array(z.string()), unavailable: z.array(z.object({ name: z.string(), missing_scopes: z.array(z.string()) })) }),
    approval_policy: z.object({ execute_requires_approval: z.literal(true), production_execute_enabled: z.boolean(), approval_ttl_minutes: z.int() }),
    guidance: z.array(z.string()),
  }),
})({
  async handler(ctx) {
    const access = ctx.describeAccess();
    const auth = ctx.authorization;
    return {
      status: "success",
      data: {
        organization: { name: auth.organizationName, kind: auth.organizationKind },
        environment: ctx.environment,
        client: { name: ctx.client.name, type: ctx.client.type, connection_id: ctx.client.connectionId },
        role: ctx.principal.role,
        granted_scopes: [...ctx.scopes].map((s) => ({ scope: s, label: SCOPE_DEFINITIONS[s].label, description: SCOPE_DEFINITIONS[s].description })),
        max_execution_class: auth.maxExecutionClass,
        session_expires_at: auth.sessionExpiresAt,
        tools: access,
        approval_policy: {
          execute_requires_approval: true,
          production_execute_enabled: auth.productionExecuteEnabled,
          approval_ttl_minutes: auth.approvalTtlMinutes,
        },
        guidance: [
          "Never invent identifiers; obtain them from search tools.",
          "When a response has status needs_input or needs_clarification, ask the user rather than guessing.",
          "PREPARE tools create drafts only. EXECUTE tools always return approval_required first; the user approves in Sagolik, then call again with approval_id.",
          ctx.environment === "sandbox" ? "This is the sandbox: data is synthetic and no production records are affected." : "This is production: actions affect live records.",
        ],
      },
      summary: `${ctx.client.name} in ${ctx.environment} for ${auth.organizationName}: ${ctx.scopes.size} scope(s), up to ${EXECUTION_CLASS_META[auth.maxExecutionClass].label.toUpperCase()}; ${access.available.length} tool(s) available.`,
    };
  },
});

/* ───────────────────────── get_approval_status (Administration) ───────────────────────── */

export const getApprovalStatus = defineTool({
  name: "get_approval_status",
  title: "Get approval status",
  version: "1.0.0",
  category: "administration",
  executionClass: "read",
  ...operational("read"),
  owner: "sagolik-platform",
  requiredScopes: [],
  approvalRequired: false,
  idempotency: "none",
  providers: [],
  description: {
    summary: "Check the state of an approval request this connection created: pending, approved, denied, expired, completed or failed.",
    whenToUse: ["After an approval_required response, when the user says they have decided, before calling the action again."],
    whenNotToUse: ["To approve anything — only the user can approve, inside Sagolik.", "In a tight polling loop; check only when the user indicates a decision."],
    requiredContext: ["An approval_id from an approval_required response."],
    effect: "Read-only.",
    example: { request: "I approved it.", arguments: { approval_id: "<approval_id>" } },
  },
  input: z.strictObject({ approval_id: z.uuid() }),
  output: z.object({
    approval_id: z.string(),
    status: z.enum(["pending", "approved", "denied", "expired", "completed", "failed"]),
    tool: z.string(),
    summary: z.string(),
    requested_at: z.string(),
    expires_at: z.string(),
    decided_at: z.string().nullable(),
    decision_note: z.string().nullable(),
    next_step: z.string(),
  }),
})({
  async handler(ctx, input) {
    const approval = await ctx.approvals.get(input.approval_id);
    if (!approval) {
      return { status: "needs_clarification", field: "approval_id", message: "No approval with that id was requested by this connection in this environment." };
    }
    const next: Record<typeof approval.status, string> = {
      pending: "Waiting for the user to decide in Sagolik. Do not retry the action yet.",
      approved: `Call ${approval.tool_name} again with the same arguments and approval_id "${approval.id}".`,
      denied: "The user declined. Do not retry this action.",
      expired: "The approval expired. Call the action again to request a new approval if the user still wants it.",
      completed: "The approved action has been executed. Repeating the call returns the original result.",
      failed: "Execution failed after approval. Explain the failure to the user; a new approval is needed to retry.",
    };
    return {
      status: "success",
      data: {
        approval_id: approval.id,
        status: approval.status,
        tool: approval.tool_name,
        summary: approval.summary,
        requested_at: approval.created_at,
        expires_at: approval.expires_at,
        decided_at: approval.decided_at,
        decision_note: approval.decision_note,
        next_step: next[approval.status],
      },
      summary: `Approval ${approval.status}: ${approval.summary}`,
    };
  },
});

/* ───────────────────────── get_integration_status (Integrations) ───────────────────────── */

export const getIntegrationStatus = defineTool({
  name: "get_integration_status",
  title: "Get integration status",
  version: "1.0.0",
  category: "integrations",
  executionClass: "read",
  ...operational("read"),
  owner: "sagolik-platform",
  requiredScopes: ["finance.read"],
  approvalRequired: false,
  idempotency: "none",
  providers: [],
  description: {
    summary: "Report the normalized status of external providers connected to this organization — financial data and payments — for the current environment.",
    whenToUse: ["When data seems stale or missing, or before relying on automation that depends on a provider."],
    whenNotToUse: ["To connect or disconnect providers — the user does that in Sagolik."],
    requiredContext: ["None."],
    effect: "Read-only. Credentials and provider tokens are never exposed.",
    example: { request: "Is my bank connection working?", arguments: {} },
  },
  input: z.strictObject({}),
  output: z.object({
    environment: z.enum(["sandbox", "production"]),
    providers: z.array(
      z.object({
        provider_id: z.string(),
        name: z.string(),
        kind: z.string(),
        status: z.enum(["connected", "not_connected", "error", "not_available_in_environment"]),
        connections: z.int(),
        last_synced_at: z.string().nullable(),
      }),
    ),
    payment_execution: z.object({ mode: z.enum(["simulated", "reminder_only", "provider"]), provider: z.string().nullable() }),
    note: z.string(),
  }),
})({
  async handler(ctx) {
    const [integrations, financial] = await Promise.all([ctx.data.listIntegrationConnections(), ctx.financial.connections()]);
    const providers = PROVIDER_CATALOG.map((p) => {
      if (!p.environments.includes(ctx.environment)) {
        return { provider_id: p.id, name: p.name, kind: p.kind, status: "not_available_in_environment" as const, connections: 0, last_synced_at: null };
      }
      const conns = integrations.filter((i) => i.provider_id === p.id);
      const fin = financial.filter((f) => f.provider_id === p.id);
      const synced = fin.map((f) => f.last_synced_at).filter((x): x is string => !!x).sort().at(-1) ?? null;
      const status = conns.some((c) => c.status === "error") ? ("error" as const) : conns.length ? ("connected" as const) : ("not_connected" as const);
      return { provider_id: p.id, name: p.name, kind: p.kind, status, connections: Math.max(conns.length, fin.length), last_synced_at: synced };
    });
    return {
      status: "success",
      data: {
        environment: ctx.environment,
        providers,
        payment_execution: ctx.payments ? { mode: "simulated", provider: ctx.payments.label } : { mode: "reminder_only", provider: null },
        note: "Provider credentials are held server-side and never exposed to agents.",
      },
      summary: `${providers.filter((p) => p.status === "connected").length} provider(s) connected in ${ctx.environment}. Payments: ${ctx.payments ? "simulated" : "reminders only"}.`,
    };
  },
});

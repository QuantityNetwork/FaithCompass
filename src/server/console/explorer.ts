import "server-only";
import type { Environment } from "@/domain/environments";
import type { ConsoleSession } from "@/server/auth/console";
import { getRuntime } from "@/server/runtime";
import { toolRecords } from "@/server/tools/registry";

/**
 * Runnable example arguments for each tool. Placeholders in the registry
 * examples (e.g. "<plan_id>") are resolved against the caller's sandbox data;
 * unresolved placeholders are omitted so a run returns needs_input instead of
 * a guessed identifier.
 */
export async function explorerExamples(session: ConsoleSession, environment: Environment): Promise<Record<string, Record<string, unknown>>> {
  const { store } = getRuntime();
  const scope = { organizationId: session.organization.id, environment };
  const [accounts, plans, requests] = await Promise.all([
    store.listAccounts(scope),
    store.listAutopilotPlans(scope, {}),
    store.listDocumentRequests(scope, { status: "draft" }),
  ]);
  const checking = accounts.find((a) => a.type === "depository");
  const draftPlan = plans.find((p) => p.status === "draft" && p.expires_at > new Date().toISOString());
  const resolve = (key: string, value: unknown): unknown => {
    if (typeof value !== "string" || !value.startsWith("<")) return value;
    if (key === "funding_account_id") return checking?.id;
    if (key === "plan_id") return draftPlan?.id;
    if (key === "request_id") return requests[0]?.id;
    return undefined;
  };
  const out: Record<string, Record<string, unknown>> = {};
  for (const t of toolRecords()) {
    const args: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(t.structured_description.example.arguments)) {
      if (k === "approval_id") continue;
      const resolved = resolve(k, v);
      if (resolved !== undefined) args[k] = resolved;
    }
    out[t.name] = args;
  }
  return out;
}

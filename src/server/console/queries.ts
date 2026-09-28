import "server-only";
import type { Environment } from "@/domain/environments";
import { listTools } from "@/server/tools/registry";
import type { ConsoleSession } from "@/server/auth/console";
import { getRuntime } from "@/server/runtime";

function startOfUtcDay(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

export async function overviewData(session: ConsoleSession, now: Date) {
  const { store } = getRuntime();
  const org = session.organization.id;
  const env: Environment = session.environment;
  const [connections, today, day, week, pending, recent, deliveries, financial] = await Promise.all([
    store.listConnections(org, { environment: env, status: "active" }),
    store.activityStats(org, env, startOfUtcDay(now)),
    store.activityStats(org, env, new Date(now.getTime() - 86_400_000).toISOString()),
    store.activityStats(org, env, new Date(now.getTime() - 7 * 86_400_000).toISOString()),
    store.listApprovals(org, { environment: env, status: ["pending"], limit: 5 }),
    store.listAudit(org, { environment: env, limit: 8 }),
    store.listDeliveries(org, { environment: env, limit: 50 }),
    store.listFinancialConnections({ organizationId: org, environment: env }),
  ]);
  const settled = deliveries.filter((d) => d.status === "succeeded" || d.status === "failed");
  return {
    connections,
    toolsAvailable: listTools({ environment: env }).length,
    today,
    day,
    week,
    pending: pending.filter((a) => a.expires_at > now.toISOString()),
    recent,
    webhookSuccessRate: settled.length ? Math.round((settled.filter((d) => d.status === "succeeded").length / settled.length) * 100) : null,
    financialConnections: financial,
  };
}

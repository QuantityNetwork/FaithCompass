import Link from "next/link";
import { AuditLine } from "@/components/console/audit-line";
import { ExecutionClassBadge } from "@/components/mcp/badges";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { formatMs, formatNumber, relativeTime } from "@/lib/format";
import { requireConsoleSession } from "@/server/auth/console";
import { overviewData } from "@/server/console/queries";
import { getRuntime } from "@/server/runtime";

export const metadata = { title: "Overview" };

function HealthRow({ label, value, tone = "ok" }: { label: string; value: React.ReactNode; tone?: "ok" | "warn" | "muted" }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="flex items-center gap-2.5 text-[13px] text-body">
        <span className={`h-1.5 w-1.5 rounded-full ${tone === "ok" ? "bg-success" : tone === "warn" ? "bg-warning" : "bg-line-strong"}`} aria-hidden />
        {label}
      </span>
      <span className="tnum text-[13px] text-fg">{value}</span>
    </div>
  );
}

export default async function OverviewPage() {
  const session = await requireConsoleSession();
  const now = new Date();
  const data = await overviewData(session, now);
  const runtime = getRuntime();
  const topTools = data.week.byTool.slice(0, 6);
  const maxCount = Math.max(1, ...topTools.map((t) => t.count));
  const errorRate = data.day.total ? Math.round((data.day.failed / data.day.total) * 1000) / 10 : null;

  return (
    <>
      <PageHeader
        title="Your AI infrastructure"
        description="Connect AI agents to Sagolik through a controlled, auditable interface."
        actions={
          <>
            <ButtonLink href="/tools/explorer" variant="secondary">
              Open Tool Explorer
            </ButtonLink>
            <ButtonLink href="/connections/new">Connect Agent</ButtonLink>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Connected agents" value={data.connections.length} detail={`Active in ${session.environment}`} />
        <Stat label="Available tools" value={data.toolsAvailable} detail="Registered for this environment" />
        <Stat label="Executions today" value={formatNumber(data.today.total)} detail={data.today.total ? `${data.today.stateChanging} changed records` : "No calls yet today"} />
        <Stat label="Pending approvals" value={data.pending.length} detail={data.pending.length ? "Awaiting a human decision" : "Nothing awaiting review"} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.65fr_1fr]">
        <Card>
          <CardHeader title="Recent agent activity" description="Every call is authorized, policy-checked and audited." action={<Link href="/audit" className="text-[13px] text-link hover:underline">View audit</Link>} />
          {data.recent.length ? (
            <div className="divide-y divide-line">
              {data.recent.map((r) => (
                <AuditLine key={r.id} record={r} now={now} compact />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No agent activity yet."
              description="Connect Claude, ChatGPT, Cursor or another MCP-compatible agent, or run a tool in the Tool Explorer."
              action={<ButtonLink href="/connections/new">Connect Agent</ButtonLink>}
            />
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Pending approvals" action={<Link href="/approvals" className="text-[13px] text-link hover:underline">All approvals</Link>} />
            {data.pending.length ? (
              <ul className="divide-y divide-line">
                {data.pending.map((a) => (
                  <li key={a.id}>
                    <Link href={`/approvals/${a.id}`} className="block px-5 py-4 hover:bg-surface">
                      <div className="flex items-center gap-2">
                        <ExecutionClassBadge value={a.execution_class} />
                        <span className="text-[12px] text-subtle">expires {relativeTime(a.expires_at, now)}</span>
                      </div>
                      <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-fg">{a.summary}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No pending approvals." description="When an agent requests an EXECUTE action, it appears here for your decision." className="py-10" />
            )}
          </Card>

          <Card>
            <CardHeader title="Environment health" description="Last 24 hours" />
            <CardBody className="divide-y divide-line py-1">
              <HealthRow label="MCP gateway" value="Operational" />
              <HealthRow label="Policy engine" value="Enforcing" />
              <HealthRow label="Error rate" value={errorRate === null ? "No calls" : `${errorRate}%`} tone={errorRate === null ? "muted" : errorRate <= 2 ? "ok" : "warn"} />
              <HealthRow label="Latency p50 / p95" value={`${formatMs(data.day.latencyP50)} / ${formatMs(data.day.latencyP95)}`} tone={data.day.total ? "ok" : "muted"} />
              <HealthRow label="Denied · rate-limited" value={`${data.day.denied} · ${data.day.rateLimited}`} tone={data.day.rateLimited ? "warn" : "ok"} />
              <HealthRow label="Webhook deliveries" value={data.webhookSuccessRate === null ? "No deliveries" : `${data.webhookSuccessRate}% delivered`} tone={data.webhookSuccessRate === null ? "muted" : data.webhookSuccessRate >= 95 ? "ok" : "warn"} />
              <HealthRow label="Financial data providers" value={data.financialConnections.length ? `${data.financialConnections.length} connected` : "None connected"} tone={data.financialConnections.length ? "ok" : "muted"} />
              <HealthRow label="Data backend" value={runtime.mode === "demo" ? "In-memory (demo)" : "Supabase"} tone={runtime.mode === "demo" ? "warn" : "ok"} />
            </CardBody>
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader title="Top tools" description="Calls in the last 7 days" />
        {topTools.length ? (
          <CardBody>
            <ul className="space-y-3">
              {topTools.map((t) => (
                <li key={t.tool} className="grid grid-cols-[minmax(0,240px)_1fr_auto] items-center gap-4">
                  <Link href={`/tools/${t.tool}`} className="truncate font-mono text-[12.5px] text-fg hover:underline">
                    {t.tool}
                  </Link>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${(t.count / maxCount) * 100}%` }} />
                  </div>
                  <span className="tnum w-20 text-right text-[12.5px] text-muted">
                    {t.count} call{t.count === 1 ? "" : "s"}
                    {t.failures ? ` · ${t.failures}✕` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        ) : (
          <EmptyState title="No tool usage yet." description="Usage appears here once agents start calling tools in this environment." className="py-10" />
        )}
      </Card>
    </>
  );
}

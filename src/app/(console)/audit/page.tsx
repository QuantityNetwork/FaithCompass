import Link from "next/link";
import { EXECUTION_CLASSES } from "@/domain/execution-classes";
import { APPROVAL_STATUSES } from "@/domain/statuses";
import { effectText } from "@/components/console/audit-line";
import { ClientMonogram, EnvironmentBadge, ExecutionClassBadge, StatusBadge } from "@/components/mcp/badges";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateTime, formatMs, relativeTime } from "@/lib/format";
import { requireConsoleSession } from "@/server/auth/console";
import { auditFilterFrom } from "@/server/console/audit";
import { toolRecords } from "@/server/tools/registry";
import { getRuntime } from "@/server/runtime";

export const metadata = { title: "Audit" };

const PAGE_SIZE = 50;
const selectClass = "h-8 w-full rounded-md border border-line-strong bg-canvas px-2 text-[12.5px] text-fg";

export default async function AuditPage(props: PageProps<"/audit">) {
  const session = await requireConsoleSession();
  const params = await props.searchParams;
  const { store } = getRuntime();
  const now = new Date();
  const filter = auditFilterFrom(params, session);
  const [records, connections, chain] = await Promise.all([
    store.listAudit(session.organization.id, { ...filter, limit: PAGE_SIZE + 1 }),
    store.listConnections(session.organization.id),
    store.verifyAuditChain(session.organization.id),
  ]);
  const page = records.slice(0, PAGE_SIZE);
  const nextCursor = records.length > PAGE_SIZE ? page[page.length - 1]?.sequence : undefined;
  const query = new URLSearchParams(Object.entries(params).filter(([k, v]) => typeof v === "string" && v && k !== "before") as [string, string][]);
  const val = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : "");

  return (
    <>
      <PageHeader
        title="Audit"
        description="An append-only, hash-chained record of every tool invocation — who asked, through which agent, what policy decided and what changed."
        actions={
          <div className="flex items-center gap-3">
            {chain.brokenAt === null ? (
              <Badge tone="success" dot>
                Chain intact · {chain.records} records
              </Badge>
            ) : (
              <Badge tone="danger" dot>
                Chain broken at #{chain.brokenAt}
              </Badge>
            )}
            <a href={`/audit/export?${query.toString()}`} className={buttonClass("secondary", "sm")}>
              Export CSV
            </a>
          </div>
        }
      />

      <form className="mb-5 space-y-3 rounded-lg border border-line bg-surface px-4 py-3.5" action="/audit">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
          <label className="grid gap-1 text-[11.5px] text-muted">
            AI client
            <select name="client" defaultValue={val("client") || val("connection")} className={selectClass}>
              <option value="">All clients</option>
              <option value="console">Sagolik Console</option>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.environment})
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-[11.5px] text-muted">
            Tool
            <select name="tool" defaultValue={val("tool")} className={selectClass}>
              <option value="">All tools</option>
              {toolRecords().map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-[11.5px] text-muted">
            Environment
            <select name="env" defaultValue={filter.environmentParam} className={selectClass}>
              <option value="sandbox">Sandbox</option>
              <option value="production">Production</option>
              <option value="all">All</option>
            </select>
          </label>
          <label className="grid gap-1 text-[11.5px] text-muted">
            Class
            <select name="class" defaultValue={val("class")} className={selectClass}>
              <option value="">All</option>
              {EXECUTION_CLASSES.map((c) => (
                <option key={c} value={c}>
                  {c.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-[11.5px] text-muted">
            Outcome
            <select name="outcome" defaultValue={val("outcome")} className={selectClass}>
              <option value="">All</option>
              <option value="success">Success</option>
              <option value="failure">Failure / denied</option>
            </select>
          </label>
          <label className="grid gap-1 text-[11.5px] text-muted">
            Approval
            <select name="approval" defaultValue={val("approval")} className={selectClass}>
              <option value="">Any</option>
              {APPROVAL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-end gap-2.5">
          <label className="grid w-[148px] gap-1 text-[11.5px] text-muted">
            From
            <input type="date" name="from" defaultValue={val("from")} className={selectClass} />
          </label>
          <label className="grid w-[148px] gap-1 text-[11.5px] text-muted">
            To
            <input type="date" name="to" defaultValue={val("to")} className={selectClass} />
          </label>
          <div className="ml-auto flex gap-2">
            <Link href="/audit" className={buttonClass("ghost", "sm")}>
              Reset
            </Link>
            <button className={buttonClass("primary", "sm")}>Apply</button>
          </div>
        </div>
      </form>

      <div className="overflow-hidden rounded-lg border border-line">
        {page.length === 0 ? (
          <EmptyState title="No audit records match." description="Every tool call — including denials and approval requests — is recorded here as it happens." />
        ) : (
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-line bg-surface text-[12px] text-muted">
              <tr>
                <th className="hidden w-[210px] px-5 py-2.5 font-medium md:table-cell">Time</th>
                <th className="px-4 py-2.5 font-medium">Event</th>
                <th className="hidden px-4 py-2.5 font-medium xl:table-cell">Class</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">Result</th>
                <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Environment</th>
                <th className="hidden px-5 py-2.5 text-right font-medium md:table-cell">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {page.map((r) => (
                <tr key={r.id} className="group relative hover:bg-surface">
                  <td className="hidden px-5 py-3 align-top md:table-cell">
                    <span className="block text-fg">{relativeTime(r.created_at, now)}</span>
                    <span className="tnum whitespace-nowrap text-[11.5px] text-subtle" title={r.created_at}>
                      #{r.sequence} · {formatDateTime(r.created_at).replace(/, \d{4}/, "")}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <Link href={`/audit/${r.id}`} className="absolute inset-0" aria-label={`Audit record ${r.sequence}`} />
                    <div className="flex items-start gap-3">
                      <ClientMonogram type={r.client_type} size="sm" />
                      <div className="min-w-0">
                        <p className="text-body">
                          <span className="font-semibold text-fg">{r.client_name}</span> <span className="text-muted">used</span> <span className="font-mono text-[12.5px] text-fg [overflow-wrap:anywhere]">{r.tool_name}</span>
                        </p>
                        <p className="mt-0.5 text-[12px] text-muted">{effectText(r)}</p>
                        <p className="mt-2 flex items-center gap-2 text-[11.5px] text-subtle md:hidden">
                          <StatusBadge value={r.status} />
                          {relativeTime(r.created_at, now)} · #{r.sequence}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 align-top xl:table-cell">
                    <ExecutionClassBadge value={r.execution_class} />
                  </td>
                  <td className="hidden px-4 py-3 align-top md:table-cell">
                    <StatusBadge value={r.status} />
                  </td>
                  <td className="hidden px-4 py-3 align-top lg:table-cell">
                    <EnvironmentBadge value={r.environment} />
                  </td>
                  <td className="tnum hidden px-5 py-3 text-right align-top text-muted md:table-cell">{formatMs(r.duration_ms)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {nextCursor !== undefined && (
        <div className="mt-4 flex justify-center">
          <Link href={`/audit?${new URLSearchParams([...query.entries(), ["before", String(nextCursor)]]).toString()}`} className={buttonClass("secondary", "sm")}>
            Older records
          </Link>
        </div>
      )}
    </>
  );
}

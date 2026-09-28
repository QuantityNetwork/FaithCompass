import Link from "next/link";
import { ApprovalStatusBadge, ClientMonogram, ExecutionClassBadge } from "@/components/mcp/badges";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";
import { formatDateTime, relativeTime } from "@/lib/format";
import { requireConsoleSession } from "@/server/auth/console";
import { refreshExpiry } from "@/server/gateway/approvals";
import { getRuntime } from "@/server/runtime";

export const metadata = { title: "Approvals" };

export default async function ApprovalsPage(props: PageProps<"/approvals">) {
  const session = await requireConsoleSession();
  const params = await props.searchParams;
  const view = params.view === "history" ? "history" : "pending";
  const { store } = getRuntime();
  const now = new Date();
  const all = await Promise.all(
    (await store.listApprovals(session.organization.id, { environment: session.environment, limit: 200 })).map((a) => refreshExpiry(store, a, now)),
  );
  const pending = all.filter((a) => a.status === "pending");
  const history = all.filter((a) => a.status !== "pending");
  const list = view === "pending" ? pending : history;
  const connections = new Map((await store.listConnections(session.organization.id)).map((c) => [c.id, c.client_type]));
  const clientType = (connectionId: string | null) => (connectionId ? (connections.get(connectionId) ?? "custom") : "console");

  return (
    <>
      <PageHeader
        title="Approvals"
        description="EXECUTE actions stop here until a member with sufficient authority decides. Approving does not execute: the agent must call again with the approval id, and the approval is single-use."
      />
      <div className="mb-5 flex gap-1 border-b border-line">
        {(["pending", "history"] as const).map((v) => (
          <Link
            key={v}
            href={v === "pending" ? "/approvals" : "/approvals?view=history"}
            className={cn("-mb-px border-b-2 px-3 pb-2.5 text-[13.5px] capitalize", view === v ? "border-fg font-medium text-fg" : "border-transparent text-muted hover:text-fg")}
          >
            {v} <span className="tnum text-subtle">{v === "pending" ? pending.length : history.length}</span>
          </Link>
        ))}
      </div>
      {list.length === 0 ? (
        <div className="rounded-lg border border-line">
          <EmptyState
            title={view === "pending" ? "No pending approvals." : "No decisions yet."}
            description={view === "pending" ? "When an agent requests an EXECUTE action in this environment, it appears here with a precise explanation for your review." : "Approved, rejected and expired requests appear here."}
          />
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((a) => (
            <li key={a.id}>
              <Link href={`/approvals/${a.id}`} className="flex gap-4 rounded-lg border border-line bg-canvas px-5 py-4 transition-colors hover:border-line-strong">
                <ClientMonogram type={clientType(a.connection_id)} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <ApprovalStatusBadge value={a.status} />
                    <ExecutionClassBadge value={a.execution_class} />
                    <span className="font-mono text-[12px] text-muted">{a.tool_name}</span>
                  </div>
                  <p className="mt-2 text-[14px] leading-relaxed text-fg">{a.summary}</p>
                  <p className="mt-1.5 text-[12.5px] text-subtle">
                    Requested {relativeTime(a.created_at, now)} · {a.status === "pending" ? `expires ${relativeTime(a.expires_at, now)}` : a.decided_at ? `decided ${formatDateTime(a.decided_at)}` : `expired ${formatDateTime(a.expires_at)}`}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

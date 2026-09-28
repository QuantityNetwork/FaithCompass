import Link from "next/link";
import { RevokeButton } from "@/components/connections/revoke-button";
import { ScopeChips } from "@/components/connections/scope-chips";
import { ClientMonogram, EnvironmentBadge, clientLabel } from "@/components/mcp/badges";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate, relativeTime } from "@/lib/format";
import { requireConsoleSession } from "@/server/auth/console";
import { getRuntime } from "@/server/runtime";

export const metadata = { title: "Connections" };

export default async function ConnectionsPage() {
  const session = await requireConsoleSession();
  const { store } = getRuntime();
  const now = new Date();
  const connections = await store.listConnections(session.organization.id, { environment: session.environment });
  const audit = await store.listAudit(session.organization.id, { environment: session.environment, limit: 500 });
  const toolsUsed = (id: string) => new Set(audit.filter((a) => a.connection_id === id).map((a) => a.tool_name)).size;
  const active = connections.filter((c) => c.status === "active");
  const inactive = connections.filter((c) => c.status !== "active");

  return (
    <>
      <PageHeader
        title="Connections"
        description="AI clients connected to Sagolik in this environment. Each connection holds explicit scopes, an expiry and a complete audit trail."
        actions={<ButtonLink href="/connections/new">Connect Agent</ButtonLink>}
      />
      {active.length === 0 ? (
        <div className="rounded-lg border border-line">
          <EmptyState
            title="No connected agents yet."
            description="Connect Claude, ChatGPT, Cursor or another MCP-compatible agent to begin."
            action={<ButtonLink href="/connections/new">Connect Agent</ButtonLink>}
          />
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {active.map((c) => (
            <article key={c.id} className="flex flex-col rounded-lg border border-line bg-canvas">
              <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-5">
                <div className="flex min-w-0 items-center gap-3.5">
                  <ClientMonogram type={c.client_type} size="lg" />
                  <div className="min-w-0">
                    <h2 className="truncate text-[16px] font-semibold">{c.name}</h2>
                    <p className="text-[12.5px] text-muted">
                      {clientLabel(c.client_type)} · {c.auth_method === "oauth" ? "OAuth" : "Connection token"}
                      {c.is_demo && " · Demo"}
                    </p>
                  </div>
                </div>
                <Badge tone="success" dot>
                  Connected
                </Badge>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line px-5 py-4 text-[13px]">
                <div>
                  <dt className="text-[12px] text-muted">Environment</dt>
                  <dd className="mt-1">
                    <EnvironmentBadge value={c.environment} />
                  </dd>
                </div>
                <div>
                  <dt className="text-[12px] text-muted">Last activity</dt>
                  <dd className="mt-1 text-fg">{relativeTime(c.last_activity_at, now)}</dd>
                </div>
                <div>
                  <dt className="text-[12px] text-muted">Last connection</dt>
                  <dd className="mt-1 text-fg">{relativeTime(c.last_connected_at ?? c.created_at, now)}</dd>
                </div>
                <div>
                  <dt className="text-[12px] text-muted">Tools used</dt>
                  <dd className="tnum mt-1 text-fg">{toolsUsed(c.id)}</dd>
                </div>
                <div>
                  <dt className="text-[12px] text-muted">Expires</dt>
                  <dd className="mt-1 text-fg">{c.expires_at ? formatDate(c.expires_at) : "No expiry"}</dd>
                </div>
                <div>
                  <dt className="text-[12px] text-muted">Highest class</dt>
                  <dd className="mt-1 font-mono text-[12px] uppercase text-fg">{c.max_execution_class}</dd>
                </div>
              </dl>
              <div className="border-t border-line px-5 py-4">
                <p className="mb-2 text-[12px] text-muted">Permissions</p>
                <ScopeChips scopes={c.scopes} max={6} />
              </div>
              <div className="mt-auto flex items-center gap-2 border-t border-line px-5 py-3.5">
                <ButtonLink href={`/connections/${c.id}`} variant="secondary" size="sm">
                  Manage
                </ButtonLink>
                <ButtonLink href={`/audit?connection=${c.id}`} variant="ghost" size="sm">
                  View audit
                </ButtonLink>
                <div className="ml-auto">
                  <RevokeButton connectionId={c.id} name={c.name} />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {inactive.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[14px] font-semibold">Revoked and expired</h2>
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
            {inactive.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-4 px-5 py-3 text-[13px]">
                <Link href={`/connections/${c.id}`} className="flex items-center gap-3 hover:underline">
                  <ClientMonogram type={c.client_type} size="sm" />
                  <span className="text-fg">{c.name}</span>
                </Link>
                <span className="text-muted">
                  {c.status === "revoked" ? `Revoked ${relativeTime(c.revoked_at, now)}` : "Expired"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

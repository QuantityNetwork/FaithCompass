import { notFound } from "next/navigation";
import { AuditLine } from "@/components/console/audit-line";
import { RevokeButton } from "@/components/connections/revoke-button";
import { ScopeChips } from "@/components/connections/scope-chips";
import { ToolToggle } from "@/components/connections/tool-toggle";
import { ClientMonogram, EnvironmentBadge, ExecutionClassBadge, clientLabel } from "@/components/mcp/badges";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { KeyValue } from "@/components/ui/key-value";
import { formatDateTime, relativeTime } from "@/lib/format";
import { requireConsoleSession } from "@/server/auth/console";
import { listTools } from "@/server/tools/registry";
import { getRuntime } from "@/server/runtime";

export const metadata = { title: "Connection" };

export default async function ConnectionPage(props: PageProps<"/connections/[id]">) {
  const { id } = await props.params;
  const session = await requireConsoleSession();
  const { store } = getRuntime();
  const connection = await store.getConnection(id);
  if (!connection || connection.organization_id !== session.organization.id) notFound();
  const now = new Date();
  const [sessions, permissions, audit] = await Promise.all([store.listSessions(connection.id), store.listToolPermissions(connection.id), store.listAudit(session.organization.id, { connectionId: connection.id, limit: 10 })]);
  const denied = new Set(permissions.map((p) => p.tool_name));
  const tools = listTools({ environment: connection.environment });
  const granted = tools.filter((t) => t.requiredScopes.every((s) => connection.scopes.includes(s)));
  const notGranted = tools.filter((t) => !granted.includes(t));
  const active = connection.status === "active";

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <ClientMonogram type={connection.client_type} size="lg" />
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-[24px] font-semibold tracking-[-0.02em]">{connection.name}</h1>
              {active ? <Badge tone="success" dot>Connected</Badge> : <Badge tone="danger" dot>{connection.status === "revoked" ? "Revoked" : "Expired"}</Badge>}
            </div>
            <p className="mt-0.5 text-[13px] text-muted">
              {clientLabel(connection.client_type)} · {connection.auth_method === "oauth" ? "OAuth" : "Connection token"} · created {formatDateTime(connection.created_at)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <ButtonLink href={`/audit?connection=${connection.id}`} variant="secondary">
            View audit
          </ButtonLink>
          {active && <RevokeButton connectionId={connection.id} name={connection.name} size="md" />}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Tools" description="Scopes decide which tools are reachable. You can also disable individual tools for this connection." />
            <ul className="divide-y divide-line">
              {granted.map((t) => (
                <li key={t.name} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <ExecutionClassBadge value={t.executionClass} />
                    <span className="truncate font-mono text-[12.5px] text-fg">{t.name}</span>
                    {t.approvalRequired && <span className="text-[11.5px] text-subtle">approval required</span>}
                  </div>
                  <ToolToggle connectionId={connection.id} toolName={t.name} enabled={!denied.has(t.name)} disabled={!active} />
                </li>
              ))}
            </ul>
            {notGranted.length > 0 && (
              <div className="border-t border-line px-5 py-3 text-[12.5px] text-muted">
                {notGranted.length} tools are unavailable because their scopes are not granted: {notGranted.map((t) => t.name).join(", ")}.
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Recent activity" />
            {audit.length ? (
              <div className="divide-y divide-line">
                {audit.map((r) => (
                  <AuditLine key={r.id} record={r} now={now} compact />
                ))}
              </div>
            ) : (
              <EmptyState title="No activity yet." description="Calls made through this connection appear here." className="py-10" />
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Grant" />
            <CardBody className="space-y-5">
              <KeyValue
                columns={2}
                items={[
                  { label: "Environment", value: <EnvironmentBadge value={connection.environment} /> },
                  { label: "Highest class", value: <ExecutionClassBadge value={connection.max_execution_class} /> },
                  { label: "Expires", value: connection.expires_at ? formatDateTime(connection.expires_at) : "No expiry" },
                  { label: "Transaction limit", value: connection.transaction_limit_cents ? `$${(connection.transaction_limit_cents / 100).toLocaleString("en-US")}` : "None" },
                  { label: "Last connection", value: relativeTime(connection.last_connected_at, now) },
                  { label: "Last activity", value: relativeTime(connection.last_activity_at, now) },
                ]}
              />
              <div>
                <p className="mb-2 text-[12px] text-muted">Scopes</p>
                <ScopeChips scopes={connection.scopes} />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Sessions" description="Credentials are stored only as SHA-256 hashes." />
            {sessions.length ? (
              <ul className="divide-y divide-line">
                {sessions.slice(0, 8).map((s) => (
                  <li key={s.id} className="px-5 py-3 text-[12.5px]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-fg">{s.token_prefix}…</span>
                      {s.revoked_at ? <Badge tone="neutral">Revoked</Badge> : s.access_expires_at < now.toISOString() ? <Badge tone="neutral">Expired</Badge> : <Badge tone="success">Active</Badge>}
                    </div>
                    <p className="mt-1 text-subtle">
                      {s.kind === "oauth" ? "OAuth session" : "Connection token"} · last seen {relativeTime(s.last_seen_at, now)} · expires {formatDateTime(s.access_expires_at)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No sessions." description="A session starts when the client completes authorization." className="py-8" />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

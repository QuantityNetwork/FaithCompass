import { headers } from "next/headers";
import Link from "next/link";
import { RegisterClientForm } from "@/components/clients/register-client-form";
import { ClientMonogram, EnvironmentBadge, clientLabel } from "@/components/mcp/badges";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { KeyValue } from "@/components/ui/key-value";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateTime, relativeTime } from "@/lib/format";
import { canAdminister, requireConsoleSession } from "@/server/auth/console";
import { getRuntime, publicUrlFrom } from "@/server/runtime";

export const metadata = { title: "API Keys & OAuth" };

export default async function ClientsPage() {
  const session = await requireConsoleSession();
  const { store } = getRuntime();
  const now = new Date();
  const origin = publicUrlFrom({ headers: await headers() });
  const [connections, clients] = await Promise.all([store.listConnections(session.organization.id), store.listClientsForOrganization(session.organization.id)]);
  const tokenConnections = connections.filter((c) => c.auth_method === "token" && c.environment === session.environment);
  const sessions = (await Promise.all(tokenConnections.map(async (c) => (await store.listSessions(c.id)).map((s) => ({ ...s, connection: c }))))).flat();
  const connectionCount = (clientId: string) => connections.filter((c) => c.client_id === clientId && c.status === "active").length;
  const oauthClients = clients.filter((c) => c.registration_source !== "console" || c.token_endpoint_auth_method !== "none");

  return (
    <>
      <PageHeader
        title="API Keys & OAuth"
        description="Credentials that let agents reach Sagolik MCP. Tokens are bound to one connection and one environment; Sagolik stores only their hashes."
        actions={<ButtonLink href="/connections/new">Create connection token</ButtonLink>}
      />
      <div className="space-y-6">
        <Card>
          <CardHeader title="Connection tokens" description={`Bearer tokens for header-authenticated clients in ${session.environment}.`} />
          {sessions.length === 0 ? (
            <EmptyState title="No connection tokens." description="Create a connection for Claude Code, Cursor or a custom agent to issue a scoped token." className="py-10" />
          ) : (
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-line bg-surface text-[12px] text-muted">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Token</th>
                  <th className="px-4 py-2.5 font-medium">Connection</th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">Last used</th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">Expires</th>
                  <th className="px-5 py-2.5 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td className="px-5 py-3 font-mono text-[12.5px] text-fg">{s.token_prefix}…</td>
                    <td className="px-4 py-3">
                      <Link href={`/connections/${s.connection.id}`} className="text-link hover:underline">
                        {s.connection.name}
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 text-muted md:table-cell">{relativeTime(s.last_seen_at, now)}</td>
                    <td className="hidden px-4 py-3 text-muted md:table-cell">{formatDateTime(s.access_expires_at)}</td>
                    <td className="px-5 py-3 text-right">
                      {s.revoked_at || s.connection.status !== "active" ? <Badge>Revoked</Badge> : s.access_expires_at < now.toISOString() ? <Badge>Expired</Badge> : <Badge tone="success">Active</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <CardHeader title="OAuth clients" description="Registered dynamically by MCP clients such as Claude and ChatGPT, or by your organization. A client has no access until a member authorizes it." />
          {oauthClients.length === 0 ? (
            <EmptyState title="No OAuth clients yet." description="Clients appear here after they register and a member of this organization authorizes them." className="py-10" />
          ) : (
            <ul className="divide-y divide-line">
              {oauthClients.map((c) => (
                <li key={c.id} className="flex flex-col gap-2 px-5 py-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3">
                    <ClientMonogram type={c.client_type} size="sm" />
                    <div>
                      <p className="text-[13.5px] font-medium text-fg">{c.client_name}</p>
                      <p className="font-mono text-[11.5px] text-subtle">{c.id}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
                    <span>{clientLabel(c.client_type)}</span>·<span>{c.registration_source === "dynamic" ? "Dynamic registration" : "Registered in console"}</span>·
                    <span>{c.token_endpoint_auth_method === "none" ? "Public (PKCE)" : "Confidential"}</span>·<span>{connectionCount(c.id)} active connection(s)</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Register a confidential client" description="For enterprise agents that authenticate with a client secret and the authorization-code flow." />
            <CardBody>
              <RegisterClientForm disabled={!canAdminister(session.role)} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Authorization server" description="OAuth 2.1 with PKCE (S256), dynamic client registration and resource indicators." />
            <CardBody>
              <KeyValue
                items={[
                  { label: "Authorization server metadata", value: <code className="font-mono text-[12px]">{origin}/.well-known/oauth-authorization-server</code> },
                  { label: "Protected resource (production)", value: <code className="font-mono text-[12px]">{origin}/.well-known/oauth-protected-resource/mcp</code> },
                  { label: "Protected resource (sandbox)", value: <code className="font-mono text-[12px]">{origin}/.well-known/oauth-protected-resource/sandbox/mcp</code> },
                  { label: "Registration", value: <code className="font-mono text-[12px]">{origin}/oauth/register</code> },
                  { label: "Token · revocation", value: <code className="font-mono text-[12px]">{origin}/oauth/token · /oauth/revoke</code> },
                  { label: "Environment", value: <EnvironmentBadge value={session.environment} /> },
                ]}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

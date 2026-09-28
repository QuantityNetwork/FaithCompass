import { EnvironmentBadge } from "@/components/mcp/badges";
import { ActionButton, ConnectBankButton, PolicySettingsForm } from "@/components/settings/settings-controls";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { KeyValue } from "@/components/ui/key-value";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate, relativeTime } from "@/lib/format";
import { canAdminister, requireConsoleSession } from "@/server/auth/console";
import { PROVIDER_CATALOG } from "@/server/integrations/registry";
import { getRuntime } from "@/server/runtime";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await requireConsoleSession();
  const runtime = getRuntime();
  const { store } = runtime;
  const now = new Date();
  const scope = { organizationId: session.organization.id, environment: session.environment };
  const [settings, members, integrations, financial] = await Promise.all([
    store.getOrganizationSettings(session.organization.id),
    store.listMembers(session.organization.id),
    store.listIntegrationConnections(scope),
    store.listFinancialConnections(scope),
  ]);
  const admin = canAdminister(session.role);
  const plaidReason = !runtime.plaid
    ? "Not configured — set PLAID_CLIENT_ID and PLAID_SECRET on the server."
    : !admin
      ? "Only owners and administrators can connect accounts."
      : runtime.config.plaid?.environment === "sandbox" && session.environment !== "sandbox"
        ? "The configured Plaid sandbox serves only the Sagolik sandbox."
        : undefined;

  return (
    <>
      <PageHeader title="Settings" description="Organization policy, environments, integrations and members. Changes are recorded and take effect on the next request." />
      <div className="space-y-6">
        <Card>
          <CardHeader title="Organization" />
          <CardBody>
            <KeyValue
              columns={3}
              items={[
                { label: "Name", value: session.organization.name },
                { label: "Type", value: <span className="capitalize">{session.organization.kind.replace("_", " ")}</span> },
                { label: "Your role", value: <span className="capitalize">{session.role}</span> },
                { label: "Organization id", value: <code className="font-mono text-[12px]">{session.organization.id}</code> },
                { label: "Created", value: formatDate(session.organization.created_at) },
                { label: "Data backend", value: runtime.mode === "demo" ? "In-memory demo (not persistent)" : "Supabase (PostgreSQL, RLS)" },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Agent policy" description="Organization-wide controls applied by the policy engine to every connection." />
          <CardBody>
            <PolicySettingsForm
              settings={settings}
              canEdit={admin}
              isOwner={session.role === "owner"}
              environmentNote={runtime.mode === "demo" ? "Demo mode has no production data, so this setting has no effect here." : undefined}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Integrations" description={`Providers available in ${session.environment}. Credentials are encrypted and never exposed to agents.`} action={<EnvironmentBadge value={session.environment} />} />
          <ul className="divide-y divide-line">
            {PROVIDER_CATALOG.map((p) => {
              const available = p.environments.includes(session.environment);
              const connected = integrations.filter((i) => i.provider_id === p.id && i.status === "active").length;
              return (
                <li key={p.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[13.5px] font-medium text-fg">{p.name}</p>
                      <span className="text-[12px] text-subtle">{p.kind.replace("_", " ")}</span>
                    </div>
                    <p className="mt-0.5 max-w-xl text-[12.5px] text-muted">{p.description}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {!available ? (
                      <Badge>Not available in {session.environment}</Badge>
                    ) : connected ? (
                      <Badge tone="success" dot>
                        {connected} connected
                      </Badge>
                    ) : p.id === "plaid" ? (
                      <ConnectBankButton disabledReason={plaidReason} />
                    ) : (
                      <Badge>Not connected</Badge>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-line px-5 py-3 text-[12.5px] text-muted">
            Payment execution in {session.environment}:{" "}
            {session.environment === "sandbox" ? "simulated — no funds move." : "no payment provider is connected, so Autopilot operates in reminder-only mode. Sagolik never holds or moves funds."}
            {financial.length > 0 && ` · ${financial.length} financial connection(s), last sync ${relativeTime(financial.map((f) => f.last_synced_at ?? "").sort().at(-1), now)}.`}
          </div>
        </Card>

        <Card>
          <CardHeader title="Members" description="Role ceilings: viewers may authorize up to SIMULATE, members up to PREPARE, administrators and owners up to EXECUTE." />
          <ul className="divide-y divide-line">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between px-5 py-3 text-[13px]">
                <span className="text-fg">
                  {m.user?.full_name ?? m.user?.email ?? m.user_id}
                  <span className="ml-2 text-muted">{m.user?.email}</span>
                </span>
                <Badge tone={m.role === "owner" || m.role === "admin" ? "brand" : "neutral"}>{m.role}</Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Sandbox" description="Synthetic data: 245 Mercer Avenue (closing), 1106 Juniper Street (owned) and 72 Wren Hollow Road (prospective)." />
          <CardBody>
            <ActionButton
              label="Reset sandbox data"
              action="reset_sandbox"
              disabled={!admin}
              confirmText="Replace all sandbox properties, transactions, documents and accounts with a fresh dataset? Production is not affected."
            />
          </CardBody>
        </Card>

        <Card className="border-danger/25">
          <CardHeader title="Danger zone" />
          <CardBody>
            <p className="mb-3 text-[13px] text-muted">Immediately revoke every active connection in {session.environment}. Agents lose access on their next request.</p>
            <ActionButton label={`Revoke all ${session.environment} connections`} action="revoke_all" variant="danger" disabled={!admin} confirmText={`Revoke every active ${session.environment} connection? This cannot be undone.`} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}

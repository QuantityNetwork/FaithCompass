import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CLIENT_META } from "@/domain/clients";
import { EXECUTION_CLASSES } from "@/domain/execution-classes";
import { DEFAULT_SCOPES, SCOPES, SCOPE_DEFINITIONS, type Scope } from "@/domain/scopes";
import { AuthShell } from "@/components/auth/auth-shell";
import { ClientMonogram, ExecutionClassBadge } from "@/components/mcp/badges";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { canAdminister, resolveConsoleAuth, scopesForRole } from "@/server/auth/console";
import { OAuthError, validateAuthorizationRequest } from "@/server/auth/oauth";
import { getRuntime, publicUrlFrom } from "@/server/runtime";
import { consentAction } from "./actions";

export const metadata = { title: "Authorize an agent" };
export const dynamic = "force-dynamic";

export default async function AuthorizePage(props: PageProps<"/oauth/authorize">) {
  const raw = await props.searchParams;
  const query = new URLSearchParams(Object.entries(raw).filter(([, v]) => typeof v === "string") as [string, string][]);
  const auth = await resolveConsoleAuth();
  if (auth.state === "signed_out") redirect(`/login?next=${encodeURIComponent(`/oauth/authorize?${query.toString()}`)}`);
  if (auth.state === "no_organization") redirect("/onboarding");
  const session = auth.session;
  const runtime = getRuntime();
  const publicUrl = publicUrlFrom({ headers: await headers() });

  let request;
  try {
    request = await validateAuthorizationRequest(runtime.store, publicUrl, query);
  } catch (e) {
    const message = e instanceof OAuthError ? e.description : "The authorization request is invalid.";
    return (
      <AuthShell>
        <div className="rounded-xl border border-line bg-canvas p-8">
          <h1 className="text-[20px] font-semibold">This request cannot be authorized</h1>
          <p className="mt-2 text-[14px] text-muted">{message}</p>
          <p className="mt-4 text-[13px] text-subtle">Return to your AI client and try connecting again. No access was granted.</p>
        </div>
      </AuthShell>
    );
  }

  const grantable = new Set(scopesForRole(session.role));
  const requested: Scope[] = request.requestedScopes.length ? request.requestedScopes : DEFAULT_SCOPES;
  const checked = new Set(requested.filter((s) => grantable.has(s)));
  const client = request.client;
  const clientLabel = CLIENT_META[client.client_type].label;
  const redirectHost = new URL(request.redirectUri).host;
  const productionBlocked = runtime.mode === "demo" || !canAdminister(session.role);

  return (
    <AuthShell wide>
      <form action={consentAction} className="overflow-hidden rounded-xl border border-line bg-canvas shadow-[var(--shadow-soft)]">
        <input type="hidden" name="query" value={query.toString()} />
        <div className="border-b border-line px-8 py-7">
          <div className="flex items-center gap-4">
            <ClientMonogram type={client.client_type} size="lg" />
            <div>
              <h1 className="text-[20px] font-semibold tracking-[-0.015em]">{client.client_name} wants to connect to Sagolik</h1>
              <p className="mt-0.5 text-[13px] text-muted">
                {clientLabel} · redirects to <span className="font-mono">{redirectHost}</span>
                {client.registration_source === "dynamic" && " · self-registered client"}
              </p>
            </div>
          </div>
          <p className="mt-5 text-[13.5px] leading-relaxed text-body">
            Choose exactly what this agent may do. It will only see the tools these permissions allow. Actions that change real-world state will still require your approval each time.
          </p>
        </div>

        <div className="space-y-6 px-8 py-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-[12.5px] font-medium text-fg">
              Organization
              <Select name="organization_id" defaultValue={session.organization.id}>
                {session.memberships.map((m) => (
                  <option key={m.organizationId} value={m.organizationId}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </label>
            <div className="grid gap-1.5 text-[12.5px] font-medium text-fg">
              Environment
              {request.environment ? (
                <p className="flex h-9 items-center gap-2 rounded-md border border-line bg-surface px-3 text-[13.5px] font-normal">
                  <span className={`h-2 w-2 rounded-full ${request.environment === "sandbox" ? "bg-sandbox" : "bg-brand"}`} />
                  <span className="capitalize">{request.environment}</span>
                  <span className="text-subtle">· set by the client</span>
                </p>
              ) : (
                <Select name="environment" defaultValue="sandbox">
                  <option value="sandbox">Sandbox</option>
                  <option value="production" disabled={productionBlocked}>
                    Production
                  </option>
                </Select>
              )}
            </div>
          </div>
          {request.environment === "production" && productionBlocked && (
            <p className="rounded-md border border-danger/25 bg-danger-soft px-4 py-3 text-[13px] text-danger">
              {runtime.mode === "demo" ? "Production is unavailable in demo mode." : "Only owners and administrators can grant production access."} You can deny this request.
            </p>
          )}

          <div className="space-y-4">
            {EXECUTION_CLASSES.map((cls) => {
              const inClass = SCOPES.filter((s) => SCOPE_DEFINITIONS[s].executionClass === cls);
              return (
                <fieldset key={cls}>
                  <legend className="mb-2">
                    <ExecutionClassBadge value={cls} />
                  </legend>
                  <div className="divide-y divide-line rounded-md border border-line">
                    {inClass.map((s) => (
                      <label key={s} className={`flex gap-3 px-4 py-3 ${grantable.has(s) ? "" : "opacity-45"}`}>
                        <input type="checkbox" name="scope" value={s} defaultChecked={checked.has(s)} disabled={!grantable.has(s)} className="mt-0.5 h-4 w-4 accent-brand" />
                        <span>
                          <span className="block text-[13.5px] font-medium text-fg">
                            {SCOPE_DEFINITIONS[s].label}
                            {request.requestedScopes.includes(s) && <span className="ml-2 text-[11.5px] font-normal text-subtle">requested</span>}
                          </span>
                          <span className="block text-[12.5px] text-muted">{SCOPE_DEFINITIONS[s].description}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              );
            })}
          </div>

          <label className="grid max-w-xs gap-1.5 text-[12.5px] font-medium text-fg">
            Access expires after
            <Select name="expires" defaultValue="30">
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
            </Select>
          </label>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line bg-surface px-8 py-4">
          <p className="text-[12px] text-subtle">Signed in as {session.user.email || session.user.name}. You can revoke access at any time.</p>
          <div className="flex gap-2">
            <Button type="submit" name="decision" value="deny" variant="secondary">
              Deny
            </Button>
            <Button type="submit" name="decision" value="approve" disabled={request.environment === "production" && productionBlocked}>
              Authorize
            </Button>
          </div>
        </div>
      </form>
    </AuthShell>
  );
}

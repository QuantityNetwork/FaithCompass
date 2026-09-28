import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { MemberRole, OrganizationRow } from "@/domain/entities";
import { parseEnvironment, type Environment } from "@/domain/environments";
import { classRank } from "@/domain/execution-classes";
import { SCOPES, SCOPE_DEFINITIONS, type Scope } from "@/domain/scopes";
import type { Caller } from "@/server/gateway/caller";
import { ROLE_CEILING } from "@/server/gateway/policy";
import { getRuntime } from "@/server/runtime";
import { DEMO_USER_ID } from "@/server/sandbox/demo";
import { createUserClient } from "@/server/supabase/server";

export const ENV_COOKIE = "sgk_env";
export const ORG_COOKIE = "sgk_org";

export interface ConsoleSession {
  mode: "demo" | "live";
  user: { id: string; email: string; name: string };
  organization: OrganizationRow;
  role: MemberRole;
  memberships: { organizationId: string; name: string; role: MemberRole }[];
  environment: Environment;
}

export type ConsoleAuth =
  | { state: "signed_out" }
  | { state: "no_organization"; user: { id: string; email: string } }
  | { state: "ready"; session: ConsoleSession };

/** Resolve the signed-in console user. Organization access is validated against membership, never taken from the cookie alone. */
export async function resolveConsoleAuth(): Promise<ConsoleAuth> {
  const runtime = getRuntime();
  await runtime.ready;
  const jar = await cookies();
  const environment = parseEnvironment(jar.get(ENV_COOKIE)?.value);

  let userId: string;
  let email: string;
  if (runtime.mode === "demo") {
    userId = DEMO_USER_ID;
    email = "operator@demo.sagolik.invalid";
  } else {
    const supabase = await createUserClient();
    const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
    if (!data.user) return { state: "signed_out" };
    userId = data.user.id;
    email = data.user.email ?? "";
  }

  const memberships = await runtime.store.listMembershipsForUser(userId);
  if (memberships.length === 0) return runtime.mode === "live" ? { state: "no_organization", user: { id: userId, email } } : { state: "signed_out" };
  const requested = jar.get(ORG_COOKIE)?.value;
  const active = memberships.find((m) => m.organization_id === requested) ?? memberships[0]!;
  const user = await runtime.store.getUser(userId);
  return {
    state: "ready",
    session: {
      mode: runtime.mode,
      user: { id: userId, email: user?.email ?? email, name: user?.full_name ?? user?.email ?? email },
      organization: active.organization,
      role: active.role,
      memberships: memberships.map((m) => ({ organizationId: m.organization_id, name: m.organization.name, role: m.role })),
      environment,
    },
  };
}

export async function getConsoleSession(): Promise<ConsoleSession | null> {
  const auth = await resolveConsoleAuth();
  return auth.state === "ready" ? auth.session : null;
}

/** For console pages: redirect to sign-in or onboarding when needed. */
export async function requireConsoleSession(): Promise<ConsoleSession> {
  const auth = await resolveConsoleAuth();
  if (auth.state === "signed_out") redirect("/login");
  if (auth.state === "no_organization") redirect("/onboarding");
  return auth.session;
}

/** Scopes a member may exercise directly from the console, bounded by their role. */
export function scopesForRole(role: MemberRole): Scope[] {
  return SCOPES.filter((s) => classRank(SCOPE_DEFINITIONS[s].executionClass) <= classRank(ROLE_CEILING[role]));
}

/** The console acting as the signed-in member (Tool Explorer, approvals). */
export function consoleCaller(session: ConsoleSession, environment: Environment = session.environment): Caller {
  return {
    source: "console",
    organizationId: session.organization.id,
    organization: { name: session.organization.name, kind: session.organization.kind },
    environment,
    userId: session.user.id,
    role: session.role,
    client: { name: "Sagolik Console", type: "console", connectionId: null, clientId: null },
    sessionId: null,
    scopes: scopesForRole(session.role),
    deniedTools: [],
    maxExecutionClass: ROLE_CEILING[session.role],
    transactionLimitCents: null,
    sessionExpiresAt: null,
    ip: null,
    userAgent: "Sagolik Console",
  };
}

export function canAdminister(role: MemberRole): boolean {
  return role === "owner" || role === "admin";
}

"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isEnvironment } from "@/domain/environments";
import { canAdminister, resolveConsoleAuth, scopesForRole } from "@/server/auth/console";
import { approveAuthorization, denyAuthorizationRedirect, sanitizeScopes, validateAuthorizationRequest } from "@/server/auth/oauth";
import { getRuntime, publicUrlFrom } from "@/server/runtime";

const EXPIRY_DAYS: Record<string, number> = { "7": 7, "30": 30, "90": 90 };

/**
 * Record the user's consent. Everything is re-validated server-side: the
 * original authorization request, organization membership, role ceilings and
 * the environment bound by the resource indicator.
 */
export async function consentAction(form: FormData): Promise<void> {
  const auth = await resolveConsoleAuth();
  if (auth.state !== "ready") redirect("/login");
  const session = auth.session;
  const runtime = getRuntime();
  const publicUrl = publicUrlFrom({ headers: await headers() });
  const query = new URLSearchParams(String(form.get("query") ?? ""));
  const request = await validateAuthorizationRequest(runtime.store, publicUrl, query);

  if (form.get("decision") !== "approve") redirect(denyAuthorizationRedirect(request));

  const organizationId = String(form.get("organization_id") ?? "");
  const membership = session.memberships.find((m) => m.organizationId === organizationId);
  if (!membership) throw new Error("You are not a member of that organization.");

  const chosen = String(form.get("environment") ?? "");
  const environment = request.environment ?? (isEnvironment(chosen) ? chosen : "sandbox");
  if (environment === "production" && (runtime.mode === "demo" || !canAdminister(membership.role))) {
    throw new Error("Production access requires an owner or administrator.");
  }

  const allowed = new Set(scopesForRole(membership.role));
  const scopes = sanitizeScopes(form.getAll("scope").map(String)).filter((s) => allowed.has(s));
  if (scopes.length === 0) throw new Error("Grant at least one permission, or deny the request.");
  const days = EXPIRY_DAYS[String(form.get("expires") ?? "30")] ?? 30;

  const { redirectTo } = await approveAuthorization(runtime.store, runtime.clock, request, {
    organizationId,
    userId: session.user.id,
    environment,
    scopes,
    expiresAt: new Date(Date.now() + days * 86_400_000).toISOString(),
    transactionLimitCents: null,
  }, publicUrl);
  redirect(redirectTo);
}

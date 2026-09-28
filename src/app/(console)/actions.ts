"use server";

import { cookies } from "next/headers";
import { isEnvironment } from "@/domain/environments";
import { ENV_COOKIE, ORG_COOKIE, requireConsoleSession } from "@/server/auth/console";

const COOKIE_OPTIONS = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 };

/** Switch the console between sandbox and production. The cookie only selects a view; it grants nothing. */
export async function setEnvironmentAction(environment: string) {
  await requireConsoleSession();
  if (!isEnvironment(environment)) return;
  (await cookies()).set(ENV_COOKIE, environment, COOKIE_OPTIONS);
}

/** Switch organization. Membership is re-validated on every request that reads the cookie. */
export async function setOrganizationAction(organizationId: string) {
  const session = await requireConsoleSession();
  if (!session.memberships.some((m) => m.organizationId === organizationId)) return;
  (await cookies()).set(ORG_COOKIE, organizationId, COOKIE_OPTIONS);
}

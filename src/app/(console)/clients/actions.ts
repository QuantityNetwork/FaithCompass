"use server";

import { refresh } from "next/cache";
import { canAdminister, requireConsoleSession } from "@/server/auth/console";
import { OAuthError, registerClient } from "@/server/auth/oauth";
import { getRuntime } from "@/server/runtime";

/**
 * Register a confidential OAuth client owned by this organization, for
 * enterprise agents that can keep a client secret. The client still has no
 * access until a member authorizes it on the consent screen.
 */
export async function registerConfidentialClientAction(input: { name: string; redirectUris: string }): Promise<{ ok: true; clientId: string; clientSecret: string } | { ok: false; error: string }> {
  const session = await requireConsoleSession();
  if (!canAdminister(session.role)) return { ok: false, error: "Only owners and administrators can register OAuth clients." };
  const runtime = getRuntime();
  try {
    const res = await registerClient(
      runtime.store,
      runtime.clock,
      {
        client_name: input.name,
        redirect_uris: input.redirectUris.split(/[\s,]+/).filter(Boolean),
        token_endpoint_auth_method: "client_secret_post",
      },
      session.organization.id,
    );
    refresh();
    return { ok: true, clientId: res.client_id, clientSecret: res.client_secret! };
  } catch (e) {
    return { ok: false, error: e instanceof OAuthError ? e.description : "Registration failed." };
  }
}

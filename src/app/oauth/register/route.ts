import { registerClient } from "@/server/auth/oauth";
import { OAUTH_CORS, oauthError, oauthJson } from "@/server/auth/oauth-http";
import { getRuntime } from "@/server/runtime";

export const dynamic = "force-dynamic";

/** RFC 7591 dynamic client registration. New clients have no access until a user consents. */
export async function POST(request: Request) {
  try {
    const runtime = getRuntime();
    await runtime.ready;
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return oauthJson({ error: "invalid_client_metadata", error_description: "Body must be JSON." }, 400);
    return oauthJson(await registerClient(runtime.store, runtime.clock, body), 201);
  } catch (error) {
    return oauthError(error);
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: OAUTH_CORS });
}

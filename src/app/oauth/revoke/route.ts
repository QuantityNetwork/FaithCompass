import { revokeToken } from "@/server/auth/oauth";
import { formParams, OAUTH_CORS, oauthError } from "@/server/auth/oauth-http";
import { getRuntime } from "@/server/runtime";

export const dynamic = "force-dynamic";

/** RFC 7009 token revocation. Responds 200 whether or not the token existed. */
export async function POST(request: Request) {
  try {
    const runtime = getRuntime();
    await runtime.ready;
    const params = await formParams(request);
    await revokeToken(runtime.store, runtime.clock, params.get("token"));
    return new Response(null, { status: 200, headers: OAUTH_CORS });
  } catch (error) {
    return oauthError(error);
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: OAUTH_CORS });
}

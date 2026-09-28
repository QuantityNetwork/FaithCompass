import { exchangeToken } from "@/server/auth/oauth";
import { basicCredentials, formParams, OAUTH_CORS, oauthError, oauthJson } from "@/server/auth/oauth-http";
import { getRuntime } from "@/server/runtime";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const runtime = getRuntime();
    await runtime.ready;
    const params = await formParams(request);
    return oauthJson(await exchangeToken(runtime.store, runtime.clock, params, basicCredentials(request)));
  } catch (error) {
    return oauthError(error);
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: OAUTH_CORS });
}

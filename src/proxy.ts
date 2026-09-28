import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session cookie for console routes (live mode only).
 * Authorization is never decided here; every page and action re-validates
 * the user and their organization membership on the server.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || process.env.SAGOLIK_MODE === "demo") return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/console/:path*", "/connections/:path*", "/tools/explorer", "/approvals/:path*", "/audit/:path*", "/webhooks/:path*", "/clients/:path*", "/settings/:path*", "/oauth/authorize", "/onboarding"],
};

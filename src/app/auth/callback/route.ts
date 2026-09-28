import { NextResponse } from "next/server";
import { createUserClient } from "@/server/supabase/server";

export const dynamic = "force-dynamic";

/** Completes Supabase magic-link and OAuth sign-in by exchanging the one-time code for a session. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/console";
  const supabase = await createUserClient();
  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=callback", url.origin));
}

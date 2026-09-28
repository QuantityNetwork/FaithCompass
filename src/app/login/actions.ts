"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { publicUrlFrom } from "@/server/runtime";
import { createUserClient } from "@/server/supabase/server";

export type AuthState = { error?: string; message?: string } | undefined;

function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/console";
}

export async function signInAction(_: AuthState, form: FormData): Promise<AuthState> {
  const supabase = await createUserClient();
  if (!supabase) return { error: "Authentication is not configured." };
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const mode = String(form.get("mode") ?? "password");
  const next = safeNext(form.get("next"));
  if (!email) return { error: "Enter your email address." };

  if (mode === "magic") {
    const origin = publicUrlFrom({ headers: await headers() });
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` } });
    return error ? { error: "The sign-in link could not be sent." } : { message: "Check your email for a sign-in link." };
  }
  if (mode === "signup") {
    const origin = publicUrlFrom({ headers: await headers() });
    const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${origin}/auth/callback?next=/onboarding` } });
    return error ? { error: error.message } : { message: "Check your email to confirm your account." };
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Incorrect email or password." };
  redirect(next);
}

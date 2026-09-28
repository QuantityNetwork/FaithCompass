import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { ButtonLink } from "@/components/ui/button";
import { resolveConsoleAuth } from "@/server/auth/console";
import { getRuntime } from "@/server/runtime";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage(props: PageProps<"/login">) {
  const params = await props.searchParams;
  const next = typeof params.next === "string" && params.next.startsWith("/") && !params.next.startsWith("//") ? params.next : "/console";
  const runtime = getRuntime();
  if (runtime.mode === "live") {
    const auth = await resolveConsoleAuth();
    if (auth.state === "ready") redirect(next);
    if (auth.state === "no_organization") redirect("/onboarding");
  }
  return (
    <AuthShell>
      <div className="rounded-xl border border-line bg-canvas p-8 shadow-[var(--shadow-soft)]">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Sign in to Sagolik MCP</h1>
        {runtime.mode === "demo" ? (
          <>
            <p className="mt-2 text-[14px] leading-relaxed text-muted">This deployment runs in demo mode: no database is configured, so a clearly labelled demo workspace with sandbox data is used instead of accounts.</p>
            <ButtonLink href={next} className="mt-6 w-full">
              Open the demo console
            </ButtonLink>
          </>
        ) : (
          <>
            <p className="mb-6 mt-2 text-[14px] text-muted">Manage the agents connected to your Sagolik organization.</p>
            <LoginForm next={next} />
          </>
        )}
        {params.error === "callback" && <p className="mt-4 text-[13px] text-danger">The sign-in link was invalid or has expired.</p>}
      </div>
    </AuthShell>
  );
}

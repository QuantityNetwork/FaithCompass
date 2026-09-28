import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { OnboardingForm } from "@/components/auth/onboarding-form";
import { resolveConsoleAuth } from "@/server/auth/console";

export const metadata = { title: "Create your organization" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const auth = await resolveConsoleAuth();
  if (auth.state === "signed_out") redirect("/login?next=/onboarding");
  if (auth.state === "ready") redirect("/console");
  return (
    <AuthShell>
      <div className="rounded-xl border border-line bg-canvas p-8 shadow-[var(--shadow-soft)]">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Create your organization</h1>
        <p className="mb-6 mt-2 text-[14px] text-muted">Agents, approvals and audit records belong to an organization. Access is always scoped to it.</p>
        <OnboardingForm />
      </div>
    </AuthShell>
  );
}

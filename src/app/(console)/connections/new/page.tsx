import { headers } from "next/headers";
import { ConnectionWizard } from "@/components/connections/connection-wizard";
import { PageHeader } from "@/components/ui/page-header";
import { canAdminister, requireConsoleSession, scopesForRole } from "@/server/auth/console";
import { publicUrlFrom } from "@/server/runtime";

export const metadata = { title: "Connect an agent" };

export default async function NewConnectionPage() {
  const session = await requireConsoleSession();
  const publicUrl = publicUrlFrom({ headers: await headers() });
  return (
    <>
      <PageHeader
        eyebrow="Quick start"
        title="Connect an agent"
        description="Connections default to the sandbox. Every connection is bound to one environment, holds explicit scopes and can be revoked at any time."
      />
      <ConnectionWizard publicUrl={publicUrl} demo={session.mode === "demo"} canCreateProduction={canAdminister(session.role)} grantableScopes={scopesForRole(session.role)} />
    </>
  );
}

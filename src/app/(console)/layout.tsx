import Link from "next/link";
import { SagolikLockup } from "@/components/brand/logo";
import { EnvironmentBand } from "@/components/console/environment-band";
import { EnvironmentSwitcher } from "@/components/console/environment-switcher";
import { OrganizationSwitcher } from "@/components/console/organization-switcher";
import { SidebarNav, type NavItem } from "@/components/console/sidebar-nav";
import { EnvironmentBadge } from "@/components/mcp/badges";
import { ButtonLink } from "@/components/ui/button";
import { getConsoleSession } from "@/server/auth/console";
import { getRuntime } from "@/server/runtime";

export const dynamic = "force-dynamic";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const session = await getConsoleSession();
  const pending = session
    ? (await getRuntime().store.listApprovals(session.organization.id, { environment: session.environment, status: ["pending"], limit: 100 })).length
    : 0;

  const groups: { label?: string; items: NavItem[] }[] = session
    ? [
        {
          items: [
            { href: "/console", label: "Overview", exact: true },
            { href: "/connections", label: "Connections" },
            { href: "/tools", label: "Tools" },
            { href: "/tools/explorer", label: "Tool Explorer" },
            { href: "/approvals", label: "Approvals", badge: pending },
            { href: "/audit", label: "Audit" },
          ],
        },
        {
          label: "Developers",
          items: [
            { href: "/webhooks", label: "Webhooks" },
            { href: "/clients", label: "API Keys & OAuth" },
            { href: "/docs", label: "Documentation", external: true },
          ],
        },
        { items: [{ href: "/settings", label: "Settings" }] },
      ]
    : [{ items: [{ href: "/tools", label: "Tools" }, { href: "/docs", label: "Documentation" }] }];

  return (
    <div className="flex min-h-screen flex-col">
      {session && <EnvironmentBand environment={session.environment} demo={session.mode === "demo"} />}
      <div className="flex flex-1">
        <div className="hidden w-[244px] shrink-0 border-r border-line bg-surface lg:block">
        <aside className="sticky top-0 flex h-screen flex-col">
          <div className="flex h-14 items-center border-b border-line px-5">
            <Link href={session ? "/console" : "/"} className="text-brand" aria-label="Sagolik MCP">
              <SagolikLockup className="h-[20px]" />
            </Link>
          </div>
          {session && (
            <div className="border-b border-line px-5 py-3.5">
              <p className="eyebrow text-[10px]">Organization</p>
              <div className="mt-1.5">
                <OrganizationSwitcher current={session.organization.id} options={session.memberships} />
              </div>
              <p className="mt-0.5 text-[12px] capitalize text-subtle">{session.organization.kind.replace("_", " ")} · {session.role}</p>
            </div>
          )}
          <div className="flex-1 overflow-y-auto px-3 py-5">
            <SidebarNav groups={groups} />
          </div>
          <div className="border-t border-line px-5 py-4">
            {session ? (
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-medium text-fg">{session.user.name}</p>
                  <p className="truncate text-[11.5px] text-subtle">{session.mode === "demo" ? "Demo mode" : session.user.email}</p>
                </div>
                {session.mode === "live" && (
                  <form action="/auth/signout" method="post">
                    <button className="text-[12px] text-muted hover:text-fg">Sign out</button>
                  </form>
                )}
              </div>
            ) : (
              <ButtonLink href="/login" size="sm" className="w-full">
                Sign in
              </ButtonLink>
            )}
          </div>
        </aside>
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-line bg-white/90 px-6 backdrop-blur-md lg:px-10">
            <div className="flex items-center gap-3 lg:hidden">
              <Link href="/" className="text-brand">
                <SagolikLockup className="h-[18px]" />
              </Link>
            </div>
            <div className="hidden items-center gap-2 text-[12.5px] text-muted lg:flex">
              {session ? (
                <>
                  <span>{session.organization.name}</span>
                  <span className="text-line-strong">/</span>
                  <EnvironmentBadge value={session.environment} />
                </>
              ) : (
                <span>Public registry</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {session ? <EnvironmentSwitcher value={session.environment} /> : <ButtonLink href="/login" size="sm">Sign in</ButtonLink>}
            </div>
          </header>
          <main className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-8 lg:px-10 lg:py-10">{children}</main>
        </div>
      </div>
    </div>
  );
}

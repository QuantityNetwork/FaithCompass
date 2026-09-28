import Link from "next/link";
import { SagolikLockup } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { MobileMenu } from "@/components/ui/mobile-menu";

const NAV = [
  { href: "/tools", label: "Tools" },
  { href: "/sandbox", label: "Sandbox" },
  { href: "/docs", label: "Documentation" },
  { href: "/security", label: "Security" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-white/85 backdrop-blur-md backdrop-saturate-150">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-10">
          <Link href="/" className="text-brand" aria-label="Sagolik MCP home">
            <SagolikLockup className="h-[22px]" />
          </Link>
          <nav className="hidden items-center gap-7 md:flex" aria-label="Primary">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="text-[13.5px] text-muted transition-colors hover:text-fg">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ButtonLink href="/console" variant="ghost" size="sm" className="hidden sm:inline-flex">
            Console
          </ButtonLink>
          <ButtonLink href="/connections/new" size="sm">
            Connect an Agent
          </ButtonLink>
          <MobileMenu className="md:hidden">
            <nav aria-label="Primary" className="divide-y divide-line">
              {[{ href: "/", label: "Home" }, ...NAV, { href: "/console", label: "Console" }].map((item) => (
                <Link key={item.href} href={item.href} className="block py-3.5 text-[17px] font-medium text-fg">
                  {item.label}
                </Link>
              ))}
            </nav>
          </MobileMenu>
        </div>
      </div>
    </header>
  );
}

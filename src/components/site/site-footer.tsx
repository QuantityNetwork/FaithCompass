import Link from "next/link";
import { SagolikLockup } from "@/components/brand/logo";

const COLUMNS: { title: string; links: [label: string, href: string][] }[] = [
  { title: "Product", links: [["Tools", "/tools"], ["Tool Explorer", "/tools/explorer"], ["Sandbox", "/sandbox"], ["Console", "/console"]] },
  { title: "Developers", links: [["Documentation", "/docs"], ["Quick start", "/docs/quick-start"], ["Connect Claude", "/docs/connect-claude"], ["Changelog", "/docs/changelog"]] },
  { title: "Trust", links: [["Security", "/security"], ["Permissions", "/docs/permissions"], ["Approvals", "/docs/approvals"], ["Audit", "/docs/audit"]] },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <SagolikLockup className="h-5 text-brand" />
          <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-muted">From Decision to Ownership. The secure execution layer between human intent, AI agents and property and financial infrastructure.</p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <p className="eyebrow">{col.title}</p>
            <ul className="mt-4 space-y-2.5">
              {col.links.map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="text-[13px] text-body hover:text-fg">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-2 px-4 py-5 sm:px-6 text-[12px] text-subtle sm:flex-row sm:justify-between">
          <span>© {new Date().getUTCFullYear()} Sagolik. All rights reserved.</span>
          <span>Sagolik does not hold or move funds. Payment execution is performed only by connected, regulated providers.</span>
        </div>
      </div>
    </footer>
  );
}

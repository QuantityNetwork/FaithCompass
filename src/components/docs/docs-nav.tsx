"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { DOC_GROUPS } from "./nav";

export function DocsNav() {
  const pathname = usePathname();
  return (
    <nav className="space-y-7" aria-label="Documentation">
      {DOC_GROUPS.map((g) => (
        <div key={g.label}>
          <p className="eyebrow mb-2 text-[10.5px]">{g.label}</p>
          <ul className="space-y-0.5 border-l border-line">
            {g.links.map((l) => {
              const href = l.slug ? `/docs/${l.slug}` : "/docs";
              const active = pathname === href;
              return (
                <li key={href}>
                  <Link href={href} className={cn("-ml-px block border-l py-1 pl-4 text-[13.5px] transition-colors", active ? "border-fg font-medium text-fg" : "border-transparent text-muted hover:border-line-strong hover:text-fg")}>
                    {l.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

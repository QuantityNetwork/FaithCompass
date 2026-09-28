"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export interface NavItem {
  href: string;
  label: string;
  badge?: number;
  external?: boolean;
  exact?: boolean;
}

export function SidebarNav({ groups }: { groups: { label?: string; items: NavItem[] }[] }) {
  const pathname = usePathname();
  const isActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href;
    if (item.href === "/tools") return pathname === "/tools" || (pathname.startsWith("/tools/") && !pathname.startsWith("/tools/explorer"));
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };
  return (
    <nav className="space-y-6" aria-label="Console">
      {groups.map((group, gi) => (
        <div key={gi}>
          {group.label && <p className="eyebrow mb-2 px-3 text-[10.5px]">{group.label}</p>}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    target={item.external ? "_blank" : undefined}
                    className={cn(
                      "flex h-8 items-center justify-between rounded-md px-3 text-[13.5px] transition-colors",
                      active ? "bg-surface-3 font-medium text-fg" : "text-body hover:bg-surface-2 hover:text-fg",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    <span>{item.label}</span>
                    {item.badge ? (
                      <span className="tnum rounded-[5px] bg-prepare-soft px-1.5 text-[11px] font-semibold leading-5 text-prepare">{item.badge}</span>
                    ) : item.external ? (
                      <span className="text-[11px] text-subtle">↗</span>
                    ) : null}
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

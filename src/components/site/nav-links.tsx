'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavLink } from '@/lib/site/nav';

export function NavLinks({ links, className }: { links: NavLink[]; className?: string }) {
  const pathname = usePathname();
  return (
    <>
      {links.map((l) => {
        const current = pathname === l.href || (l.href !== '/' && pathname.startsWith(`${l.href}/`));
        return (
          <Link key={l.href} href={l.href} className={className} aria-current={current ? 'page' : undefined}>
            {l.label}
          </Link>
        );
      })}
    </>
  );
}

'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const TRUST_PAGES = [
  { href: '/institutional/trust', label: 'Security overview' },
  { href: '/institutional/trust/subprocessors', label: 'Sub-processors' },
  { href: '/institutional/trust/dpa', label: 'Data Processing Agreement' },
  { href: '/institutional/trust/questionnaire', label: 'Security questionnaire' },
] as const;

export function TrustSubnav() {
  const path = usePathname();
  return (
    <nav className="dp-subnav" aria-label="Trust and security">
      <ol>
        {TRUST_PAGES.map((p, i) => (
          <li key={p.href}>
            <Link href={p.href} aria-current={path === p.href ? 'page' : undefined}>
              <span className="dp-num">{i + 1}.</span>
              {p.label}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

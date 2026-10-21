'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const DP_PAGES = [
  { href: '/institutional/decision-passport', label: 'Overview' },
  { href: '/institutional/decision-passport/anatomy', label: 'Anatomy' },
  { href: '/institutional/decision-passport/verify', label: 'Verify' },
  { href: '/institutional/decision-passport/keys', label: 'Keys' },
  { href: '/institutional/decision-passport/revocations', label: 'Revocations' },
  { href: '/institutional/decision-passport/verifier', label: 'Offline verifier' },
  { href: '/institutional/decision-passport/policy', label: 'Policy' },
  { href: '/institutional/decision-passport/standards', label: 'Standards mapping' },
  { href: '/institutional/decision-passport/spec', label: 'Specification' },
] as const;

export function DpSubnav() {
  const path = usePathname();
  return (
    <nav className="dp-subnav" aria-label="Decision Passport">
      <ol>
        {DP_PAGES.map((p, i) => (
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

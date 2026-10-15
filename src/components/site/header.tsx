import Link from 'next/link';
import { PRIMARY_NAV } from '@/lib/site/nav';
import { SITE_NAME } from '@/lib/site/config';
import { Logo } from '@/components/brand/logo';
import { NavLinks } from './nav-links';

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell site-header__inner">
        <Link href="/" className="brand" aria-label={`${SITE_NAME} — home`}>
          <Logo height={30} className="brand__logo" />
        </Link>
        <nav className="site-nav" aria-label="Primary">
          <NavLinks links={PRIMARY_NAV} />
        </nav>
        <details className="site-menu">
          <summary>Menu</summary>
          <nav className="site-menu__panel" aria-label="Primary (menu)">
            <NavLinks links={[{ href: '/', label: 'Home' }, ...PRIMARY_NAV]} />
          </nav>
        </details>
      </div>
    </header>
  );
}

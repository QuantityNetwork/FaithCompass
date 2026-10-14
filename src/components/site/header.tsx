import Link from 'next/link';
import { PRIMARY_NAV } from '@/lib/site/nav';
import { SITE_NAME, SITE_TAGLINE } from '@/lib/site/config';
import { NavLinks } from './nav-links';

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell site-header__inner">
        <Link href="/" aria-label={`${SITE_NAME} — home`}>
          <span className="wordmark">{SITE_NAME}</span>
          <span className="wordmark__rule">{SITE_TAGLINE}</span>
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

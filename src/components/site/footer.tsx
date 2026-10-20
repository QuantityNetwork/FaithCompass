import Link from 'next/link';
import { FOOTER_NAV } from '@/lib/site/nav';
import { OPERATOR, SITE_NAME, SITE_TAGLINE } from '@/lib/site/config';
import { Logo } from '@/components/brand/logo';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell">
        <div className="site-footer__brand">
          <Link href="/" aria-label={`${SITE_NAME} — home`}>
            <Logo height={36} />
          </Link>
          <p>{SITE_TAGLINE}</p>
        </div>
        <div className="site-footer__grid">
          {FOOTER_NAV.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h2>{group.title}</h2>
              <ul>
                {group.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="site-footer__legal">
          <p>
            {SITE_NAME} distinguishes source material, interpretation and machine analysis. Inclusion of a source or
            tradition does not constitute endorsement. {SITE_NAME} is a research product, not an accredited institution;
            records marked provisional have not yet been verified by an editor.
          </p>
          <p>
            {OPERATOR.statement} © {new Date().getFullYear()} {OPERATOR.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

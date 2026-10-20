import Link from 'next/link';
import { FOOTER_NAV } from '@/lib/site/nav';
import { OPERATOR, SITE_NAME, SITE_TAGLINE } from '@/lib/site/config';

/** The production colophon, unchanged in look: logo and gold tagline, gold column heads, legal note. */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="am-wrap">
        <div className="site-footer__brand">
          <Link href="/" aria-label={`${SITE_NAME} home`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- static SVG */}
            <img className="am-only-dark" src="/brand/abrahammoses-logo-ivory.svg" alt="" width={262} height={34} />
            {/* eslint-disable-next-line @next/next/no-img-element -- static SVG */}
            <img className="am-only-light" src="/brand/abrahammoses-logo-navy.svg" alt="" width={262} height={34} />
          </Link>
          <p>{SITE_TAGLINE}</p>
        </div>
        <div className="site-footer__grid">
          {FOOTER_NAV.map((group) => (
            <nav key={group.title} aria-label={`${group.title} (footer)`}>
              <h2>{group.title}</h2>
              <ul>
                {group.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} prefetch={false}>
                      {l.label}
                    </Link>
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

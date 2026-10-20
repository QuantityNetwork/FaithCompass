import Link from 'next/link';
import { FOOTER_NAV } from '@/lib/site/nav';
import { OPERATOR, SITE_NAME, SITE_TAGLINE } from '@/lib/site/config';

export function SiteFooter() {
  return (
    <footer className="am-ftr">
      <div className="am-wrap">
        <div className="am-ftr__cols">
          <div className="am-ftr__brand">
            <Link href="/" aria-label={`${SITE_NAME} home`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- static SVG */}
              <img className="am-only-light" src="/brand/abrahammoses-logo.svg" alt="" width={154} height={20} />
              {/* eslint-disable-next-line @next/next/no-img-element -- static SVG */}
              <img className="am-only-dark" src="/brand/abrahammoses-logo-ivory.svg" alt="" width={154} height={20} />
            </Link>
            <p>
              {SITE_TAGLINE}. A research product of {OPERATOR.name}: not an accredited institution and not a religious
              authority.
            </p>
          </div>
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
        <div className="am-ftr__legal">
          <p>
            {SITE_NAME} distinguishes source material, interpretation and machine analysis. Inclusion of a source or
            tradition does not constitute endorsement. Records marked provisional have not yet been verified by an editor;
            AI-drafted material says so wherever it appears.
          </p>
          <p>
            {OPERATOR.statement} © {new Date().getFullYear()} {OPERATOR.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

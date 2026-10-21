import type { ReactNode } from 'react';
import { TrustSubnav } from './nav';
import '../decision-passport/passport.css';
import './trust.css';

export default function TrustLayout({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="dp-page tr-page">
      <div className="dp-wrap">
        <header className="dp-masthead">
          <a href="/institutional/trust" aria-label="Trust and security overview" className="tr-mark">
            {/* eslint-disable-next-line @next/next/no-img-element -- static SVG */}
            <img src="/brand/abrahammoses-logo-navy.svg" alt="AbrahamMoses" width={262} height={34} />
            <span>Trust and security</span>
          </a>
          <p className="dp-masthead__status">For vendor review</p>
        </header>
        <TrustSubnav />
        {children}
      </div>
    </main>
  );
}

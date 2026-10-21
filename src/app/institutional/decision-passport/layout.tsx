import type { ReactNode } from 'react';
import { DpSubnav } from './nav';
import './passport.css';

export default function DecisionPassportLayout({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="dp-page">
      <div className="dp-wrap">
        <header className="dp-masthead">
          <a href="/institutional/decision-passport" aria-label="Decision Passport overview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="dp-masthead__logo" src="/brand/decision-passport/logo-decision-passport.svg" alt="AbrahamMoses Decision Passport" width={783} height={165} />
          </a>
          <p className="dp-masthead__status">Process and evidence integrity</p>
        </header>
        <DpSubnav />
        {children}
      </div>
    </main>
  );
}

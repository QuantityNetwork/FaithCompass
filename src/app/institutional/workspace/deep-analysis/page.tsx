import type { Metadata } from 'next';
import { DeepAnalysisApp } from '@/components/deep-analysis/deep-analysis-app';
import '../workspace.css';
import './deep-analysis.css';

export const metadata: Metadata = {
  title: 'Deep Analysis · Institutional',
  description: 'Upload a contract or business document and receive a clause-by-clause analysis and a Final Statement, every finding cited to the exact passage.',
  alternates: { canonical: '/institutional/workspace/deep-analysis' },
  robots: { index: false, follow: false },
};

export default function DeepAnalysisPage() {
  return (
    <main id="main" className="ws da-page">
      <div className="da-wrap">
        <header className="da-masthead">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="da-masthead__logo" src="/brand/deep-analysis/logo-deep-analysis.svg" alt="AbrahamMoses — Deep Analysis / Institutional" width={433} height={69} />
          <p className="da-masthead__status">Preview</p>
        </header>
        <div className="da-intro">
          <h1>Deep Analysis</h1>
          <p>
            Submit a contract or business document. AbrahamMoses examines it clause by clause — parties, obligations, deadlines, payment, liability, risk and internal
            consistency — and concludes with a Final Statement. Every finding is cited to the exact passage on which it rests.
          </p>
        </div>
        <DeepAnalysisApp />
      </div>
    </main>
  );
}

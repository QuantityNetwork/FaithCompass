import type { Metadata } from 'next';
import { PageIntro } from '@/components/record/ui';
import { DeepAnalysisApp } from '@/components/deep-analysis/deep-analysis-app';
import '../workspace.css';
import './deep-analysis.css';

export const metadata: Metadata = {
  title: 'Deep Analysis · Evidence workspace',
  description: 'Upload a contract or business document and receive a clause-by-clause analysis and a final statement, every finding cited to the exact passage.',
  alternates: { canonical: '/institutional/workspace/deep-analysis' },
  robots: { index: false, follow: false },
};

export default function DeepAnalysisPage() {
  return (
    <main id="main" className="shell page ws">
      <PageIntro
        eyebrow="Institutional · Evidence workspace · Preview"
        title="Deep Analysis"
        lede="Upload a contract or business document. AbrahamMoses reads it clause by clause — parties, obligations, deadlines, payment, liability, risks and contradictions — and ends with a final statement. Every finding cites the exact passage it rests on."
      />
      <DeepAnalysisApp />
    </main>
  );
}

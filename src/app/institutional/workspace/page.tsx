import type { Metadata } from 'next';
import { PageIntro } from '@/components/record/ui';
import { WorkspaceApp } from '@/components/workspace/workspace-app';
import './workspace.css';

export const metadata: Metadata = {
  title: 'Evidence workspace',
  description: 'Private workspaces for institutions: import documents, propose decisions that cite them, review by a second person, export a verifiable record.',
  alternates: { canonical: '/institutional/workspace' },
  robots: { index: false, follow: false },
};

export default function WorkspacePage() {
  return (
    <main id="main" className="shell page ws">
      <PageIntro
        eyebrow="Institutional · Private workspaces"
        title="Evidence workspace"
        lede="Import source documents, propose a decision that cites their passages, have a second person review it, and export the record as a passport bundle that can be verified offline."
      />
      <p className="ws-msg">
        New, in preview: <a href="/institutional/workspace/deep-analysis">Deep Analysis</a> — upload a contract or business document and receive a cited, clause-by-clause analysis and a final statement.
      </p>
      <WorkspaceApp />
    </main>
  );
}

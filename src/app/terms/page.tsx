import type { Metadata } from 'next';
import Link from 'next/link';
import { PageIntro } from '@/components/record/ui';
import { OPERATOR, SITE_NAME, legalContact } from '@/lib/site/config';

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: 'The terms on which the AbrahamMoses site, record, REST API and MCP server may be used and cited.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  const contact = legalContact();
  return (
    <main id="main" className="shell shell--narrow page">
      <PageIntro eyebrow="Legal · version 1.0 · effective 14 October 2026" title="Terms of Use" />
      <div className="prose-block">
        <h2>1. The service</h2>
        <p>
          {SITE_NAME} is a research product written, built and operated by {OPERATOR.name}, {OPERATOR.location}. It provides a structured record of
          theological sources, claims and interpretations through this website, a REST API and an MCP server.
        </p>

        <h2>2. What the record is — and is not</h2>
        <p>
          The record distinguishes what texts say, how traditions read them, and analysis. It is not religious instruction, it
          does not rank or judge any religion, and inclusion of a source or tradition does not constitute endorsement. Records
          marked <em>provisional</em> have not yet been verified by an editor and may contain errors. Simulations in the
          dependency explorer and the <code className="code-inline">simulate</code> endpoints are hypothetical: they show what
          would follow from rejecting an assumption and change nothing in the record.
        </p>

        <h2>3. Using the record</h2>
        <p>
          You may read, search, quote and cite the record, and build applications on the public API and MCP server, provided
          that you attribute {SITE_NAME}, cite claims by code and revision, preserve the attribution of interpretations to the
          traditions that hold them, and do not present provisional records as verified or present analysis as source text.
          Quotations from third-party translations remain subject to their publishers’ terms, recorded with each quotation.
        </p>

        <h2>4. Acceptable use of the interfaces</h2>
        <p>
          Machine access is public and rate-limited. Do not attempt to circumvent rate limits, disrupt the service, or present a
          modified copy of the record as the {SITE_NAME} record. Automated clients should identify themselves in their user agent
          or MCP client information.
        </p>

        <h2>5. Intellectual property</h2>
        <p>
          {OPERATOR.statement} Scriptures and other primary texts are not claimed; the structure, selection, classification and
          editorial content of the record are. Nothing in these terms transfers ownership.
        </p>

        <h2>6. No warranty</h2>
        <p>
          The service is provided as is. {OPERATOR.name} works to keep the record accurate and available — every revision is
          preserved and corrections are published openly — but does not warrant that it is complete, error-free or
          uninterrupted. To the extent permitted by law, {OPERATOR.name} is not liable for losses arising from reliance on the
          record; this does not limit liability that cannot lawfully be limited.
        </p>

        <h2>7. Corrections</h2>
        <p>
          Reports of errors are welcome
          {contact.general ? (
            <>
              {' '}
              at <a className="link" href={`mailto:${contact.general}`}>{contact.general}</a>
            </>
          ) : null}
          . Corrections are made by publishing a new revision; see the{' '}
          <Link className="link" href="/methodology#editorial">
            editorial standards
          </Link>
          .
        </p>

        <h2>8. Privacy</h2>
        <p>
          How personal data is handled is set out in the <Link className="link" href="/privacy">Privacy Policy</Link>.
        </p>

        <h2>9. Changes</h2>
        <p>These terms may be updated; the version and effective date above will change when they are.</p>
      </div>
    </main>
  );
}

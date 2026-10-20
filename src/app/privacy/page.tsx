import type { Metadata } from 'next';
import Link from 'next/link';
import { PageIntro } from '@/components/record/ui';
import { canPersist } from '@/lib/evidence/store';
import { OPERATOR, SITE_NAME, legalContact } from '@/lib/site/config';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'What AbrahamMoses processes when you use it, why, for how long, and your rights. Research history stays on your device; there are no accounts and no tracking.',
  alternates: { canonical: '/privacy' },
};

const POLICY_VERSION = '1.1';
const POLICY_EFFECTIVE = '20 October 2026';

export default function PrivacyPage() {
  const contact = legalContact();
  const evidenceProvider = process.env.EVIDENCE_PROVIDER === 'anthropic' && Boolean(process.env.ANTHROPIC_API_KEY);
  const storesSubmissions = canPersist();

  return (
    <main id="main" className="shell shell--narrow page">
      <PageIntro
        eyebrow={`Legal · version ${POLICY_VERSION} · effective ${POLICY_EFFECTIVE}`}
        title="Privacy Policy"
        lede="Research into religion can reveal what a person believes, and under the GDPR such data is a special category. AbrahamMoses is therefore built to collect as little as it can: no accounts, no tracking, and no research history on our servers."
      />
      <div className="prose-block">
        <h2>In short</h2>
        <ul>
          <li>You do not need an account. This version of {SITE_NAME} has none.</li>
          <li>We set no cookies and use no analytics, advertising or tracking scripts.</li>
          <li>
            Traces you save are kept in your own browser’s local storage, not on our servers. You can export or delete them on
            the <Link className="link" href="/research">research page</Link>.
          </li>
          <li>
            Questions you search for are processed to produce the results page and are not stored by {SITE_NAME} in any database
            or linked to you.
          </li>
          <li>We do not sell or share personal data, and we do not profile visitors.</li>
        </ul>

        <h2>Who is responsible</h2>
        <p>
          The controller is {OPERATOR.name} ({OPERATOR.status}), who writes, builds and operates {SITE_NAME}.{' '}
          {contact.privacy ? (
            <>
              Privacy requests: <a className="link" href={`mailto:${contact.privacy}`}>{contact.privacy}</a>.
            </>
          ) : (
            <>A dedicated privacy contact address will be published here. Until then, requests can be made through {OPERATOR.name}.</>
          )}
        </p>

        <h2>What is processed, and why</h2>
        <h3>When you browse and search</h3>
        <p>
          To deliver a page, our hosting provider necessarily receives your IP address, browser details and the address you
          request — which, for a search, includes your question. We use this only to serve the page, keep the service secure
          and diagnose faults (lawful basis: legitimate interests, Article 6(1)(f) GDPR). To protect the service against abuse,
          the server counts requests per IP address in memory for up to sixty seconds; the count is not written to disk. Request
          logs kept by the hosting provider are retained only for that provider’s operational log period and are not combined
          with any other data. We do not use search questions to infer anything about you, and we never store them against an
          identity — so we do not process special-category data within the meaning of Article 9 GDPR for any purpose.
        </p>
        <h3>Saved research traces</h3>
        <p>
          “Save this trace” writes the page address and the time to your browser’s local storage. It never leaves your device.
          You can export your traces as a JSON file, or delete them, at any time on the research page; clearing your browser’s
          site data deletes them too.
        </p>
        <h3>Evidence assessments</h3>
        <p>
          {evidenceProvider ? (
            <>
              The Evidence Intelligence “Ask” and “Analyze” features send the text you submit to Anthropic, PBC, which processes it
              to produce a structured assessment on our behalf.
            </>
          ) : (
            <>
              The Evidence Intelligence features currently run on a curated, offline provider: no text you submit is sent to a
              third-party AI service. If an AI provider is enabled, this section will be updated before it is, naming the
              provider and what it receives.
            </>
          )}
        </p>
        <p>
          {storesSubmissions ? (
            <>
              A requested analysis is kept as a private draft and a challenge as a proposal for editorial review.
              Neither is published by being submitted; an editor may later publish a reviewed assessment. Do not submit
              personal information.
            </>
          ) : (
            <>
              This version has no database, so requests for new analyses and challenges are refused and nothing you
              submit is kept. The published assessments are curated and contain no visitor submissions.
            </>
          )}{' '}
          Each attempt to request an analysis or submit a challenge is logged by the server as a security event containing the time, the outcome and a
          one-way hash of your IP address, but not the text you sent; these lines stay in the hosting provider&rsquo;s
          logs for its operational log period.
        </p>
        <h3>The API and MCP server</h3>
        <p>
          Machine access is public and read-only and needs no key. Requests are handled exactly as page requests are: processed
          to answer them, rate-limited per IP address in memory, and not stored by {SITE_NAME}.
        </p>

        <h2>Accounts</h2>
        <p>
          There are none in this version. If accounts are introduced — for example to sync saved research across devices — this
          policy will be revised before they open, stating what is stored, the lawful basis (including explicit consent under
          Article 9(2)(a) GDPR for any data revealing religious or philosophical beliefs), retention, export and deletion.
        </p>

        <h2>Processors and transfers</h2>
        <p>
          The site is served by a cloud hosting provider, which processes requests on our behalf as a processor. Where a
          processor is located outside the European Economic Area, transfers are made only with the safeguards the GDPR
          requires, such as an adequacy decision or the European Commission’s standard contractual clauses.
        </p>

        <h2>Your rights</h2>
        <p>
          You have the right to access, rectify and erase personal data about you, to restrict or object to its processing, and to
          data portability. Because {SITE_NAME} keeps no record linked to you, there is usually nothing for us to retrieve; your
          saved traces are already on your device, where you can export or delete them. You may complain to the data protection
          authority where you live or work, or where the controller is established.
        </p>

        <h2>Children</h2>
        <p>{SITE_NAME} is a research service intended for adults and is not directed at children under 16.</p>

        <h2>Changes</h2>
        <p>
          Changes are published here with a new version number and effective date. A change that widens what is processed takes
          effect only after it is published.
        </p>
        <p className="small faint">
          See also the <Link className="link" href="/terms">Terms of Use</Link>.
        </p>
      </div>
    </main>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { Intro, Section } from '../decision-passport/content';
import { FIREBASE_AUTH, FIRESTORE, GAPS, HOSTING, SECURITY_HEADERS, TLS } from '@/lib/trust/facts';
import { AI_MAX_INPUT_CHARS } from '@/lib/deep-analysis/ai';
import { TrustFooter } from './content';

export const metadata: Metadata = {
  title: 'Trust and security · Institutional',
  description:
    'How AbrahamMoses is hosted and secured, where data is stored, who can access it, and what is not in place yet: a factual description for vendor review, not a certification.',
  alternates: { canonical: '/institutional/trust' },
};

const AT_A_GLANCE: [string, string][] = [
  ['Operator', 'Sagolik, Halmstad, Sweden: a single operator, not a limited company.'],
  ['Hosting', `${HOSTING.provider}; server functions in ${HOSTING.functionsRegionName}, Vercel region ${HOSTING.functionsRegion}; static pages from ${HOSTING.staticDelivery}.`],
  ['Database', `Google Cloud Firestore, project ${FIRESTORE.project}, location ${FIRESTORE.location} (${FIRESTORE.locationName}).`],
  ['Sign-in', `Firebase Authentication (Google), with Google accounts or verified email addresses. ${FIREBASE_AUTH.note}`],
  ['AI layer', 'Optional, per Deep Analysis run: the document text is sent to OpenAI with storage turned off, and nothing is stored by AbrahamMoses.'],
  ['Payments', 'Stripe’s own checkout page; card details never reach AbrahamMoses.'],
  ['Certification', 'None. No ISO/IEC 27001 certificate, no SOC 2 report, no external penetration test.'],
];

const DATA: [string, string, string, string][] = [
  ['Workspace documents, passages and their hashes', 'Cloud Firestore', FIRESTORE.location, 'Until deleted at the end of the agreement'],
  ['Decisions, reviews, passport drafts, audit events', 'Cloud Firestore', FIRESTORE.location, 'Life of the workspace; append-only'],
  ['Public passport registry and revocations (hashes, key ID, workspace ID, times)', 'Cloud Firestore', FIRESTORE.location, 'Permanent, so passports stay verifiable'],
  ['Deep Analysis profile (organisation, role, optional pilot interest)', 'Cloud Firestore', FIRESTORE.location, 'Until the user removes it, or after 24 months without an update'],
  ['Accounts (email, account ID, sign-in method)', 'Firebase Authentication', FIREBASE_AUTH.location, 'Until the account is deleted'],
  ['Deep Analysis documents and reports outside a workspace', 'Not stored', 'Processed in memory', 'None: discarded after the request'],
  ['Security events (time, outcome, hashed IP)', 'Vercel runtime logs', 'Vercel’s log storage (Vercel Inc., US company)', 'The provider’s log period'],
];

export default function TrustOverview() {
  return (
    <>
      <Intro kicker="Institutional · Trust and security" title="Security overview">
        <p>
          A factual account of how AbrahamMoses is built and run, for the information-security, outsourcing and data-protection review of a bank, insurer or law firm. Each statement was checked against
          the code and the production configuration. Where a control is not in place, this page says so.
        </p>
        <p>
          Client data is processed only in a private workspace under a signed{' '}
          <Link href="/institutional/trust/dpa">Data Processing Agreement</Link>, with the <Link href="/institutional/trust/subprocessors">sub-processors</Link> listed in it.
        </p>
      </Intro>

      <Section n={1} id="glance" title="At a glance">
        <table className="dp-table tr-kv">
          <tbody>{AT_A_GLANCE.map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td>{v}</td></tr>)}</tbody>
        </table>
      </Section>

      <Section n={2} id="data" title="Where data is held" lede="Everything AbrahamMoses keeps, where, and for how long.">
        <div className="dp-scroll">
          <table className="dp-table tr-stack">
            <thead><tr><th scope="col">Data</th><th scope="col">Held by</th><th scope="col">Location</th><th scope="col">Retention</th></tr></thead>
            <tbody>{DATA.map(([d, w, l, r]) => <tr key={d}><th scope="row">{d}</th><td data-label="Held by">{w}</td><td data-label="Location">{l}</td><td data-label="Retention">{r}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="dp-muted">
          Firestore and Firebase Authentication encrypt data at rest by default with Google-managed keys (<a href={FIRESTORE.encryptionDocs} rel="noopener noreferrer">Google’s documentation</a>). Database backups and
          point-in-time recovery are not enabled; delete protection is. See section 8.
        </p>
      </Section>

      <Section n={3} id="transport" title="Transport security and headers">
        <p>{TLS} Every page is served with these headers:</p>
        <table className="dp-table tr-kv">
          <tbody>{SECURITY_HEADERS.map(([h, v]) => <tr key={h}><th scope="row"><code>{h}</code></th><td>{v}</td></tr>)}</tbody>
        </table>
        <p className="dp-muted">Write routes refuse cross-origin requests, accept only JSON bodies within a size limit, and are rate-limited per client.</p>
      </Section>

      <Section n={4} id="access" title="Access control and tenant isolation">
        <ul>
          <li><strong>No administrator key on the server.</strong> The application servers hold no database administrator credential. Every server route acts with the signed-in user’s own token, so Firestore applies the same security rules to the server as to the user’s browser: the server can never do more than the user could.</li>
          <li><strong>Deny by default.</strong> The Firestore security rules allow only the reads and writes they name. Anonymous visitors and anonymous sign-ins never write.</li>
          <li><strong>Tenant isolation.</strong> Each workspace is a separate tenant. Its documents, decisions, drafts and audit events can be read and written only by its members.</li>
          <li><strong>Roles set by the operator only.</strong> Workspace membership and the editor role come from a signed custom claim or a membership record that only the operator can set. No user and no server route can grant them.</li>
          <li><strong>Sign-in.</strong> Google accounts or email addresses with a verified address. Passwords are held by Firebase in hashed form and never reach AbrahamMoses. Multi-factor sign-in is not offered yet.</li>
        </ul>
      </Section>

      <Section n={5} id="integrity" title="Two-person review and signed passports">
        <ul>
          <li><strong>Two-person rule in the database rules.</strong> A decision or a passport draft can be approved only by a workspace editor who is not its proposer. The rules check it on every write, and the approval is valid only together with its audit event in the same atomic batch.</li>
          <li><strong>Immutable evidence.</strong> Imported documents cannot be edited or deleted through the application; each passage carries a SHA-256 hash that a decision cites.</li>
          <li><strong>Ed25519 signatures.</strong> Decision Passports are signed on the server when issued. The private key exists only in the hosting provider’s encrypted environment configuration, is never logged or returned, and the public keys are published at a fixed address. Anyone can verify a passport offline; see the <Link href="/institutional/decision-passport">Decision Passport</Link> section.</li>
        </ul>
      </Section>

      <Section n={6} id="deep-analysis" title="Deep Analysis and the AI layer">
        <ul>
          <li>A document submitted to Deep Analysis is analysed in the server’s memory for that request and discarded. AbrahamMoses does not store the document, its text or the report.</li>
          <li>With the AI layer switched on (signed-in users only), the text, up to about {AI_MAX_INPUT_CHARS.toLocaleString('en')} characters, is sent to OpenAI’s API with storage turned off (<code>store: false</code>). Under OpenAI’s API terms it is not used for training and may stay in abuse-monitoring logs for up to 30 days.</li>
          <li>Without the AI layer, the text does not leave AbrahamMoses.</li>
          <li>Every AI finding must quote the document verbatim, or it is discarded.</li>
        </ul>
      </Section>

      <Section n={7} id="logging" title="Logging and audit trail">
        <ul>
          <li><strong>Security events.</strong> Every write attempt is logged as one structured line: time, action, outcome, role and a one-way hash of the client’s IP address. Request text is never logged.</li>
          <li><strong>Audit trail.</strong> Every change in a workspace (import, proposal, approval, rejection, passport draft, issue, revocation) is written together with its audit event in one atomic batch, attributed to the signed-in user. Audit events cannot be edited or deleted through the application.</li>
          <li><strong>Tests on every change.</strong> CI runs the security regression suite over HTTP, the database rules in the Firestore emulator, browser tests with accessibility checks and a dependency audit. These are the project’s own tests, not an external assessment.</li>
        </ul>
      </Section>

      <Section n={8} id="gaps" title="What is not in place" lede="Stated so that a review can weigh it, not to be read as planned or done.">
        <div className="dp-scroll">
          <table className="dp-table tr-stack">
            <thead><tr><th scope="col">Control</th><th scope="col">Status</th><th scope="col">Note</th></tr></thead>
            <tbody>
              {GAPS.map((g) => (
                <tr key={g.control}><th scope="row">{g.control}</th><td data-label="Status"><span className={`tr-status${g.status === 'not in place' ? ' tr-status--no' : ''}`}>{g.status}</span></td><td data-label="Note">{g.note}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section n={9} id="documents" title="Documents for your review">
        <table className="dp-table tr-kv">
          <tbody>
            <tr><th scope="row"><Link href="/institutional/trust/subprocessors">Sub-processors</Link></th><td>Every third party that processes data, with purpose, data, location and its own DPA.</td></tr>
            <tr><th scope="row"><Link href="/institutional/trust/dpa">Data Processing Agreement</Link></th><td>An Article 28 GDPR template, as a page, Word document and PDF. Subject to legal review and signature.</td></tr>
            <tr><th scope="row"><Link href="/institutional/trust/questionnaire">Security questionnaire</Link></th><td>Short answers to the usual vendor-risk questions.</td></tr>
            <tr><th scope="row"><Link href="/institutional/decision-passport/standards">Standards mapping</Link></th><td>Controls related to ISO/IEC 27001, SOC 2, eIDAS concepts and the EU AI Act: a mapping, not a certification.</td></tr>
            <tr><th scope="row"><Link href="/privacy">Privacy Policy</Link></th><td>What is processed about visitors and account holders, and their rights.</td></tr>
          </tbody>
        </table>
      </Section>
      <TrustFooter />
    </>
  );
}

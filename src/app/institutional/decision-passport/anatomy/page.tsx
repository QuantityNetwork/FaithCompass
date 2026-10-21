import type { Metadata } from 'next';
import Link from 'next/link';
import sample from '../../../../../public/decision-passport/samples/issued-test-key.bundle.json';
import { Disclaimer, Intro, Section } from '../content';

export const metadata: Metadata = {
  title: 'Anatomy of a passport · Decision Passport',
  description: 'A real Deep Analysis Decision Passport bundle, annotated artifact by artifact: the ID, the passport, the hashes and the signature.',
  alternates: { canonical: '/institutional/decision-passport/anatomy' },
};

const ARTIFACTS: [keyof typeof sample.artifacts, string][] = [
  ['passport', 'The attested content: subject (the sealed report and document hashes), analysis engine and model, outcome, findings, cited spans, proposer and reviewer, timeline, policy, audit trail, attests / does-not-attest, limits. Its canonical-JSON SHA-256 is the passport hash that is signed.'],
  ['report_markdown', 'A human-readable rendering of the passport. Informational: hashed, but the passport is the authority.'],
  ['state', 'The compact state the passport ID encodes: kind, workspace, draft id, status and time.'],
  ['sources', 'The source inventory and the source documents: here the report metadata (no document text). Each document must hash to its inventory entry.'],
  ['release', 'The release manifest: ruleset, case (the draft) and content hash, and the frozen engine with its source SHA-256.'],
  ['review', 'Review status and reviewer, which must equal those in the passport, plus any reviewer attestations.'],
  ['crypto', 'The issuance signature (Ed25519, key id, issue time, value), where to fetch public keys, and an informational key copy. Verifiers use their pinned keys, never this copy.'],
];

export default function AnatomyPage() {
  const p = sample.artifacts.passport;
  const sig = sample.artifacts.crypto.signature;
  const [base] = sample.passport_id.split('.S-');
  return (
    <>
      <Intro kicker="Decision Passport · 2" title="Anatomy of a passport">
        <p>
          The sample below is a real bundle produced by this code: a Deep Analysis passport for the fictional sample service agreement, drafted, reviewed by a second person and issued. It is the
          conformance fixture both verifiers run in CI. It is signed with a <strong>test key</strong> (pinned only in the conformance key list, its private half discarded), so the{' '}
          <Link href="/institutional/decision-passport/verify">portal</Link>, which trusts only the production key, will correctly reject its signature.
        </p>
        <p className="dp-row">
          <a className="dp-btn" href="/decision-passport/samples/issued-test-key.bundle.json" download>Download the sample bundle</a>
          <a className="dp-btn" href="/decision-passport/samples/deep-analysis-sample.bundle.json" download>Download the bound Deep Analysis bundle</a>
        </p>
      </Intro>

      <Section n={1} id="envelope" title="The envelope" lede="The outer fields of the bundle file.">
        <div className="dp-scroll">
          <table className="dp-table dp-kv">
            <tbody>
              <tr><th scope="row">bundle</th><td><code>{sample.bundle}</code></td><td>Identifies the file as a passport bundle.</td></tr>
              <tr><th scope="row">schema_version</th><td><code>{sample.schema_version}</code></td><td>Bundle schema; verifiers refuse versions they do not know.</td></tr>
              <tr><th scope="row">passport_id</th><td><code>{base.slice(0, 40)}…</code> <code className="dp-nowrap">.S-{sig.value.slice(0, 10)}…</code></td><td><code>DP1-</code> + base64url(canonical JSON of the state), then <code>.S-</code> + base64url(signature). The ID alone names the state and carries the signature.</td></tr>
              <tr><th scope="row">integrity.passport_sha256</th><td><code>{sample.integrity.passport_sha256}</code></td><td>SHA-256 over the canonical JSON (canonical-json/1, RFC 8785 style) of the passport artifact.</td></tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section n={2} id="artifacts" title="The seven artifacts" lede="Each artifact is hashed separately in integrity.artifacts; a verifier recomputes all seven.">
        <ol className="dp-anatomy">
          {ARTIFACTS.map(([name, text], i) => (
            <li key={name}>
              <div>
                <h3><span className="dp-num">2.{i + 1}</span>{name}</h3>
                <span className="dp-code">{sample.integrity.artifacts[name]}</span>
              </div>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section n={3} id="passport" title="Inside the passport" lede="Selected fields of the passport artifact, as issued.">
        <div className="dp-scroll">
          <table className="dp-table">
            <thead><tr><th scope="col">Field</th><th scope="col">Value in the sample</th><th scope="col">Meaning</th></tr></thead>
            <tbody>
              <tr><th scope="row">status</th><td><code>{p.status}</code></td><td>Lifecycle status at the passport time; only <code>issued</code> passports are signed.</td></tr>
              <tr><th scope="row">subject.report_sha256</th><td><code>{p.subject.report_sha256}</code></td><td>The seal of the Deep Analysis report this passport is bound to.</td></tr>
              <tr><th scope="row">subject.document</th><td>{p.subject.document.format}, {p.subject.document.bytes} bytes, text SHA-256 <code>{p.subject.document.text_sha256.slice(0, 16)}…</code></td><td>The analysed document, by hash. The text itself is not in the passport.</td></tr>
              <tr><th scope="row">analysis_engine</th><td><code>{p.analysis_engine.version}</code>; AI layer: {p.analysis_engine.ai.status}</td><td>What produced the findings. When the AI layer ran, provider, model and prompt version are recorded.</td></tr>
              <tr><th scope="row">outcome</th><td>{p.outcome.rating}; confidence {p.outcome.confidence}</td><td>The report&apos;s Final Statement rating, as the analysis gave it.</td></tr>
              <tr><th scope="row">findings / spans</th><td>{p.findings.length} findings, {p.spans.length} cited spans</td><td>Every span carries its quote and SHA-256; a changed quote breaks the hash.</td></tr>
              <tr><th scope="row">proposer / reviewer</th><td><code>{JSON.stringify(p.proposer)}</code><br /><code>{JSON.stringify(p.reviewer)}</code></td><td>Account ids and roles; an email address appears only with that person&apos;s consent. Placeholder ids in this sample.</td></tr>
              <tr><th scope="row">timeline</th><td>drafted {p.timeline.drafted_at}; reviewed {p.timeline.reviewed_at}; issued {p.timeline.issued_at}</td><td>Second-precision times; the issue time is the signature time.</td></tr>
              <tr><th scope="row">policy</th><td><code>{p.policy.version}</code></td><td>The Passport Policy that applied, with its digest.</td></tr>
              <tr><th scope="row">audit</th><td>{p.audit.map((a) => a.change).join(' → ')}</td><td>The draft&apos;s audit events up to issue, in order.</td></tr>
              <tr><th scope="row">engine</th><td><code>{p.engine.version}</code> <code>{p.engine.sha256.slice(0, 16)}…</code></td><td>The frozen record builder; verifiers accept only pinned engine hashes.</td></tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section n={4} id="signature" title="The signature">
        <p>
          Algorithm {sig.alg}, key <code>{sig.kid}</code>, issued <code>{sig.issued_at}</code>. The signed bytes are the UTF-8 string
        </p>
        <pre className="dp-pre" tabIndex={0}>{`AbrahamMoses Decision Passport issuance v2\n${sample.integrity.passport_sha256}\n${sig.kid}\n${sig.issued_at}`}</pre>
        <p className="dp-muted">The prefix separates passport signatures from any other use of the key (revocation lists are signed under a different prefix).</p>
      </Section>
      <Disclaimer />
    </>
  );
}

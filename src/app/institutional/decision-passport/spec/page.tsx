import type { Metadata } from 'next';
import { ENGINES } from '@/lib/decision/engines';
import { FORMAT, RULESET } from '@/lib/passport/record/v1/build';
import { Disclaimer, GITHUB, Intro, Section } from '../content';

export const metadata: Metadata = {
  title: 'Specification · Decision Passport',
  description: 'The Decision Passport bundle specification (schema 1.0.0): canonical JSON, artifacts, checks, signatures, revocation lists and the Deep Analysis passport format.',
  alternates: { canonical: '/institutional/decision-passport/spec' },
};

const DOCS: [string, string][] = [
  ['docs/DECISION_PASSPORT_SPEC.md', 'The bundle specification: canonical JSON, the seven artifacts, every verifier check, signatures and keys, the verifier report (§5), workspace records (§5a) and Deep Analysis passports (§5b).'],
  ['docs/PASSPORT_POLICY.md', 'The Passport Policy, generated from the versioned source.'],
  ['docs/INDEPENDENT_VERIFICATION.md', 'The Go verifier, the conformance fixtures and how to run them offline.'],
  ['docs/STANDARDS_MAPPING.md', 'Data-format and framework mappings (not certifications).'],
  ['docs/EVIDENCE_WORKFLOW_E2E.md', 'The private workspace, its two-person rule and its database rules.'],
];

export default function SpecPage() {
  const e = ENGINES['deep-analysis-passport-1.0.0'];
  return (
    <>
      <Intro kicker="Decision Passport · 9" title="Specification">
        <p>The specification is public and versioned with the code. Both verifiers implement it independently; the shared conformance fixtures are the test of agreement.</p>
      </Intro>
      <Section n={1} id="docs" title="Documents">
        <table className="dp-table">
          <tbody>{DOCS.map(([f, t]) => <tr key={f}><th scope="row"><a href={`${GITHUB}/${f}`}>{f}</a></th><td>{t}</td></tr>)}</tbody>
        </table>
      </Section>
      <Section n={2} id="da" title="Deep Analysis passports (§5b)">
        <table className="dp-table dp-kv">
          <tbody>
            <tr><th scope="row">Format</th><td><code>{FORMAT}</code></td></tr>
            <tr><th scope="row">Ruleset</th><td><code>{RULESET}</code></td></tr>
            <tr><th scope="row">Record engine</th><td><code>{e.version}</code>, source <code>{e.source}</code>, SHA-256 <code>{e.sha256}</code></td></tr>
            <tr><th scope="row">State</th><td><code>{'{ v: "P1", k: "deep-analysis-passport", tenant, d: draft id, s: status, t: time, a: {} }'}</code></td></tr>
            <tr><th scope="row">Signed when</th><td>Only status <code>issued</code>; <code>issued_at</code> equals <code>state.t</code>.</td></tr>
            <tr><th scope="row">Revocation list</th><td><code>abrahammoses-passport-revocations</code> version 1; signed bytes <code>{'"AbrahamMoses revocation list v1\\n" + list_sha256 + "\\n" + kid + "\\n" + issued_at'}</code></td></tr>
          </tbody>
        </table>
      </Section>
      <Disclaimer />
    </>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { ENGINES } from '@/lib/decision/engines';
import { ATTESTS, DOES_NOT_ATTEST, REVIEW_RULE } from '@/lib/passport/record/v1/build';
import { CURRENT_POLICY, policyDigest } from '@/lib/passport/policy';
import { Disclaimer, Intro, Section } from './content';

export const metadata: Metadata = {
  title: 'Decision Passport · Institutional',
  description: 'Signed, offline-verifiable records of how a decision or analysis was produced and reviewed: what a passport attests, its lifecycle, verification, keys, revocations and policy.',
  alternates: { canonical: '/institutional/decision-passport' },
};

const KINDS = [
  { kind: 'Decision Room passport', engine: ENGINES['1.0.0'], source: 'Decision Twin evaluation of a published case: rules, Adversarial Chamber, contradiction map.', where: '/institutional/decision-room' },
  { kind: 'Workspace decision record', engine: ENGINES['workspace-1.0.0'], source: 'A decision in a private workspace, citing passages of imported documents, approved by a second person.', where: '/institutional/workspace' },
  { kind: 'Deep Analysis passport', engine: ENGINES['deep-analysis-passport-1.0.0'], source: 'A sealed Deep Analysis report: findings with hash-anchored spans, engine and model, two-person review.', where: '/institutional/workspace/deep-analysis' },
];

const ROLES: [string, string, string][] = [
  ['Create a draft from a Deep Analysis report', 'Any workspace member, signed in', 'Server re-verifies the report seal and every span; rules require createdBy = the caller'],
  ['Submit the draft for review', 'The proposer only', 'Server and rules'],
  ['Approve or reject', 'A workspace editor who is not the proposer', 'Server and rules (two-person rule; self-approval refused)'],
  ['Issue and sign', 'The proposer or the reviewer, after approval', 'Server only: the signing key never leaves the server; refused if no key is configured'],
  ['Verify', 'Anyone, online or offline', 'Two independent verifiers (TypeScript, Go) and the public registry'],
  ['Revoke or supersede', 'A workspace editor', 'Server and rules; the revocation is public and permanent'],
];

export default function DecisionPassportHub() {
  return (
    <>
      <Intro kicker="Institutional · Decision Passport" title="Decision Passport">
        <p>
          A Decision Passport is a signed, self-contained record of how a decision or an analysis was produced: what evidence it rests on, which frozen engine produced it, who proposed and who reviewed
          it, and when. Anyone can check it offline, with no account and no trust in this website, by recomputing every hash and verifying the signature against a pinned public key.
        </p>
        <p>
          Passports are issued here only after a two-person review in a private workspace, and are signed on the server. This section sets out what a passport means, how it is made, how to check one,
          and the rules that govern issuance.
        </p>
      </Intro>

      <Section n={1} id="attests" title="What a passport attests, and what it does not" lede="The same lists are written into every Deep Analysis passport, so the meaning travels with the record.">
        <div className="dp-two">
          <div>
            <h3>It attests</h3>
            <ol>{ATTESTS.map((x) => <li key={x}>{x}</li>)}</ol>
          </div>
          <div>
            <h3>It does not attest</h3>
            <ol>{DOES_NOT_ATTEST.map((x) => <li key={x}>{x}</li>)}</ol>
          </div>
        </div>
        <p className="dp-muted">
          The SHA-256 hash shows the passport is unchanged; the Ed25519 signature shows it was issued by the holder of the published key. Neither shows that the content is correct.
        </p>
      </Section>

      <Section n={2} id="kinds" title="Kinds of passport" lede="All three share one bundle format (schema 1.0.0) and are checked by the same verifiers. Each is produced by a frozen, hash-pinned engine.">
        <div className="dp-scroll">
          <table className="dp-table">
            <thead>
              <tr><th scope="col">Kind</th><th scope="col">Produced from</th><th scope="col">Engine</th><th scope="col">Engine source SHA-256</th></tr>
            </thead>
            <tbody>
              {KINDS.map((k) => (
                <tr key={k.kind}>
                  <th scope="row"><Link href={k.where}>{k.kind}</Link></th>
                  <td>{k.source}</td>
                  <td><code>{k.engine.version}</code></td>
                  <td><code>{k.engine.sha256.slice(0, 16)}…</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section n={3} id="lifecycle" title="Lifecycle" lede="Every step is one atomic database write together with its audit event; no step can be skipped or undone.">
        <ol className="dp-steps">
          <li><strong>Draft</strong>A member binds a sealed Deep Analysis report. Nothing is signed.</li>
          <li><strong>Evidence-bound</strong>Report hash, file and text hashes, findings and span hashes are fixed in the draft.</li>
          <li><strong>Two-person review</strong>Submitted by the proposer; approved or rejected by a different editor.</li>
          <li><strong>Issue and sign</strong>The server builds the passport from the stored record and signs it.</li>
          <li><strong>Verify</strong>Anyone checks it here or offline; the registry confirms issue.</li>
          <li><strong>Supersede or revoke</strong>A correction is a new passport; the old one is revoked publicly.</li>
        </ol>
        <h3>Who can do what</h3>
        <div className="dp-scroll">
          <table className="dp-table">
            <thead><tr><th scope="col">Step</th><th scope="col">Who</th><th scope="col">Enforced by</th></tr></thead>
            <tbody>{ROLES.map(([a, b, c]) => <tr key={a}><th scope="row">{a}</th><td>{b}</td><td>{c}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="dp-muted">{REVIEW_RULE}</p>
      </Section>

      <Section n={4} id="check" title="Checking a passport">
        <div className="dp-scroll">
          <table className="dp-table">
            <tbody>
              <tr><th scope="row"><Link href="/institutional/decision-passport/verify">Verification portal</Link></th><td>Paste or upload a bundle, or give a passport ID or hash: a verdict with every check explained.</td></tr>
              <tr><th scope="row"><Link href="/institutional/decision-passport/anatomy">Anatomy</Link></th><td>A real sample passport, annotated artifact by artifact.</td></tr>
              <tr><th scope="row"><Link href="/institutional/decision-passport/keys">Keys and key history</Link></th><td>The pinned public key, its validity window and the rotation and compromise procedure.</td></tr>
              <tr><th scope="row"><Link href="/institutional/decision-passport/revocations">Revocation list</Link></th><td>Every revoked or superseded passport, as a signed list.</td></tr>
              <tr><th scope="row"><Link href="/institutional/decision-passport/verifier">Offline verifier</Link></th><td>A standard-library Go program that checks a bundle with no network access.</td></tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section n={5} id="governance" title="Policy, audit and standards">
        <p>
          Issuance follows the <Link href="/institutional/decision-passport/policy">Passport Policy</Link>, version <code>{CURRENT_POLICY.version}</code> (SHA-256 <code>{policyDigest().slice(0, 16)}…</code>);
          every passport names the policy version and digest that applied. Each passport carries its own append-only audit trail. A{' '}
          <Link href="/institutional/decision-passport/standards">standards mapping</Link> relates the controls to eIDAS concepts, ISO/IEC 27001, the EU AI Act and SOC 2: it is a mapping, not a
          certification.
        </p>
      </Section>
      <Disclaimer />
    </>
  );
}

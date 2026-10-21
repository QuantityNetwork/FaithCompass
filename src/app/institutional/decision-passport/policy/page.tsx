import type { Metadata } from 'next';
import { CURRENT_POLICY, POLICY_VERSIONS, policyDigest } from '@/lib/passport/policy';
import { Disclaimer, GITHUB, Intro, Section } from '../content';

export const metadata: Metadata = {
  title: 'Passport Policy · Decision Passport',
  description: 'The versioned rules for issuing Decision Passports: what may be attested, issuance, audit, retention, revocation, key management and incidents.',
  alternates: { canonical: '/institutional/decision-passport/policy' },
};

export default function PolicyPage() {
  const p = CURRENT_POLICY;
  return (
    <>
      <Intro kicker="Decision Passport · 7" title="Passport Policy">
        <p>{p.summary}</p>
        <table className="dp-table">
          <tbody>
            <tr><th scope="row">Version</th><td><code>{p.version}</code></td></tr>
            <tr><th scope="row">Effective</th><td>{p.effective}</td></tr>
            <tr><th scope="row">Status</th><td>{p.status}</td></tr>
            <tr><th scope="row">Operator</th><td>{p.operator}</td></tr>
            <tr><th scope="row">SHA-256</th><td><code>{policyDigest(p)}</code></td></tr>
          </tbody>
        </table>
        <p className="dp-muted">
          Every passport names this version and digest. A change of wording is a new version; earlier versions stay published. Source:{' '}
          <a href={`${GITHUB}/docs/PASSPORT_POLICY.md`}>docs/PASSPORT_POLICY.md</a>.
        </p>
      </Intro>
      {p.sections.map((s, i) => (
        <Section key={s.id} n={i + 1} id={s.id} title={s.title}>
          <ol className="dp-plain">
            {s.rules.map((r, j) => (
              <li key={r} value={j + 1}><span className="dp-num">{i + 1}.{j + 1}</span>{r}</li>
            ))}
          </ol>
        </Section>
      ))}
      <Section n={p.sections.length + 1} id="versions" title="Versions">
        <table className="dp-table">
          <thead><tr><th scope="col">Version</th><th scope="col">Effective</th><th scope="col">SHA-256</th></tr></thead>
          <tbody>{POLICY_VERSIONS.map((v) => <tr key={v.version}><th scope="row"><code>{v.version}</code></th><td>{v.effective}</td><td><code>{policyDigest(v)}</code></td></tr>)}</tbody>
        </table>
      </Section>
      <Disclaimer />
    </>
  );
}

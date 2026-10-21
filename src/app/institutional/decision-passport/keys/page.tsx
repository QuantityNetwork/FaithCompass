import type { Metadata } from 'next';
import productionKeys from '../../../../../packages/decision-verifier/keys/production.json';
import { HISTORICAL_KEYS } from '@/lib/decision/keys';
import { KEYS_PATH, configuredSigner } from '@/lib/decision/signing';
import { CURRENT_POLICY } from '@/lib/passport/policy';
import { Disclaimer, GITHUB, Intro, Section } from '../content';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Keys and key history · Decision Passport',
  description: 'The pinned Ed25519 public key that signs Decision Passports, its validity window, the key history and the rotation and compromise procedure.',
  alternates: { canonical: '/institutional/decision-passport/keys' },
};

type K = { kid: string; x: string; status: string; not_before: string | null; not_after: string | null; revoked_at?: string | null };

export default function KeysPage() {
  const pinned = productionKeys.keys as K[];
  const history = [...pinned, ...(HISTORICAL_KEYS as readonly K[]).filter((h) => !pinned.some((k) => k.kid === h.kid))];
  const s = configuredSigner();
  const live = s.status === 'signing' ? `signing with ${s.signer.keyId}` : s.status === 'misconfigured' ? 'signing key misconfigured: not signing' : 'no signing key on this deployment: passports cannot be issued here';
  const liveMatches = s.status === 'signing' ? pinned.some((k) => k.kid === s.signer.keyId) : null;
  const keySection = CURRENT_POLICY.sections.find((x) => x.id === 'keys')!;
  return (
    <>
      <Intro kicker="Decision Passport · 4" title="Keys and key history">
        <p>
          Passports are signed with Ed25519. Verifiers trust only <strong>pinned</strong> keys: the list below, committed in the repository and shipped with the offline verifier. The key a bundle
          carries is informational and never trusted on its own.
        </p>
      </Intro>
      <Section n={1} id="pinned" title="Pinned production key">
        <div className="dp-scroll">
          <table className="dp-table">
            <thead><tr><th scope="col">Key id</th><th scope="col">Public key (x, base64url)</th><th scope="col">Status</th><th scope="col">Valid from</th><th scope="col">Valid to</th></tr></thead>
            <tbody>
              {pinned.map((k) => (
                <tr key={k.kid}><th scope="row"><code>{k.kid}</code></th><td><code>{k.x}</code></td><td>{k.status}</td><td>{k.not_before ?? '—'}</td><td>{k.not_after ?? 'open'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="dp-row">
          <a className="dp-btn" href="/decision-passport/production-keys.json" download>Download pinned keys (JSON)</a>
          <a className="dp-btn" href={KEYS_PATH}>Live key document</a>
          <a className="dp-btn" href={`${GITHUB}/packages/decision-verifier/keys/production.json`}>Pinned file in the repository</a>
        </p>
        <p className="dp-muted">
          This deployment: {live}
          {liveMatches === false ? ' (the live key is NOT the pinned key; its signatures will not verify).' : '.'} Compare the live key document over HTTPS with the pinned file; they must agree.
        </p>
      </Section>
      <Section n={2} id="history" title="Key history" lede="Every key that has ever signed passports, never removed. Retired keys keep their window so earlier passports keep verifying; revoked keys stay listed so their signatures are recognised as untrusted.">
        <div className="dp-scroll">
          <table className="dp-table">
            <thead><tr><th scope="col">Key id</th><th scope="col">Status</th><th scope="col">Window</th><th scope="col">Revoked</th></tr></thead>
            <tbody>
              {history.map((k) => (
                <tr key={k.kid}><th scope="row"><code>{k.kid}</code></th><td>{k.status}</td><td>{k.not_before ?? '—'} to {k.not_after ?? 'open'}</td><td>{k.revoked_at ?? '—'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        {history.every((k) => k.status === 'active') ? <p className="dp-muted">No key has been rotated, retired or revoked so far.</p> : null}
      </Section>
      <Section n={3} id="procedure" title="Key management procedure" lede={`From the Passport Policy, ${CURRENT_POLICY.version}.`}>
        <ol>{keySection.rules.map((r) => <li key={r}>{r}</li>)}</ol>
      </Section>
      <Disclaimer />
    </>
  );
}

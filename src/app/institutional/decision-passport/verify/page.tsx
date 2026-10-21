import type { Metadata } from 'next';
import Link from 'next/link';
import { Disclaimer, Intro, Section } from '../content';
import { VerifyPortal } from './portal';

export const metadata: Metadata = {
  title: 'Verify a passport · Decision Passport',
  description: 'Paste or upload a Decision Passport bundle, or give its ID or hash, and get a verdict: signature, hashes, key status, registry, revocation and every integrity check, explained.',
  alternates: { canonical: '/institutional/decision-passport/verify' },
};

export default function VerifyPage() {
  return (
    <>
      <Intro kicker="Decision Passport · 3" title="Verify a passport">
        <p>
          The portal runs the reference verifier on the server with the <Link href="/institutional/decision-passport/keys">pinned production key</Link> and the pinned engines, then checks the
          public registry and the revocation list. Nothing you submit is stored. For a check that does not rely on this website at all, use the{' '}
          <Link href="/institutional/decision-passport/verifier">offline verifier</Link>.
        </p>
      </Intro>
      <Section n={1} id="portal" title="Submit a passport">
        <VerifyPortal />
      </Section>
      <Section n={2} id="verdicts" title="Verdicts">
        <div className="dp-scroll">
          <table className="dp-table">
            <tbody>
              <tr><th scope="row">VALID</th><td>Every check passed. Signed: unchanged since issue and issued by the operator key. Unsigned (drafts): internally consistent only.</td></tr>
              <tr><th scope="row">INVALID</th><td>At least one check failed: the bundle was changed, or the signature, key or engine is not one the verifier trusts.</td></tr>
              <tr><th scope="row">REVOKED</th><td>The passport verifies but its issuer revoked or superseded it. Do not rely on it.</td></tr>
              <tr><th scope="row">UNSUPPORTED</th><td>Not a bundle this verifier knows (schema version or engine).</td></tr>
              <tr><th scope="row">REGISTERED</th><td>ID or hash lookup only: the registry lists the hash with a valid operator signature. Upload the bundle to check its content.</td></tr>
              <tr><th scope="row">NOT FOUND</th><td>Not in the registry, or the registry is not reachable from this deployment.</td></tr>
            </tbody>
          </table>
        </div>
        <p className="dp-muted">A check marked &ldquo;not checked&rdquo; was not possible (for example, the registry is not reachable). It is never counted as passed.</p>
      </Section>
      <Disclaimer />
    </>
  );
}

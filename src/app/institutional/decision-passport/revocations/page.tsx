import type { Metadata } from 'next';
import { firestoreConfigFromEnv, firestoreConfigured, FirestoreRest } from '@/lib/firebase/firestore-rest';
import { CURRENT_POLICY } from '@/lib/passport/policy';
import { allRevocations, type RevocationDoc } from '@/lib/passport/store';
import { Disclaimer, Intro, Section } from '../content';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Revocation list · Decision Passport',
  description: 'Every revoked or superseded Decision Passport, with reason and time, also available as a signed list for offline checks.',
  alternates: { canonical: '/institutional/decision-passport/revocations' },
};

async function load(): Promise<{ rows: RevocationDoc[] | null; note: string | null }> {
  if (!firestoreConfigured()) return { rows: null, note: 'The passport registry is not configured on this deployment, so the list cannot be shown here.' };
  try {
    return { rows: (await allRevocations(new FirestoreRest(firestoreConfigFromEnv(), null))).sort((a, b) => (a.revokedAt < b.revokedAt ? 1 : -1)), note: null };
  } catch {
    return { rows: null, note: 'The revocation list could not be read just now (or the database rules for it are not deployed yet).' };
  }
}

export default async function RevocationsPage() {
  const { rows, note } = await load();
  const rules = CURRENT_POLICY.sections.find((s) => s.id === 'revocation')!;
  return (
    <>
      <Intro kicker="Decision Passport · 5" title="Revocation list">
        <p>
          An issued passport can be revoked by an editor of the issuing workspace, or superseded by a corrected passport. Revocations are public and permanent. A revoked passport still verifies
          cryptographically; checking revocation is a separate step that verifiers must not skip.
        </p>
        <p className="dp-row">
          <a className="dp-btn" href="/api/passport/revocations">Signed list (JSON)</a>
        </p>
      </Intro>
      <Section n={1} id="list" title="Revoked passports">
        {rows === null ? (
          <p className="dp-notice"><strong>Not available.</strong> {note} Revocation status is therefore &ldquo;not checked&rdquo;, never &ldquo;not revoked&rdquo;.</p>
        ) : rows.length === 0 ? (
          <p>No passport has been revoked.</p>
        ) : (
          <div className="dp-scroll">
            <table className="dp-table">
              <thead><tr><th scope="col">Passport SHA-256</th><th scope="col">Revoked</th><th scope="col">Reason</th><th scope="col">Superseded by</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.sha256}><th scope="row"><code>{r.sha256}</code></th><td>{r.revokedAt}</td><td>{r.reason}</td><td>{r.supersededBy ? <code>{r.supersededBy}</code> : '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
      <Section n={2} id="reasons" title="Reasons">
        <div className="dp-scroll">
          <table className="dp-table">
            <tbody>
              <tr><th scope="row">superseded</th><td>A corrected passport replaces this one and names it; the successor&apos;s hash is listed.</td></tr>
              <tr><th scope="row">withdrawn</th><td>The issuing workspace no longer stands behind the record.</td></tr>
              <tr><th scope="row">error</th><td>The passport was issued in error (for example, the wrong report was bound).</td></tr>
              <tr><th scope="row">key-compromise</th><td>The signing key may have been exposed; the passport is re-issued under a new key.</td></tr>
            </tbody>
          </table>
        </div>
      </Section>
      <Section n={3} id="offline" title="Checking revocation offline">
        <p>Download the signed list and pass it to the offline verifier. The list is checked with the pinned keys; an unsigned or altered list can never establish &ldquo;not revoked&rdquo;.</p>
        <pre className="dp-pre" tabIndex={0}>{`curl -o revocations.json https://<this site>/api/passport/revocations
decision-verifier --keys production.json --engines engines.json --revocations revocations.json passport.bundle.json`}</pre>
        <h3>Policy</h3>
        <ol>{rules.rules.map((r) => <li key={r}>{r}</li>)}</ol>
      </Section>
      <Disclaimer />
    </>
  );
}

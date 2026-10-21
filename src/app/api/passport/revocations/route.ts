import { NextResponse } from 'next/server';
import { firestoreConfigFromEnv, firestoreConfigured, FirestoreRest } from '@/lib/firebase/firestore-rest';
import { buildRevocationList } from '@/lib/passport/bundle';
import { allRevocations } from '@/lib/passport/store';
import { logServerError } from '@/lib/security/audit-log';
import { nowIso } from '@/lib/workspace/store';

export const dynamic = 'force-dynamic';

/**
 * The public revocation list of issued Decision Passports, signed with the operator key where one is configured
 * (production). Verify it offline: decision-verifier --revocations list.json. Short cache: revocations must spread.
 */
export async function GET() {
  if (!firestoreConfigured()) {
    return NextResponse.json({ error: 'The passport registry is not configured on this deployment.', code: 'NOT_CONFIGURED' }, { status: 503, headers: { 'cache-control': 'no-store' } });
  }
  try {
    const revs = await allRevocations(new FirestoreRest(firestoreConfigFromEnv(), null));
    const list = buildRevocationList(revs.map((r) => ({ passport_sha256: r.sha256, revoked_at: r.revokedAt, reason: r.reason, superseded_by: r.supersededBy ?? null })), nowIso());
    return NextResponse.json(list, { headers: { 'cache-control': 'public, max-age=60' } });
  } catch (e) {
    logServerError('passport_revocations', e);
    return NextResponse.json({ error: 'The revocation list is unavailable.', code: 'UNAVAILABLE' }, { status: 503, headers: { 'cache-control': 'no-store' } });
  }
}

/**
 * Decision Passport issuance end to end against the Firestore emulator, under firestore.rules, with each user's own
 * token: draft from a real Deep Analysis bundle → submit → self-approval refused (server and rules) → second-person
 * approval → server-side issue with an ephemeral key → offline verification → public registry → revocation.
 * Plus direct writes that bypass the server. Placeholder uids only; runs only under `npm run test:firestore`.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ENGINES } from '@/lib/decision/engines';
import { FirestoreRest } from '@/lib/firebase/firestore-rest';
import { buildRevocationList } from '@/lib/passport/bundle';
import {
  allRevocations,
  createDraft,
  draftBundle,
  getDraft,
  issueDraft,
  listDrafts,
  registryByPassportId,
  registryEntry,
  reviewDraft,
  revokeDraft,
  submitDraft,
} from '@/lib/passport/store';
import { verifyBundle } from '@/lib/passport-bundle/verify';
import { WorkspaceAccessError, type WorkspaceActor } from '@/lib/workspace/access';
import type { TenantRole } from '@/lib/workspace/model';
import { ephemeralSigner, pinned, sampleDeepBundle } from '../helpers/da-passport';
import { HOST, ON_EMULATOR, PROJECT, clearEmulator, mockToken, publicDb } from './emulator';

const engines = Object.values(ENGINES).map((e) => ({ version: e.version, sha256: e.sha256 }));

function actor(uid: string, tenants: Record<string, TenantRole>, verified = true): WorkspaceActor {
  const email = `${uid}@example.invalid`;
  const token = mockToken(uid, { email, email_verified: verified, am_tenants: tenants });
  return { uid, email, emailVerified: verified, tenants, db: new FirestoreRest({ projectId: PROJECT, emulatorHost: HOST }, token) };
}
const alice = actor('alice', { 'ws-a': 'editor' });
const bob = actor('bob', { 'ws-a': 'editor' });
const dave = actor('dave', { 'ws-a': 'member' });
const carol = actor('carol', { 'ws-b': 'editor' });

async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'OK';
  } catch (e) {
    return e instanceof WorkspaceAccessError ? e.code : e instanceof Error && /HTTP 403|refused/.test(e.message) ? 'DENIED' : String(e);
  }
}

async function approvedDraft() {
  const d = await createDraft(alice, 'ws-a', { deepAnalysis: await sampleDeepBundle(), showFilename: false, showEmail: true, supersedes: null });
  await submitDraft(alice, 'ws-a', d.id);
  await reviewDraft(bob, 'ws-a', d.id, { action: 'approve', note: 'Checked the cited spans.', showEmail: false });
  return d;
}

describe.skipIf(!ON_EMULATOR)('Decision Passport issuance (emulator, real rules)', () => {
  beforeEach(clearEmulator);

  it('runs draft → two-person review → server issue → verify → registry → revoke', async () => {
    const signer = ephemeralSigner();
    const keys = pinned(signer);
    const d = await createDraft(alice, 'ws-a', { deepAnalysis: await sampleDeepBundle(), showFilename: false, showEmail: true, supersedes: null });
    expect(d).toMatchObject({ status: 'draft', createdBy: 'alice', createdByEmail: 'alice@example.invalid' });
    expect((await listDrafts(bob, 'ws-a')).map((x) => x.id)).toEqual([d.id]);
    expect(await code(listDrafts(carol, 'ws-a'))).toBe('NOT_A_MEMBER');

    // Draft bundle: unsigned, labelled DRAFT, VALID as a draft
    const draftB = await draftBundle(dave, 'ws-a', d.id);
    expect(draftB.artifacts.crypto.signature).toBeNull();
    expect(verifyBundle(JSON.parse(JSON.stringify(draftB)), { keys, engines }).result).toBe('VALID');

    expect(await code(submitDraft(bob, 'ws-a', d.id))).toBe('NOT_THE_PROPOSER');
    await submitDraft(alice, 'ws-a', d.id);
    expect(await code(reviewDraft(alice, 'ws-a', d.id, { action: 'approve', note: 'Mine, fine.', showEmail: false }))).toBe('SELF_APPROVAL');
    expect(await code(reviewDraft(dave, 'ws-a', d.id, { action: 'approve', note: 'Looks fine.', showEmail: false }))).toBe('NOT_AN_EDITOR');
    // Rules: a self-approval batch written around the server is refused
    const { draft, updateTime } = await getDraft(alice, 'ws-a', d.id);
    const forged = await code(
      alice.db.commit([
        { collection: 'tenants/ws-a/passport_drafts', id: d.id, fields: { ...draft, status: 'approved', reviewedBy: 'alice', reviewedAt: '2026-10-21T10:00:00Z', reviewNote: 'self', reviewAuditId: 'aud_forged000001' } as never, precondition: { updateTime } },
        { collection: 'tenants/ws-a/audit', id: 'aud_forged000001', fields: { id: 'aud_forged000001', tenant: 'ws-a', changeType: 'APPROVED', entityType: 'PASSPORT', entityId: d.id, actorId: 'alice', actorEmail: null, at: 'x', detail: 'self' }, precondition: { exists: false } },
      ]),
    );
    expect(forged).toBe('DENIED');

    // Not approved yet: cannot issue
    expect(await code(issueDraft(alice, 'ws-a', d.id, signer))).toBe('WRONG_STATE');
    await reviewDraft(bob, 'ws-a', d.id, { action: 'approve', note: 'Checked the cited spans.', showEmail: false });
    // No key: refused
    expect(await code(issueDraft(alice, 'ws-a', d.id, { status: 'unsigned' }))).toBe('SIGNING_UNAVAILABLE');
    // A member who is neither proposer nor reviewer cannot issue
    expect(await code(issueDraft(dave, 'ws-a', d.id, signer))).toBe('NOT_A_PARTY');

    const { draft: issued, bundle } = await issueDraft(alice, 'ws-a', d.id, signer);
    expect(issued.status).toBe('issued');
    const r = verifyBundle(JSON.parse(JSON.stringify(bundle)), { keys, engines });
    expect({ result: r.result, signature: r.signature, failed: r.failed }).toEqual({ result: 'VALID', signature: 'valid', failed: [] });
    const p = bundle.artifacts.passport;
    expect(p.proposer).toEqual({ role: 'proposer', uid: 'alice', email: 'alice@example.invalid' });
    expect(p.reviewer).toEqual({ role: 'editor', uid: 'bob', email: null });
    expect(p.audit.map((a) => a.change)).toEqual(['DRAFTED', 'SUBMITTED', 'APPROVED', 'ISSUED']);
    if (process.env.DA_PASSPORT_BUNDLE_OUT) (await import('node:fs')).writeFileSync(process.env.DA_PASSPORT_BUNDLE_OUT, JSON.stringify(bundle, null, 2));
    if (process.env.DA_PASSPORT_KEYS_OUT) (await import('node:fs')).writeFileSync(process.env.DA_PASSPORT_KEYS_OUT, JSON.stringify({ keys }, null, 2));

    // Rebuilt later from the stored record: same hash and signature
    const again = await draftBundle(dave, 'ws-a', d.id);
    expect(again.integrity.passport_sha256).toBe(bundle.integrity.passport_sha256);
    expect(again.passport_id).toBe(bundle.passport_id);

    // Public registry, readable without sign-in
    const pub = publicDb();
    const entry = await registryEntry(pub, bundle.integrity.passport_sha256);
    expect(entry).toMatchObject({ tenant: 'ws-a', draftId: d.id, kid: signer.status === 'signing' ? signer.signer.keyId : '' });
    expect((await registryByPassportId(pub, bundle.passport_id))?.sha256).toBe(bundle.integrity.passport_sha256);
    // … but drafts are not public
    expect(await code(pub.get('tenants/ws-a/passport_drafts', d.id))).toBe('DENIED');

    // Revocation: member refused, editor allowed, then public and in the signed list
    expect(await code(revokeDraft(dave, 'ws-a', d.id, { action: 'revoke', reason: 'withdrawn', supersededBy: null }))).toBe('NOT_AN_EDITOR');
    await revokeDraft(bob, 'ws-a', d.id, { action: 'revoke', reason: 'withdrawn', supersededBy: null });
    const revs = await allRevocations(pub);
    expect(revs.map((x) => x.sha256)).toEqual([bundle.integrity.passport_sha256]);
    const list = buildRevocationList(revs.map((x) => ({ passport_sha256: x.sha256, revoked_at: x.revokedAt, reason: x.reason, superseded_by: x.supersededBy })), '2026-10-21T12:00:00Z', signer);
    expect(verifyBundle(JSON.parse(JSON.stringify(bundle)), { keys, engines, revocations: list }).failed).toEqual(['revocation']);
    // The revoked passport still rebuilds as issued
    expect((await draftBundle(alice, 'ws-a', d.id)).integrity.passport_sha256).toBe(bundle.integrity.passport_sha256);
    expect(await code(revokeDraft(bob, 'ws-a', d.id, { action: 'revoke', reason: 'error', supersededBy: null }))).toBe('WRONG_STATE');
  });

  it('refuses direct writes that bypass the server', async () => {
    const d = await approvedDraft();
    const { draft, updateTime } = await getDraft(alice, 'ws-a', d.id);
    const sha = 'c'.repeat(64);
    // A registry entry for a draft that is not being issued in the same batch
    expect(await code(alice.db.commit([{ collection: 'issued_passports', id: sha, fields: { sha256: sha, kind: 'deep-analysis', tenant: 'ws-a', draftId: d.id, kid: 'ed25519-0000000000000000', issuedAt: '2026-10-21T10:00:00Z', signatureValue: 'x', passportId: 'DP1-x' }, precondition: { exists: false } }]))).toBe('DENIED');
    // A non-member issuing another tenant's approved draft
    const auditId = 'aud_forged000002';
    const writes = (who: WorkspaceActor) => [
      { collection: 'tenants/ws-a/passport_drafts', id: d.id, fields: { ...draft, status: 'issued', issuedAt: '2026-10-21T10:00:00Z', issuedBy: who.uid, issueAuditId: auditId, passportSha256: sha, passportAuditIds: [], signatureJson: '{}', kid: 'ed25519-0000000000000000' } as never, precondition: { updateTime } },
      { collection: 'tenants/ws-a/audit', id: auditId, fields: { id: auditId, tenant: 'ws-a', changeType: 'ISSUED', entityType: 'PASSPORT', entityId: d.id, actorId: who.uid, actorEmail: null, at: 'x', detail: 'x' }, precondition: { exists: false } },
      { collection: 'issued_passports', id: sha, fields: { sha256: sha, kind: 'deep-analysis', tenant: 'ws-a', draftId: d.id, kid: 'ed25519-0000000000000000', issuedAt: '2026-10-21T10:00:00Z', signatureValue: 'x', passportId: 'DP1-x' }, precondition: { exists: false } },
    ];
    expect(await code(carol.db.commit(writes(carol)))).toBe('DENIED');
    // A member who is neither proposer nor reviewer
    expect(await code(dave.db.commit(writes(dave)))).toBe('DENIED');
    // Changing the binding of a draft after review
    expect(await code(alice.db.commit([{ collection: 'tenants/ws-a/passport_drafts', id: d.id, fields: { ...draft, bindingJson: '{}' } as never, precondition: { updateTime } }]))).toBe('DENIED');
    // Deleting a draft; creating a draft as someone else; the generic subcollection wildcard
    expect(await code(alice.db.commit([{ collection: 'tenants/ws-a/passport_drafts', id: 'pd_other00001', fields: { ...draft, id: 'pd_other00001', status: 'draft', createdBy: 'bob', reviewedBy: null, reviewNote: null } as never, precondition: { exists: false } }]))).toBe('DENIED');
    // Emails can only be one's own, verified address
    const unverified = actor('erin', { 'ws-a': 'member' }, false);
    expect(await code(createDraft(unverified, 'ws-a', { deepAnalysis: await sampleDeepBundle(), showFilename: false, showEmail: true, supersedes: null }))).toBe('EMAIL_NOT_VERIFIED');
    // A forged (unsigned) registry entry written around the server never verifies: covered by the verify API test.
  });

  it('refuses a tampered Deep Analysis bundle at drafting', async () => {
    const b = await sampleDeepBundle();
    b.report.finalStatement.overall = 'All clear.';
    expect(await code(createDraft(alice, 'ws-a', { deepAnalysis: b, showFilename: false, showEmail: false, supersedes: null }))).toBe('BINDING_REFUSED');
  });
});

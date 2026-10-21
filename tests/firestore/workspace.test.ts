/**
 * The evidence workflow end to end against the Firestore emulator, under firestore.rules, with each user's own token:
 * import → propose → self-approval refused → second-person approval → export → offline verification; plus tenant
 * isolation and the rules on their own (direct writes that bypass the server).
 * Placeholder uids only (alice, bob, carol, dave); runs only under `npm run test:firestore`.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ENGINES } from '@/lib/decision/engines';
import { FirestoreRest } from '@/lib/firebase/firestore-rest';
import { verifyBundle } from '@/lib/passport-bundle/verify';
import type { WorkspaceActor } from '@/lib/workspace/access';
import { WorkspaceAccessError } from '@/lib/workspace/access';
import { parseImport, type TenantRole } from '@/lib/workspace/model';
import { decide, exportDecision, getDecision, getDocument, importDocument, listAudit, listDecisions, listDocuments, proposeDecision } from '@/lib/workspace/store';
import { HOST, ON_EMULATOR, PROJECT, clearEmulator, mockToken, seed } from './emulator';

const engines = Object.values(ENGINES).map((e) => ({ version: e.version, sha256: e.sha256 }));

function actor(uid: string, tenants: Record<string, TenantRole>): WorkspaceActor {
  const token = mockToken(uid, { email: `${uid}@example.invalid`, am_tenants: tenants });
  return { uid, email: `${uid}@example.invalid`, tenants, db: new FirestoreRest({ projectId: PROJECT, emulatorHost: HOST }, token) };
}
const raw = (a: WorkspaceActor) => a.db;

const alice = actor('alice', { 'ws-a': 'editor' }); // proposer, also an editor: refused as self-approver, not for lack of role
const bob = actor('bob', { 'ws-a': 'editor' }); // the second person
const dave = actor('dave', { 'ws-a': 'member' }); // member without the editor role
const carol = actor('carol', { 'ws-b': 'editor' }); // another tenant

const memo = parseImport({ filename: 'memo.md', bytes: new TextEncoder().encode('Para one.\n\nPara two says two readers are required.\n\nPara three.') });

async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'OK';
  } catch (e) {
    return e instanceof WorkspaceAccessError ? e.code : e instanceof Error && /HTTP 403|refused/.test(e.message) ? 'DENIED' : String(e);
  }
}

describe.skipIf(!ON_EMULATOR)('evidence workspace (emulator, real rules)', () => {
  beforeEach(clearEmulator);

  it('runs the full two-person workflow and exports a verifiable passport', async () => {
    const doc = await importDocument(alice, 'ws-a', memo);
    expect((await listDocuments(bob, 'ws-a')).map((d) => d.id)).toEqual([doc.id]);
    expect((await getDocument(bob, 'ws-a', doc.id)).textSha256).toBe(memo.textSha256);

    const dec = await proposeDecision(alice, 'ws-a', { title: 'Two readers', question: 'Are two readers required?', conclusion: 'Yes, per paragraph two.', rationale: '', evidence: [{ documentId: doc.id, passage: 2, note: 'rule' }] });
    expect(dec.evidence[0].passageSha256).toBe(memo.passages[1].sha256);

    // Self-approval: refused by the server …
    expect(await code(decide(alice, 'ws-a', dec.id, { action: 'approve', note: 'Looks right.' }))).toBe('SELF_APPROVAL');
    // … and by the rules, when the server is bypassed with a hand-built batch
    const { decision, updateTime } = await getDecision(alice, 'ws-a', dec.id);
    const forged = await code(
      raw(alice).commit([
        { collection: 'tenants/ws-a/decisions', id: dec.id, fields: { ...decision, status: 'approved', decidedBy: 'alice', decidedAt: '2026-10-21T10:00:00Z', decisionNote: 'self', decisionAuditId: 'aud_forged000001' } as never, precondition: { updateTime } },
        { collection: 'tenants/ws-a/audit', id: 'aud_forged000001', fields: { id: 'aud_forged000001', tenant: 'ws-a', changeType: 'APPROVED', entityType: 'DECISION', entityId: dec.id, actorId: 'alice', actorEmail: null, at: 'x', detail: 'self' }, precondition: { exists: false } },
      ]),
    );
    expect(forged).toBe('DENIED');
    // A member without the editor role cannot decide either
    expect(await code(decide(dave, 'ws-a', dec.id, { action: 'approve', note: 'I agree.' }))).toBe('NOT_AN_EDITOR');

    const approved = await decide(bob, 'ws-a', dec.id, { action: 'approve', note: 'Checked against paragraph two.' });
    expect(approved).toMatchObject({ status: 'approved', decidedBy: 'bob', proposedBy: 'alice' });
    expect(await code(decide(bob, 'ws-a', dec.id, { action: 'reject', note: 'Changed my mind.' }))).toBe('ALREADY_DECIDED');

    const first = await exportDecision(dave, 'ws-a', dec.id);
    expect(first.firstExport).toBe(true);
    const report = verifyBundle(JSON.parse(JSON.stringify(first.bundle)), { keys: [], engines });
    expect({ result: report.result, failed: report.failed, uncheckable: report.uncheckable }).toEqual({ result: 'VALID', failed: [], uncheckable: [] });
    expect(first.bundle.artifacts.passport.reviewer).toEqual({ id: 'bob', email: 'bob@example.invalid' });
    // For the offline Go check (CI and docs/EVIDENCE_WORKFLOW_E2E.md): write the exported bundle when asked
    if (process.env.WORKSPACE_BUNDLE_OUT) (await import('node:fs')).writeFileSync(process.env.WORKSPACE_BUNDLE_OUT, JSON.stringify(first.bundle, null, 2));

    // Re-export (e.g. after a redeploy): same passport hash, the export itself audited again
    const again = await exportDecision(alice, 'ws-a', dec.id);
    expect(again.firstExport).toBe(false);
    expect(again.bundle.integrity.passport_sha256).toBe(first.bundle.integrity.passport_sha256);

    const events = (await listAudit(bob, 'ws-a')).map((e) => `${e.changeType}:${e.actorId}`);
    expect(events).toEqual(['IMPORTED:alice', 'PROPOSED:alice', 'APPROVED:bob', 'EXPORTED:dave', 'EXPORTED:alice']);
    expect((await listDecisions(dave, 'ws-a'))[0].status).toBe('approved');
  });

  it('isolates tenants: no reads or writes across workspaces, through the server or directly', async () => {
    const doc = await importDocument(alice, 'ws-a', memo);
    await importDocument(carol, 'ws-b', memo);
    expect(await code(listDocuments(carol, 'ws-a'))).toBe('NOT_A_MEMBER');
    // Bypassing the server check with a forged claim map in the actor object does not help: the token decides
    const sneaky = { ...carol, tenants: { 'ws-a': 'editor' as const } };
    expect(await code(listDocuments(sneaky, 'ws-a'))).toBe('DENIED_BY_RULES');
    expect(await code(getDocument(sneaky, 'ws-a', doc.id))).toBe('DENIED_BY_RULES');
    expect(await code(importDocument(sneaky, 'ws-a', memo))).toBe('DENIED_BY_RULES');
    expect((await listDocuments(alice, 'ws-a')).length).toBe(1);
    // Losing the claim (owner removes it, token refreshed) removes access
    const aliceAfter = actor('alice', {});
    expect(await code(listDocuments({ ...aliceAfter, tenants: { 'ws-a': 'editor' } }, 'ws-a'))).toBe('DENIED_BY_RULES');
  });

  it('members-document membership (console-managed) works alongside the claim', async () => {
    await seed('tenants/ws-c/members/erin', { role: 'editor' });
    const erinClaimless = { ...actor('erin', {}), tenants: { 'ws-c': 'editor' as const } };
    expect(await code(importDocument(erinClaimless, 'ws-c', memo))).toBe('OK');
  });

  it('rules: documents are immutable, the audit log is append-only and tied to its change, members stay unwritable', async () => {
    const doc = await importDocument(alice, 'ws-a', memo);
    const db = raw(alice);
    expect(await code(db.commit([{ collection: 'tenants/ws-a/documents', id: doc.id, fields: { ...doc, text: 'edited' } as never }]))).toBe('DENIED');
    expect(await code(db.commit([{ collection: 'tenants/ws-a/audit', id: doc.auditId, fields: { detail: 'edited' } }]))).toBe('DENIED');
    // An audit event claiming an import that is not in the same batch
    expect(await code(db.commit([{ collection: 'tenants/ws-a/audit', id: 'aud_lonely000001', fields: { id: 'aud_lonely000001', tenant: 'ws-a', changeType: 'IMPORTED', entityType: 'DOCUMENT', entityId: 'doc_nothere00001', actorId: 'alice', actorEmail: null, at: 'x', detail: '' } }]))).toBe('DENIED');
    // A document without its audit event
    expect(await code(db.commit([{ collection: 'tenants/ws-a/documents', id: 'doc_noaudit00001', fields: { ...doc, id: 'doc_noaudit00001', auditId: 'aud_missing00001' } as never }]))).toBe('DENIED');
    // Importing as someone else
    expect(await code(raw(bob).commit([{ collection: 'tenants/ws-a/documents', id: 'doc_spoof0000001', fields: { ...doc, id: 'doc_spoof0000001', importedBy: 'alice', auditId: 'aud_spoof0000001' } as never }, { collection: 'tenants/ws-a/audit', id: 'aud_spoof0000001', fields: { id: 'aud_spoof0000001', tenant: 'ws-a', changeType: 'IMPORTED', entityType: 'DOCUMENT', entityId: 'doc_spoof0000001', actorId: 'alice', actorEmail: null, at: 'x', detail: '' } }]))).toBe('DENIED');
    expect(await code(db.commit([{ collection: 'tenants/ws-a/members', id: 'mallory', fields: { role: 'editor' } }]))).toBe('DENIED');
    // A proposal created directly as already approved
    expect(await code(db.commit([{ collection: 'tenants/ws-a/decisions', id: 'dec_preapproved1', fields: { id: 'dec_preapproved1', tenant: 'ws-a', status: 'approved', proposedBy: 'alice', decidedBy: 'alice', proposalAuditId: 'aud_pre000000001' } }, { collection: 'tenants/ws-a/audit', id: 'aud_pre000000001', fields: { id: 'aud_pre000000001', tenant: 'ws-a', changeType: 'PROPOSED', entityType: 'DECISION', entityId: 'dec_preapproved1', actorId: 'alice', actorEmail: null, at: 'x', detail: '' } }]))).toBe('DENIED');
  });
});

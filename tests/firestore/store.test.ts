/**
 * The durable editorial workflow on Firestore with no admin key (ADR 0001): every write carries the acting user's
 * own ID token and passes firestore.rules in the emulator. Reading back through a fresh store with an empty
 * curated overlay stands in for a new server process after a redeploy; durable.test.ts restarts the database too.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { RevisionError, decideProposal, proposeChallenge } from '@/lib/evidence/revisions';
import { setStore, storeFor } from '@/lib/evidence/store';
import { FirestoreEvidenceStore } from '@/lib/evidence/store/firestore-store';
import { FirestoreRequestError } from '@/lib/firebase/firestore-rest';
import { ON_EMULATOR, adminDb, clearEmulator, publicDb } from './emulator';
import { withIdToken } from '@/lib/auth/actor';
import { mockToken } from './emulator';
import { anonymous, auditor, contributor, editor, provider, runWorkflow, seedCurated } from './workflow';

describe.skipIf(!ON_EMULATOR)('Firestore store under the security rules (emulator, no admin key)', () => {
  beforeEach(async () => {
    await clearEmulator();
    setStore(new FirestoreEvidenceStore(publicDb()));
  });

  it('keeps curated demonstrations in the overlay and writes nothing to Firestore without a user', async () => {
    const a = await seedCurated();
    expect((await storeFor(anonymous).getAnalysisBySlug('daniel/12/1'))?.id).toBe(a.id);
    expect(await adminDb().query('evidence_analyses', [])).toHaveLength(0);
    expect(await adminDb().query('evidence_audit', [])).toHaveLength(0);
  });

  it('anonymous visitors cannot propose; the proposer cannot approve their own proposal', async () => {
    const a = await seedCurated();
    await expect(proposeChallenge(a.claims[0].id, anonymous, { provider })).rejects.toMatchObject({ code: 'unauthenticated' });
    const { proposal } = await proposeChallenge(a.claims[0].id, contributor, { provider });
    await expect(decideProposal(proposal.id, 'approve', withIdToken({ ...editor, id: 'alice' }, mockToken('alice', { am_role: 'research_editor' })), 'self')).rejects.toBeInstanceOf(RevisionError);
    // Bypassing the app: the contributor commits the decision batch with their own token: the rules refuse it
    const store = storeFor(contributor) as FirestoreEvidenceStore;
    await expect(
      store.commitDecision({
        proposalId: proposal.id,
        from: 'proposed',
        patch: { status: 'approved', decidedBy: 'alice', decidedRole: 'research_editor', decidedAt: 'now', decisionReason: 'self' },
        audit: { id: 'forged', entityType: 'CLAIM', entityId: a.claims[0].id, changeType: 'APPROVED', oldValue: null, newValue: null, reason: 'self', modelProvider: null, modelVersion: null, promptVersion: null, timestamp: 'now', actorId: 'alice', actorRole: 'research_editor' },
        analysis: { next: { ...a, title: 'Forged', updatedAt: '2030-01-01T00:00:00.000Z' }, expectedUpdatedAt: (await storeFor(anonymous).getAnalysis(a.id))!.updatedAt },
      }),
    ).rejects.toBeInstanceOf(FirestoreRequestError);
    expect(await adminDb().get('evidence_analyses', a.id)).toBeNull();
    expect((await adminDb().get('evidence_challenge_proposals', proposal.id))?.fields.status).toBe('proposed');
  });

  it('runs draft → propose → review → approve → audit, atomically, and reads it back from a fresh process', async () => {
    const { analysis, claimId, proposalId } = await runWorkflow();
    // Durable in Firestore
    const stored = await adminDb().get('evidence_analyses', analysis.id);
    expect(stored?.fields.lastProposalId).toBe(proposalId);
    const proposal = await adminDb().get('evidence_challenge_proposals', proposalId);
    expect(proposal?.fields).toMatchObject({ status: 'approved', decidedBy: 'ed', proposedBy: 'alice' });
    const audit = (await adminDb().query('evidence_audit', [])).map((d) => d.fields.changeType).sort();
    expect(audit).toEqual(['APPROVED', 'DRAFTED', 'PROPOSED']);
    // A second decision loses the compare-and-set and writes nothing
    await expect(decideProposal(proposalId, 'reject', editor, 'late')).rejects.toMatchObject({ code: 'invalid_state' });

    // "Redeploy": a new process, empty overlay, no seeding: the approved revision is read from Firestore
    const fresh = new FirestoreEvidenceStore(publicDb());
    const after = await fresh.getAnalysis(analysis.id);
    expect(after?.updatedAt).not.toBe(analysis.updatedAt);
    expect(after?.claims[0]).toEqual(JSON.parse(String(proposal?.fields.json)).revisedClaim);
    // The submission is stored as proposed; only the decision fields changed
    expect(JSON.parse(String(proposal?.fields.json)).status).toBe('proposed');
    expect((await fresh.forActor(editor).getProposal(proposalId))?.decisionReason).toBe('Reviewed against the cited sources.');
    expect(await fresh.listChallenges(claimId)).toHaveLength(1);
    expect((await fresh.forActor(contributor).getDraft('draft-1'))?.createdBy).toBe('alice');
    expect((await fresh.forActor(auditor).listAudit(claimId)).map((r) => r.changeType)).toContain('APPROVED');
    // Audit and proposals are not public
    await expect(fresh.getProposal(proposalId)).rejects.toBeInstanceOf(FirestoreRequestError);
  });
});

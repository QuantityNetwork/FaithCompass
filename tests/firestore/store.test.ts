/**
 * FirestoreEvidenceStore against the emulator, and the durable editorial workflow from ADR 0001:
 * create a draft, propose, review, approve, audit, then read everything back through a fresh store instance
 * (a new server process, as after a redeploy). The restart across emulator processes is in durable.test.ts.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { Actor } from '@/lib/auth/actor';
import { runAnalysis } from '@/lib/evidence/pipeline';
import { CorpusReasoningProvider } from '@/lib/evidence/providers/corpus';
import { decideProposal, proposeChallenge } from '@/lib/evidence/revisions';
import { DANIEL_12_1 } from '@/lib/evidence/seed/daniel-12-1';
import { setStore } from '@/lib/evidence/store';
import { FirestoreEvidenceStore } from '@/lib/evidence/store/firestore-store';
import { ON_EMULATOR, adminDb, clearEmulator } from './emulator';

const provider = new CorpusReasoningProvider();
const contributor: Actor = { id: 'alice', role: 'research_contributor', authenticated: true, via: 'supabase' };
const editor: Actor = { id: 'ed', role: 'research_editor', authenticated: true, via: 'supabase' };

let store: FirestoreEvidenceStore;

async function seedDaniel() {
  const r = await runAnalysis({ query: DANIEL_12_1.aliases[0], reference: DANIEL_12_1.reference, passageText: DANIEL_12_1.passageText }, provider);
  return r.analysis!;
}

describe.skipIf(!ON_EMULATOR)('FirestoreEvidenceStore (emulator)', () => {
  beforeEach(async () => {
    await clearEmulator();
    store = new FirestoreEvidenceStore(adminDb());
    setStore(store);
  });

  it('is durable and round-trips an analysis unchanged, by id, slug and claim', async () => {
    expect(store.durable).toBe(true);
    const a = await seedDaniel();
    expect(await store.getAnalysis(a.id)).toEqual(a);
    expect((await store.getAnalysisBySlug('/daniel/12/1/'))?.id).toBe(a.id);
    const found = await store.findClaim(a.claims[1].id);
    expect(found?.claimIndex).toBe(1);
    expect(await store.listAnalyses()).toHaveLength(1);
    expect(await store.getAnalysis('nope')).toBeNull();
    // Seeding twice upserts rather than duplicating
    await seedDaniel();
    expect(await store.listAnalyses()).toHaveLength(1);
  });

  it('compare-and-set: a stale version writes nothing', async () => {
    const a = await seedDaniel();
    const next = { ...a, title: 'Changed', updatedAt: '2030-01-01T00:00:00.000Z' };
    expect(await store.replaceAnalysisIfVersion(next, 'stale')).toBe(false);
    expect(await store.replaceAnalysisIfVersion(next, a.updatedAt)).toBe(true);
    expect(await store.replaceAnalysisIfVersion({ ...next, title: 'Again' }, a.updatedAt)).toBe(false);
    expect((await store.getAnalysis(a.id))?.title).toBe('Changed');
  });

  it('append-only: audit records, proposals and drafts are never overwritten', async () => {
    const rec = { id: 'au-1', entityType: 'ANALYSIS' as const, entityId: 'a', changeType: 'CREATED' as const, oldValue: null, newValue: null, reason: 'r', modelProvider: null, modelVersion: null, promptVersion: null, timestamp: '2026-10-20T00:00:00Z' };
    await store.appendAudit(rec);
    await expect(store.appendAudit({ ...rec, reason: 'rewritten' })).rejects.toThrow(/already exists/);
    expect((await store.listAudit('a'))[0].reason).toBe('r');
  });

  it('runs the durable workflow: draft, propose, review, approve, audit, and reads it back from a new instance', async () => {
    const a = await seedDaniel();
    const claimId = a.claims[0].id;
    // Draft
    await store.saveDraft({ id: 'draft-1', status: 'draft', createdBy: 'alice', creatorRole: 'research_contributor', analysis: a, createdAt: '2026-10-20T19:00:00Z' });
    // Propose (never touches the canonical analysis)
    const { proposal } = await proposeChallenge(claimId, contributor, { provider });
    expect((await store.getAnalysis(a.id))).toEqual(a);
    expect((await store.getProposal(proposal.id))?.status).toBe('proposed');
    // The proposer cannot approve their own proposal
    await expect(decideProposal(proposal.id, 'approve', { ...editor, id: 'alice' }, 'self')).rejects.toThrow();
    // Review and approve by someone else
    await decideProposal(proposal.id, 'approve', editor, 'Reviewed against the cited sources.');
    const decided = await store.getProposal(proposal.id);
    expect(decided).toMatchObject({ status: 'approved', decidedBy: 'ed' });
    // A second decision loses the compare-and-set
    expect(await store.transitionProposal(proposal.id, 'proposed', { status: 'rejected', decidedBy: 'x', decidedRole: 'research_editor', decidedAt: 'now', decisionReason: 'late' })).toBe(false);
    const after = await store.getAnalysis(a.id);
    expect(after?.updatedAt).not.toBe(a.updatedAt);
    const audit = [...(await store.listAudit(proposal.id)), ...(await store.listAudit(claimId))];
    expect(audit.map((r) => r.changeType)).toEqual(expect.arrayContaining(['PROPOSED', 'APPROVED']));

    // "Redeploy": a new process with a new client reads exactly the same state
    const fresh = new FirestoreEvidenceStore(adminDb());
    expect(await fresh.getAnalysis(a.id)).toEqual(after);
    expect(await fresh.getProposal(proposal.id)).toEqual(decided);
    expect(await fresh.getDraft('draft-1')).toMatchObject({ id: 'draft-1', createdBy: 'alice' });
    expect(await fresh.listChallenges(claimId)).toHaveLength(1);
    expect((await fresh.listAudit(proposal.id)).length).toBeGreaterThan(0);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseEvidenceStore } from '@/lib/evidence/store/supabase-store';
import { runAnalysis } from '@/lib/evidence/pipeline';
import { proposeChallenge, decideProposal } from '@/lib/evidence/revisions';
import type { Actor } from '@/lib/auth/actor';
import { CorpusReasoningProvider } from '@/lib/evidence/providers/corpus';
import { setStore } from '@/lib/evidence/store';
import { DANIEL_12_1 } from '@/lib/evidence/seed/daniel-12-1';
import { FakeSupabaseClient } from './helpers/fake-supabase';

const provider = new CorpusReasoningProvider();
const visitor: Actor = { id: null, role: 'public_reader', authenticated: false, via: 'none' };
const editor: Actor = { id: 'editor-1', role: 'research_editor', authenticated: true, via: 'supabase' };

async function challengeAndApprove(claimId: string) {
  const { proposal } = await proposeChallenge(claimId, visitor, { provider });
  await decideProposal(proposal.id, 'approve', editor, 'Reviewed against the cited sources.');
  return proposal;
}

let fake: FakeSupabaseClient;
let store: SupabaseEvidenceStore;

beforeEach(() => {
  fake = new FakeSupabaseClient();
  store = new SupabaseEvidenceStore(fake as unknown as SupabaseClient);
  setStore(store);
});

async function seedDaniel() {
  const result = await runAnalysis(
    {
      query: DANIEL_12_1.aliases[0],
      reference: DANIEL_12_1.reference,
      passageText: DANIEL_12_1.passageText,
    },
    provider,
  );
  return result.analysis!;
}

describe('round-tripping an analysis', () => {
  it('stores and reloads an analysis unchanged', async () => {
    const analysis = await seedDaniel();
    const loaded = await store.getAnalysis(analysis.id);
    expect(loaded).toEqual(analysis);
  });

  it('lifts the query columns out of the document', async () => {
    const analysis = await seedDaniel();
    const [row] = fake.rowsIn('evidence_analyses');

    expect(row.id).toBe(analysis.id);
    expect(row.slug).toBe('daniel/12/1');
    expect(row.model_provider).toBe('corpus');
    expect(row.prompt_version).toBe(analysis.promptVersion);
    expect(row.seeded).toBe(true);
    expect(row.claim_ids).toEqual(analysis.claims.map((c) => c.id));
  });

  it('resolves an analysis by passage slug', async () => {
    await seedDaniel();
    const found = await store.getAnalysisBySlug('daniel/12/1');
    expect(found?.title).toBe('Daniel 12:1');
  });

  it('tolerates surrounding slashes on a slug', async () => {
    await seedDaniel();
    expect(await store.getAnalysisBySlug('/daniel/12/1/')).not.toBeNull();
  });

  it('returns null for an analysis that does not exist', async () => {
    expect(await store.getAnalysis('nope')).toBeNull();
    expect(await store.getAnalysisBySlug('no/such/passage')).toBeNull();
  });

  it('upserts rather than duplicating when seeding runs twice', async () => {
    await seedDaniel();
    await seedDaniel();
    // Concurrent cold starts both seed; identical curated content must not
    // produce two rows.
    expect(fake.rowsIn('evidence_analyses')).toHaveLength(1);
  });
});

describe('finding a claim', () => {
  it('resolves a claim to its analysis through the claim_ids index', async () => {
    const analysis = await seedDaniel();
    const target = analysis.claims[3];

    const found = await store.findClaim(target.id);
    expect(found).not.toBeNull();
    expect(found!.analysis.id).toBe(analysis.id);
    expect(found!.analysis.claims[found!.claimIndex].id).toBe(target.id);
  });

  it('returns null for an unknown claim', async () => {
    await seedDaniel();
    expect(await store.findClaim('no-such-claim')).toBeNull();
  });

  it('raises rather than hiding an index that disagrees with the document', async () => {
    const analysis = await seedDaniel();
    const [row] = fake.rowsIn('evidence_analyses');
    // Simulate the denormalised column drifting out of step with the document.
    (row.claim_ids as string[]).push('ghost-claim');

    await expect(store.findClaim('ghost-claim')).rejects.toThrow(/out of step/);
  });
});

describe('challenges and audit', () => {
  it('persists a challenge and reads it back', async () => {
    const analysis = await seedDaniel();
    const claim = analysis.claims[0];

    await challengeAndApprove(claim.id);

    const history = await store.listChallenges(claim.id);
    expect(history).toHaveLength(1);
    expect(history[0].previousScore).toBe(claim.overallConfidence);
  });

  it('keeps the previous score queryable as a column, not only inside the payload', async () => {
    const analysis = await seedDaniel();
    const claim = analysis.claims[0];
    await challengeAndApprove(claim.id);

    const [row] = fake.rowsIn('evidence_challenges');
    expect(row.previous_score).toBe(claim.overallConfidence);
    expect(row.claim_id).toBe(claim.id);
    expect(['LOWERED', 'RAISED', 'UNCHANGED']).toContain(row.outcome);
  });

  it('keeps a proposal out of the published analysis until an editor approves it', async () => {
    const analysis = await seedDaniel();
    const claim = analysis.claims[0];
    const { proposal } = await proposeChallenge(claim.id, visitor, { provider });

    expect((await store.getAnalysis(analysis.id))!).toEqual(analysis);
    expect(fake.rowsIn('evidence_challenge_proposals')[0].status).toBe('proposed');

    await decideProposal(proposal.id, 'approve', editor, 'Reviewed against the cited sources.');
    const reloaded = await store.getAnalysis(analysis.id);
    expect(reloaded!.claims[0].overallConfidence).toBe(proposal.challenge.revisedScore);
    expect(fake.rowsIn('evidence_challenge_proposals')[0].status).toBe('approved');
  });

  it('refuses a conditional update against a stale version', async () => {
    const analysis = await seedDaniel();
    const ok = await store.replaceAnalysisIfVersion({ ...analysis, updatedAt: '2099-01-01T00:00:00.000Z' }, 'not-the-version');
    expect(ok).toBe(false);
    expect(await store.getAnalysis(analysis.id)).toEqual(analysis);
  });

  it('records the model and prompt versions on every audit row', async () => {
    const analysis = await seedDaniel();
    const audit = await store.listAudit(analysis.id);

    expect(audit.length).toBeGreaterThan(0);
    const created = audit.find((a) => a.changeType === 'CREATED')!;
    expect(created.promptVersion).toBe(analysis.promptVersion);
    expect(created.modelProvider).toBe('corpus');
  });
});

describe('failure handling', () => {
  it('surfaces a database error instead of returning empty results', async () => {
    fake.breakTable('evidence_analyses', 'connection refused');
    await expect(store.getAnalysis('anything')).rejects.toThrow(/connection refused/);
    await expect(store.listAnalyses()).rejects.toThrow(/Failed to list analyses/);
  });

  it('surfaces a failed write rather than silently dropping the analysis', async () => {
    fake.breakTable('evidence_analyses', 'permission denied for table');
    await expect(seedDaniel()).rejects.toThrow(/permission denied/);
  });

  it('rejects a stored document that does not satisfy the current schema', async () => {
    await seedDaniel();
    const [row] = fake.rowsIn('evidence_analyses');
    // A row written by an older schema version, or edited by hand.
    (row.data as Record<string, unknown>).claims = 'not an array';

    await expect(store.listAnalyses()).rejects.toThrow();
  });
});

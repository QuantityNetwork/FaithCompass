/**
 * Durability across a full restart of the database process (ADR 0001, step 8). `npm run test:firestore:durable`
 * runs phase "write" in one emulator process (exported on exit), then phase "read" in a new emulator process that
 * imports the export: the record written by the workflow must read back identically.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Actor } from '@/lib/auth/actor';
import { canonicalJson, sha256 } from '@/lib/decision/canonical';
import { runAnalysis } from '@/lib/evidence/pipeline';
import { CorpusReasoningProvider } from '@/lib/evidence/providers/corpus';
import { decideProposal, proposeChallenge } from '@/lib/evidence/revisions';
import { DANIEL_12_1 } from '@/lib/evidence/seed/daniel-12-1';
import { setStore } from '@/lib/evidence/store';
import { FirestoreEvidenceStore } from '@/lib/evidence/store/firestore-store';
import { ON_EMULATOR, adminDb, clearEmulator } from './emulator';

const PHASE = process.env.DURABLE_PHASE;
const MANIFEST = process.env.DURABLE_MANIFEST || '/tmp/abrahammoses-durable.json';

async function snapshot(store: FirestoreEvidenceStore, ids: { analysis: string; proposal: string; claim: string }) {
  return sha256(
    canonicalJson({
      analysis: await store.getAnalysis(ids.analysis),
      proposal: await store.getProposal(ids.proposal),
      challenges: await store.listChallenges(ids.claim),
      audit: [...(await store.listAudit(ids.proposal)), ...(await store.listAudit(ids.claim))],
    }),
  );
}

describe.skipIf(!ON_EMULATOR || !PHASE)('durable workflow across a database restart', () => {
  it(`phase ${PHASE}`, async () => {
    const store = new FirestoreEvidenceStore(adminDb());
    setStore(store);
    if (PHASE === 'write') {
      await clearEmulator();
      const provider = new CorpusReasoningProvider();
      const r = await runAnalysis({ query: DANIEL_12_1.aliases[0], reference: DANIEL_12_1.reference, passageText: DANIEL_12_1.passageText }, provider);
      const a = r.analysis!;
      const contributor: Actor = { id: 'alice', role: 'research_contributor', authenticated: true, via: 'supabase' };
      const editor: Actor = { id: 'ed', role: 'research_editor', authenticated: true, via: 'supabase' };
      const { proposal } = await proposeChallenge(a.claims[0].id, contributor, { provider });
      await decideProposal(proposal.id, 'approve', editor, 'Reviewed against the cited sources.');
      const ids = { analysis: a.id, proposal: proposal.id, claim: a.claims[0].id };
      writeFileSync(MANIFEST, JSON.stringify({ ids, sha256: await snapshot(store, ids) }));
    } else {
      const { ids, sha256: expected } = JSON.parse(readFileSync(MANIFEST, 'utf8'));
      expect((await store.getProposal(ids.proposal))?.status).toBe('approved');
      expect(await snapshot(store, ids)).toBe(expected);
    }
  });
});

/**
 * Durability across a full restart of the database process (ADR 0001, step 8). `npm run test:firestore:durable`
 * runs phase "write" in one emulator process (exported on exit), then phase "read" in a new emulator process that
 * imports the export: the record written by the workflow, under the users' own tokens, must read back identically.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canonicalJson, sha256 } from '@/lib/decision/canonical';
import { setStore } from '@/lib/evidence/store';
import { FirestoreEvidenceStore } from '@/lib/evidence/store/firestore-store';
import { ON_EMULATOR, clearEmulator, publicDb } from './emulator';
import { auditor, editor, runWorkflow } from './workflow';

const PHASE = process.env.DURABLE_PHASE;
const MANIFEST = process.env.DURABLE_MANIFEST || '/tmp/abrahammoses-durable.json';

async function snapshot(ids: { analysis: string; proposal: string; claim: string }) {
  // A fresh store with an empty overlay: only what Firestore holds
  const store = new FirestoreEvidenceStore(publicDb());
  return sha256(
    canonicalJson({
      analysis: await store.getAnalysis(ids.analysis),
      proposal: await store.forActor(editor).getProposal(ids.proposal),
      challenges: await store.listChallenges(ids.claim),
      audit: [...(await store.forActor(auditor).listAudit(ids.proposal)), ...(await store.forActor(auditor).listAudit(ids.claim))],
    }),
  );
}

describe.skipIf(!ON_EMULATOR || !PHASE)('durable workflow across a database restart', () => {
  it(`phase ${PHASE}`, async () => {
    if (PHASE === 'write') {
      await clearEmulator();
      setStore(new FirestoreEvidenceStore(publicDb()));
      const r = await runWorkflow();
      const ids = { analysis: r.analysis.id, proposal: r.proposalId, claim: r.claimId };
      writeFileSync(MANIFEST, JSON.stringify({ ids, sha256: await snapshot(ids) }));
    } else {
      const { ids, sha256: expected } = JSON.parse(readFileSync(MANIFEST, 'utf8'));
      expect((await new FirestoreEvidenceStore(publicDb()).forActor(editor).getProposal(ids.proposal))?.status).toBe('approved');
      expect(await snapshot(ids)).toBe(expected);
    }
  });
});

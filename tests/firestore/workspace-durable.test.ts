/**
 * Workspace record across a full restart of the database process ("retrieval after a redeploy"): phase "write" runs
 * the two-person workflow and exports a passport; phase "read", in a new emulator process started from the export,
 * reads the decision back and re-exports it to the same passport hash. Run by scripts/firestore-durable.sh.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FirestoreRest } from '@/lib/firebase/firestore-rest';
import type { WorkspaceActor } from '@/lib/workspace/access';
import { parseImport, type TenantRole } from '@/lib/workspace/model';
import { decide, exportDecision, getDecision, importDocument, listAudit, proposeDecision } from '@/lib/workspace/store';
import { HOST, ON_EMULATOR, PROJECT, clearEmulator, mockToken } from './emulator';

const PHASE = process.env.DURABLE_PHASE;
const MANIFEST = process.env.WORKSPACE_DURABLE_MANIFEST || '/tmp/abrahammoses-workspace-durable.json';

function actor(uid: string, tenants: Record<string, TenantRole>): WorkspaceActor {
  return { uid, email: `${uid}@example.invalid`, tenants, db: new FirestoreRest({ projectId: PROJECT, emulatorHost: HOST }, mockToken(uid, { am_tenants: tenants })) };
}
const alice = actor('alice', { 'ws-durable': 'editor' });
const bob = actor('bob', { 'ws-durable': 'editor' });

describe.skipIf(!ON_EMULATOR || !PHASE)('workspace record across a database restart', () => {
  it(`phase ${PHASE}`, async () => {
    if (PHASE === 'write') {
      await clearEmulator();
      const doc = await importDocument(alice, 'ws-durable', parseImport({ filename: 'n.txt', bytes: new TextEncoder().encode('One.\n\nTwo.') }));
      const d = await proposeDecision(alice, 'ws-durable', { title: 'Durable', question: 'Survives?', conclusion: 'It should.', rationale: '', evidence: [{ documentId: doc.id, passage: 2, note: '' }] });
      await decide(bob, 'ws-durable', d.id, { action: 'approve', note: 'Second person.' });
      const { bundle } = await exportDecision(bob, 'ws-durable', d.id);
      writeFileSync(MANIFEST, JSON.stringify({ id: d.id, sha256: bundle.integrity.passport_sha256 }));
    } else {
      const { id, sha256 } = JSON.parse(readFileSync(MANIFEST, 'utf8'));
      expect((await getDecision(bob, 'ws-durable', id)).decision).toMatchObject({ status: 'approved', proposedBy: 'alice', decidedBy: 'bob' });
      const again = await exportDecision(alice, 'ws-durable', id);
      expect(again.firstExport).toBe(false);
      expect(again.bundle.integrity.passport_sha256).toBe(sha256);
      expect((await listAudit(alice, 'ws-durable')).map((e) => e.changeType)).toEqual(['IMPORTED', 'PROPOSED', 'APPROVED', 'EXPORTED', 'EXPORTED']);
    }
  });
});

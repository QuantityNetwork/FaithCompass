import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { analyzeDocument } from '@/lib/deep-analysis/analyze';
import { buildDeepBundle } from '@/lib/deep-analysis/bundle';
import { parseDocument } from '@/lib/deep-analysis/parse';
import { signerFrom, type SignerState } from '@/lib/decision/signing';
import type { RecordAuditEvent, RecordDraft } from '@/lib/passport/record/v1/build';

/** A real Deep Analysis bundle of a fictional sample contract (deterministic layer only, no AI). */
export async function sampleDeepBundle(file = 'sample-service-agreement.md') {
  const doc = await parseDocument(file, new Uint8Array(readFileSync(`public/deep-analysis/samples/${file}`)));
  return buildDeepBundle(await analyzeDocument(doc, { sample: true, now: () => new Date('2026-10-21T09:00:00Z') }));
}

/** An ephemeral Ed25519 signer; the private key lives only in memory for the test. */
export function ephemeralSigner(notBefore: string | null = null): SignerState {
  const { privateKey } = generateKeyPairSync('ed25519');
  return signerFrom(privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(), notBefore);
}

export const pinned = (s: SignerState) => (s.status === 'signing' ? [{ kid: s.signer.keyId, x: s.signer.x, status: 'active' as const, not_before: null, not_after: null }] : []);

export function issuedDraft(binding: RecordDraft['binding'], over: Partial<RecordDraft> = {}): RecordDraft {
  return {
    id: 'pd_test0001',
    status: 'issued',
    binding,
    proposer: { uid: 'uid-proposer', email: 'proposer@example.test', showEmail: false },
    createdAt: '2026-10-21T10:00:00Z',
    submittedAt: '2026-10-21T10:05:00Z',
    reviewer: { uid: 'uid-editor', email: 'editor@example.test', showEmail: true },
    reviewedAt: '2026-10-21T10:30:00Z',
    reviewNote: 'Checked the cited passages against the contract.',
    issuedAt: '2026-10-21T10:31:00Z',
    supersedes: null,
    ...over,
  };
}

export const auditFor = (id: string): RecordAuditEvent[] =>
  [
    ['DRAFTED', 'uid-proposer', '2026-10-21T10:00:00.000Z'],
    ['SUBMITTED', 'uid-proposer', '2026-10-21T10:05:00.000Z'],
    ['APPROVED', 'uid-editor', '2026-10-21T10:30:00.000Z'],
    ['ISSUED', 'uid-editor', '2026-10-21T10:31:00.000Z'],
  ].map(([c, actor, at], i) => ({ id: `au_${i}`, changeType: c, entityType: 'PASSPORT', entityId: id, actorId: actor, at, detail: c.toLowerCase() }));

/**
 * Synthetic workspace record for tests and the conformance fixtures. Placeholder accounts (uid-proposer /
 * uid-editor at example.invalid) and an invented memo: test data only, never shown as real.
 */
import { parseImport, type WorkspaceAuditEvent, type WorkspaceDecision, type WorkspaceDocument } from '@/lib/workspace/model';

const MEMO = `Synthetic test memo (not a real document).

Section 1. The committee reviews each acquisition proposal against the written collection policy.

Section 2. A proposal is accepted only when two members have read the cited sources.

Section 3. Records of each review are kept for ten years.`;

const parsed = parseImport({ filename: 'policy-memo.md', title: 'Synthetic collection policy memo', bytes: new TextEncoder().encode(MEMO) });

export const SAMPLE_DOC: WorkspaceDocument = {
  ...parsed,
  id: 'doc_sample00000000000001',
  tenant: 'sample-tenant',
  importedBy: 'uid-proposer',
  importedByEmail: 'proposer@example.invalid',
  importedAt: '2026-10-21T08:00:00Z',
  auditId: 'aud_sample00000000000001',
};

export const SAMPLE_DECISION: WorkspaceDecision = {
  id: 'dec_sample00000000000001',
  tenant: 'sample-tenant',
  title: 'Two readers per acquisition',
  question: 'Does the policy require two readers before a proposal is accepted?',
  conclusion: 'Yes: section 2 requires two members to have read the cited sources.',
  rationale: 'Section 2 states the condition directly; section 3 governs retention only.',
  evidence: [{ documentId: SAMPLE_DOC.id, passage: 3, passageSha256: parsed.passages[2].sha256, note: 'The two-reader condition.' }],
  status: 'approved',
  proposedBy: 'uid-proposer',
  proposedByEmail: 'proposer@example.invalid',
  proposedAt: '2026-10-21T08:05:00Z',
  proposalAuditId: 'aud_sample00000000000002',
  decidedBy: 'uid-editor',
  decidedByEmail: 'editor@example.invalid',
  decidedAt: '2026-10-21T09:00:00Z',
  decisionNote: 'Checked against section 2 of the memo.',
  decisionAuditId: 'aud_sample00000000000003',
};

export const SAMPLE_AUDIT: WorkspaceAuditEvent[] = [
  { id: 'aud_sample00000000000001', tenant: 'sample-tenant', changeType: 'IMPORTED', entityType: 'DOCUMENT', entityId: SAMPLE_DOC.id, actorId: 'uid-proposer', actorEmail: 'proposer@example.invalid', at: '2026-10-21T08:00:00Z', detail: 'Imported policy-memo.md.' },
  { id: 'aud_sample00000000000002', tenant: 'sample-tenant', changeType: 'PROPOSED', entityType: 'DECISION', entityId: SAMPLE_DECISION.id, actorId: 'uid-proposer', actorEmail: 'proposer@example.invalid', at: '2026-10-21T08:05:00Z', detail: 'Proposed.' },
  { id: 'aud_sample00000000000003', tenant: 'sample-tenant', changeType: 'APPROVED', entityType: 'DECISION', entityId: SAMPLE_DECISION.id, actorId: 'uid-editor', actorEmail: 'editor@example.invalid', at: '2026-10-21T09:00:00Z', detail: 'Checked against section 2 of the memo.' },
  { id: 'aud_sample00000000000004', tenant: 'sample-tenant', changeType: 'EXPORTED', entityType: 'DECISION', entityId: SAMPLE_DECISION.id, actorId: 'uid-editor', actorEmail: 'editor@example.invalid', at: '2026-10-21T09:30:00Z', detail: 'Exported.' },
];

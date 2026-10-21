/**
 * Frozen builder for workspace decision passports (am-workspace-record-1.0.0).
 *
 * Builds the content of a passport bundle (schema 1.0.0, docs/DECISION_PASSPORT_SPEC.md) for one decision of a private
 * workspace: the decision, the cited passages, the source documents, the two-person review and its audit trail.
 * The source hash of this directory is pinned in src/lib/decision/engines (key 'workspace-1.0.0') and in the
 * verifiers' engines.json. Never edit this file; add a v2 directory instead.
 *
 * Pure: no I/O, no clock. The same inputs give the same bytes, so a re-export after a redeploy has the same hash.
 */
import { canonicalJson, sha256 } from '../../../decision/canonical';

export const RECORD_ENGINE_VERSION = 'am-workspace-record-1.0.0';
export const RULESET = 'am-workspace-review/1';
export const REVIEW_RULE =
  'Two-person rule: a decision is proposed by one workspace member and approved or rejected by a different member holding the workspace role editor. Self-approval is refused by the server and by the Firestore security rules.';

const digest = (v: unknown) => sha256(canonicalJson(v));

export interface RecordDocument {
  id: string;
  title: string;
  filename: string;
  mediaType: string;
  bytes: number;
  fileSha256: string;
  text: string;
  textSha256: string;
  passages: { n: number; text: string; sha256: string }[];
  importedBy: string;
  importedByEmail: string | null;
  importedAt: string;
}

export interface RecordDecision {
  id: string;
  title: string;
  question: string;
  conclusion: string;
  rationale: string;
  evidence: { documentId: string; passage: number; passageSha256: string; note: string }[];
  status: 'proposed' | 'approved' | 'rejected';
  proposedBy: string;
  proposedByEmail: string | null;
  proposedAt: string;
  decidedBy: string | null;
  decidedByEmail: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
}

export interface RecordAuditEvent {
  id: string;
  changeType: string;
  entityType: string;
  entityId: string;
  actorId: string;
  actorEmail: string | null;
  at: string;
  detail: string;
}

export interface RecordEngine {
  version: string;
  sha256: string;
  source: string;
}

export interface RecordInput {
  tenant: string;
  decision: RecordDecision;
  documents: RecordDocument[];
  audit: RecordAuditEvent[];
  engine: RecordEngine;
}

export function recordState(input: RecordInput) {
  const d = input.decision;
  // The passport time is the time of the last review step, so the record is reproducible.
  const t = d.decidedAt ?? d.proposedAt;
  return { v: 'W1', k: 'workspace-decision', tenant: input.tenant, d: d.id, s: d.status, t, a: {} as Record<string, never> };
}

export function buildRecord(baseId: string, input: RecordInput) {
  const d = input.decision;
  const state = recordState(input);
  const cited = new Set(d.evidence.map((e) => e.documentId));
  const docs = input.documents.filter((x) => cited.has(x.id)).sort((a, b) => (a.id < b.id ? -1 : 1));
  const documents = docs.map((x) => ({
    id: x.id,
    title: x.title,
    filename: x.filename,
    media_type: x.mediaType,
    bytes: x.bytes,
    file_sha256: x.fileSha256,
    text_sha256: x.textSha256,
    text: x.text,
    imported_by: x.importedBy,
    imported_by_email: x.importedByEmail,
    imported_at: x.importedAt,
  }));
  const inventory = documents.map((x) => ({ id: x.id, title: x.title, filename: x.filename, text_sha256: x.text_sha256, sha256: digest(x) }));
  const evidence = d.evidence.map((e) => {
    const doc = docs.find((x) => x.id === e.documentId);
    const p = doc?.passages.find((q) => q.n === e.passage);
    return { document_id: e.documentId, passage: e.passage, passage_sha256: e.passageSha256, quote: p?.text ?? null, note: e.note };
  });
  const decision = { id: d.id, title: d.title, question: d.question, conclusion: d.conclusion, rationale: d.rationale, evidence };
  const person = (id: string | null, email: string | null) => (id ? { id, email } : null);
  const reviewer = person(d.decidedBy, d.decidedByEmail);
  const relevant = new Set([d.id, ...cited]);
  const audit = input.audit
    .filter((a) => relevant.has(a.entityId) && a.changeType !== 'EXPORTED')
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : 1))
    .map((a) => ({ id: a.id, change: a.changeType, entity: `${a.entityType}:${a.entityId}`, actor: a.actorId, actor_email: a.actorEmail, at: a.at, detail: a.detail }));
  const contentSha = digest(decision);
  const passport = {
    id: baseId,
    format: 'workspace-decision/1',
    title: d.title,
    generated_at: state.t,
    tenant: input.tenant,
    decision,
    status: d.status,
    proposer: person(d.proposedBy, d.proposedByEmail),
    proposed_at: d.proposedAt,
    reviewer,
    decided_at: d.decidedAt,
    decision_note: d.decisionNote,
    review_rule: REVIEW_RULE,
    sources: inventory,
    audit,
    versions: { ruleset: RULESET },
    case: { id: d.id, version: '1', content_sha256: contentSha },
    engine: input.engine,
    limits: [
      'The record shows what was imported, cited, proposed and decided, by which accounts and when. It does not show that the conclusion is correct.',
      'Identities are Firebase Auth accounts of this workspace; the review is internal to the workspace, not an external attestation.',
      'Without a signature the bundle proves internal consistency only; compare the passport hash with one obtained independently.',
    ],
  };
  const lines = [
    `# Decision record: ${d.title}`,
    '',
    `- Workspace: ${input.tenant}`,
    `- Status: ${d.status}`,
    `- Proposed by: ${d.proposedByEmail ?? d.proposedBy} at ${d.proposedAt}`,
    `- Decided by: ${reviewer ? `${reviewer.email ?? reviewer.id} at ${d.decidedAt}` : 'not yet decided'}`,
    `- Review rule: ${REVIEW_RULE}`,
    `- Record engine: ${input.engine.version}, source SHA-256 \`${input.engine.sha256}\``,
    '',
    '## Question',
    '',
    d.question,
    '',
    '## Conclusion',
    '',
    d.conclusion,
    ...(d.rationale ? ['', '## Rationale', '', d.rationale] : []),
    '',
    '## Evidence',
    '',
    ...evidence.map((e, i) => `${i + 1}. ${e.document_id}, passage ${e.passage} (SHA-256 \`${e.passage_sha256.slice(0, 16)}…\`)${e.note ? `: ${e.note}` : ''}\n   > ${(e.quote ?? '(passage not found)').replace(/\n/g, ' ')}`),
    '',
    '## Sources',
    '',
    ...inventory.map((s) => `- ${s.id}: ${s.title} (${s.filename}), text SHA-256 \`${s.text_sha256}\``),
    ...(d.decisionNote ? ['', '## Decision note', '', d.decisionNote] : []),
    '',
    '## Audit trail',
    '',
    ...audit.map((a) => `- ${a.at} ${a.change} ${a.entity} by ${a.actor_email ?? a.actor}`),
    '',
  ];
  return {
    state,
    passport,
    report_markdown: lines.join('\n'),
    sources: { inventory, documents },
    release: { case_id: d.id, case_version: '1', case_archive_sha256: contentSha, ruleset: RULESET, engine: input.engine },
    review: { status: d.status, reviewer, attestations: [] as unknown[] },
  };
}

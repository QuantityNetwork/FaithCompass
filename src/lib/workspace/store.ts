/**
 * Workspace persistence in Firestore, always under the signed-in user's own ID token (no admin key, ADR 0001).
 *
 *   tenants/{t}/documents/{id}   imported source documents (create-only)
 *   tenants/{t}/decisions/{id}   decisions: proposed → approved | rejected (decided once, by a different editor)
 *   tenants/{t}/audit/{id}       append-only events, written in the same batch as the change they record
 *   tenants/{t}/passports/{sha}  exported passport hashes (create-only)
 *
 * Every check here is repeated by firestore.rules; the server checks first only to give clear errors.
 */
import { FirestoreRequestError, type FsDocument, type FsWrite } from '@/lib/firebase/firestore-rest';
import { WorkspaceAccessError, requireMember, type WorkspaceActor } from './access';
import {
  ENTITY_ID,
  TENANT_ID,
  newId,
  type AuditChange,
  type ParsedImport,
  type PassportRecord,
  type WorkspaceAuditEvent,
  type WorkspaceDecision,
  type WorkspaceDocument,
} from './model';
import { buildWorkspaceBundle, type WorkspaceBundle } from './passport';
import type { z } from 'zod';
import type { DecideSchema, ProposeSchema } from './model';

/** ISO time to the second: passport times double as signature issue times (YYYY-MM-DDTHH:MM:SSZ). */
export const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

const col = (t: string, sub: string) => `tenants/${t}/${sub}`;

function checkIds(t: string, id?: string) {
  if (!TENANT_ID.test(t)) throw new WorkspaceAccessError(404, 'NOT_FOUND', 'Unknown workspace.');
  if (id !== undefined && !ENTITY_ID.test(id)) throw new WorkspaceAccessError(404, 'NOT_FOUND', 'Not found.');
}

async function guard<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (e) {
    if (e instanceof FirestoreRequestError && e.httpStatus === 403) {
      throw new WorkspaceAccessError(403, 'DENIED_BY_RULES', 'Refused by the database security rules.');
    }
    throw e;
  }
}

function audit(t: string, actor: WorkspaceActor, changeType: AuditChange, entityType: 'DOCUMENT' | 'DECISION', entityId: string, detail: string, extra: Record<string, unknown> = {}) {
  const id = newId('aud');
  // Millisecond precision so events within one second keep their order.
  const at = new Date().toISOString();
  const event: WorkspaceAuditEvent & Record<string, unknown> = { id, tenant: t, changeType, entityType, entityId, actorId: actor.uid, actorEmail: actor.email, at, detail, ...extra };
  return { id, event, write: { collection: col(t, 'audit'), id, fields: event, precondition: { exists: false } } as FsWrite };
}

const asDoc = (d: FsDocument) => d.fields as unknown as WorkspaceDocument;
const asDecision = (d: FsDocument) => d.fields as unknown as WorkspaceDecision;

export function documentSummary(d: WorkspaceDocument) {
  return {
    id: d.id,
    title: d.title,
    filename: d.filename,
    mediaType: d.mediaType,
    bytes: d.bytes,
    fileSha256: d.fileSha256,
    textSha256: d.textSha256,
    passages: d.passages.length,
    importedBy: d.importedBy,
    importedByEmail: d.importedByEmail,
    importedAt: d.importedAt,
  };
}

export async function listDocuments(actor: WorkspaceActor, t: string) {
  checkIds(t);
  requireMember(actor, t);
  const docs = await guard(actor.db.list(col(t, 'documents')));
  return docs.map(asDoc).sort((a, b) => (a.importedAt < b.importedAt ? 1 : -1));
}

export async function getDocument(actor: WorkspaceActor, t: string, id: string): Promise<WorkspaceDocument> {
  checkIds(t, id);
  requireMember(actor, t);
  const d = await guard(actor.db.get(col(t, 'documents'), id));
  if (!d) throw new WorkspaceAccessError(404, 'NOT_FOUND', 'No such document in this workspace.');
  return asDoc(d);
}

export async function importDocument(actor: WorkspaceActor, t: string, parsed: ParsedImport): Promise<WorkspaceDocument> {
  checkIds(t);
  requireMember(actor, t);
  const id = newId('doc');
  const at = nowIso();
  const a = audit(t, actor, 'IMPORTED', 'DOCUMENT', id, `Imported ${parsed.filename} (${parsed.bytes} bytes, ${parsed.passages.length} passages, file SHA-256 ${parsed.fileSha256}).`);
  const doc: WorkspaceDocument = { ...parsed, id, tenant: t, importedBy: actor.uid, importedByEmail: actor.email, importedAt: at, auditId: a.id };
  const ok = await guard(actor.db.commit([{ collection: col(t, 'documents'), id, fields: doc as unknown as Record<string, unknown>, precondition: { exists: false } }, a.write]));
  if (!ok) throw new WorkspaceAccessError(409, 'CONFLICT', 'The document could not be stored; try again.');
  return doc;
}

export async function listDecisions(actor: WorkspaceActor, t: string) {
  checkIds(t);
  requireMember(actor, t);
  const rows = await guard(actor.db.list(col(t, 'decisions')));
  return rows.map(asDecision).sort((a, b) => (a.proposedAt < b.proposedAt ? 1 : -1));
}

export async function getDecision(actor: WorkspaceActor, t: string, id: string) {
  checkIds(t, id);
  requireMember(actor, t);
  const d = await guard(actor.db.get(col(t, 'decisions'), id));
  if (!d) throw new WorkspaceAccessError(404, 'NOT_FOUND', 'No such decision in this workspace.');
  return { decision: asDecision(d), updateTime: d.updateTime };
}

export async function proposeDecision(actor: WorkspaceActor, t: string, input: z.infer<typeof ProposeSchema>): Promise<WorkspaceDecision> {
  checkIds(t);
  requireMember(actor, t);
  // Every citation must point at an existing passage of a document in this workspace; its hash is recorded.
  const cache = new Map<string, WorkspaceDocument>();
  const evidence = [];
  for (const e of input.evidence) {
    if (!cache.has(e.documentId)) cache.set(e.documentId, await getDocument(actor, t, e.documentId));
    const p = cache.get(e.documentId)!.passages.find((x) => x.n === e.passage);
    if (!p) throw new WorkspaceAccessError(400, 'NO_SUCH_PASSAGE', `Document ${e.documentId} has no passage ${e.passage}.`);
    evidence.push({ documentId: e.documentId, passage: e.passage, passageSha256: p.sha256, note: e.note });
  }
  const id = newId('dec');
  const at = nowIso();
  const a = audit(t, actor, 'PROPOSED', 'DECISION', id, `Proposed "${input.title}" citing ${evidence.length} passage(s).`);
  const decision: WorkspaceDecision = {
    id,
    tenant: t,
    title: input.title,
    question: input.question,
    conclusion: input.conclusion,
    rationale: input.rationale,
    evidence,
    status: 'proposed',
    proposedBy: actor.uid,
    proposedByEmail: actor.email,
    proposedAt: at,
    proposalAuditId: a.id,
    decidedBy: null,
    decidedByEmail: null,
    decidedAt: null,
    decisionNote: null,
    decisionAuditId: null,
  };
  const ok = await guard(actor.db.commit([{ collection: col(t, 'decisions'), id, fields: decision as unknown as Record<string, unknown>, precondition: { exists: false } }, a.write]));
  if (!ok) throw new WorkspaceAccessError(409, 'CONFLICT', 'The decision could not be stored; try again.');
  return decision;
}

export async function decide(actor: WorkspaceActor, t: string, id: string, input: z.infer<typeof DecideSchema>): Promise<WorkspaceDecision> {
  const role = requireMember(actor, t);
  const { decision, updateTime } = await getDecision(actor, t, id);
  if (decision.status !== 'proposed') throw new WorkspaceAccessError(409, 'ALREADY_DECIDED', `This decision was already ${decision.status}.`);
  if (decision.proposedBy === actor.uid) throw new WorkspaceAccessError(403, 'SELF_APPROVAL', 'Two-person rule: the proposer cannot approve or reject their own decision. Another editor of this workspace must review it.');
  if (role !== 'editor') throw new WorkspaceAccessError(403, 'NOT_AN_EDITOR', 'Only a workspace editor can approve or reject a decision.');
  const at = nowIso();
  const status = input.action === 'approve' ? 'approved' : 'rejected';
  const a = audit(t, actor, status === 'approved' ? 'APPROVED' : 'REJECTED', 'DECISION', id, input.note);
  const next: WorkspaceDecision = { ...decision, status, decidedBy: actor.uid, decidedByEmail: actor.email, decidedAt: at, decisionNote: input.note, decisionAuditId: a.id };
  const ok = await guard(actor.db.commit([{ collection: col(t, 'decisions'), id, fields: next as unknown as Record<string, unknown>, precondition: { updateTime } }, a.write]));
  if (!ok) throw new WorkspaceAccessError(409, 'CONFLICT', 'The decision changed while you were reviewing it; reload.');
  return next;
}

export async function listAudit(actor: WorkspaceActor, t: string) {
  checkIds(t);
  requireMember(actor, t);
  const rows = await guard(actor.db.list(col(t, 'audit')));
  return rows.map((r) => r.fields as unknown as WorkspaceAuditEvent).sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : 1));
}

export async function listPassports(actor: WorkspaceActor, t: string) {
  checkIds(t);
  requireMember(actor, t);
  const rows = await guard(actor.db.list(col(t, 'passports')));
  return rows.map((r) => r.fields as unknown as PassportRecord).sort((a, b) => (a.exportedAt < b.exportedAt ? 1 : -1));
}

/** Build the bundle from the stored record and log the export (passport hash recorded once, every export audited). */
export async function exportDecision(actor: WorkspaceActor, t: string, id: string, opts: { redacted?: boolean } = {}): Promise<{ bundle: WorkspaceBundle; firstExport: boolean }> {
  const { decision } = await getDecision(actor, t, id);
  const docIds = [...new Set(decision.evidence.map((e) => e.documentId))];
  const documents = await Promise.all(docIds.map((d) => getDocument(actor, t, d)));
  const events = await listAudit(actor, t);
  const bundle = buildWorkspaceBundle({ tenant: t, decision, documents, audit: events, redacted: opts.redacted });
  const sha = bundle.integrity.passport_sha256;
  const at = nowIso();
  const existing = await guard(actor.db.get(col(t, 'passports'), sha));
  const a = audit(t, actor, 'EXPORTED', 'DECISION', id, `Exported passport ${sha}${opts.redacted ? ' (redacted)' : ''}.`, { passportSha256: sha });
  const writes: FsWrite[] = [];
  if (!existing) {
    const rec: PassportRecord = { sha256: sha, tenant: t, decisionId: id, decisionStatus: decision.status, passportId: bundle.passport_id, exportedBy: actor.uid, exportedAt: at, signed: bundle.artifacts.crypto.signature !== null };
    writes.push({ collection: col(t, 'passports'), id: sha, fields: rec as unknown as Record<string, unknown>, precondition: { exists: false } });
  }
  writes.push(a.write);
  const ok = await guard(actor.db.commit(writes));
  if (!ok) throw new WorkspaceAccessError(409, 'CONFLICT', 'The export could not be recorded; try again.');
  return { bundle, firstExport: !existing };
}

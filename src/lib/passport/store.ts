/**
 * Decision Passport drafts and issuance in Firestore, under the signed-in user's own ID token (no admin key, ADR 0001).
 *
 *   tenants/{t}/passport_drafts/{id}   draft → submitted → approved | rejected → issued → revoked (never deleted)
 *   tenants/{t}/audit/{id}             entityType PASSPORT: DRAFTED, SUBMITTED, APPROVED, REJECTED, ISSUED, REVOKED
 *   issued_passports/{sha}             public registry: hash, ID, key id, issue time, signature (create-only)
 *   passport_revocations/{sha}         public revocations (create-only)
 *
 * Every step is one atomic commit with its audit event; firestore.rules repeats every check (two-person rule, roles,
 * transitions, which fields may change). The rules cannot check an Ed25519 signature: a registry entry or an
 * "issued" draft written around this server carries no valid signature by the published key and fails every
 * verifier, including the registry check of POST /api/passport/verify. The signature is the control.
 */
import { z } from 'zod';
import { canonicalJson } from '@/lib/decision/canonical';
import { configuredSigner, type IssuedSignature, type SignerState } from '@/lib/decision/signing';
import { FirestoreRequestError, type FirestoreRest, type FsDocument, type FsWrite } from '@/lib/firebase/firestore-rest';
import { REVOCATION_REASONS } from '@/lib/passport-bundle/verify';
import { WorkspaceAccessError, requireMember, type WorkspaceActor } from '@/lib/workspace/access';
import { ENTITY_ID, TENANT_ID, newId } from '@/lib/workspace/model';
import { nowIso } from '@/lib/workspace/store';
import { bindDeepAnalysis, buildDaPassportBundle, type DaPassportBundle } from './bundle';
import { CURRENT_POLICY } from './policy';
import type { Binding, RecordAuditEvent, RecordDraft } from './record/v1/build';

export const DRAFTS = 'passport_drafts';
export const REGISTRY = 'issued_passports';
export const REVOCATIONS = 'passport_revocations';
const SHA = /^[0-9a-f]{64}$/;

export type DraftStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'issued' | 'revoked';
export type PassportChange = 'DRAFTED' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'ISSUED' | 'REVOKED';

export interface PassportDraftDoc {
  id: string;
  tenant: string;
  kind: 'deep-analysis';
  title: string;
  reportSha256: string;
  bindingJson: string;
  bindingSha256: string;
  policyVersion: string;
  supersedes: string | null;
  status: DraftStatus;
  createdBy: string;
  /** Stored only with the proposer's consent to show it in the passport. */
  createdByEmail: string | null;
  proposerShowEmail: boolean;
  createdAt: string;
  draftAuditId: string;
  submittedAt: string | null;
  submitAuditId: string | null;
  reviewedBy: string | null;
  reviewedByEmail: string | null;
  reviewerShowEmail: boolean;
  reviewedAt: string | null;
  reviewNote: string | null;
  reviewAuditId: string | null;
  issuedAt: string | null;
  issuedBy: string | null;
  issueAuditId: string | null;
  passportSha256: string | null;
  passportAuditIds: string[];
  signatureJson: string | null;
  kid: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  revocationReason: string | null;
  revokeAuditId: string | null;
}

export interface RegistryEntry {
  sha256: string;
  passportId: string;
  kind: 'deep-analysis';
  tenant: string;
  draftId: string;
  kid: string;
  issuedAt: string;
  signatureValue: string;
  engineVersion: string;
  policyVersion: string;
  supersedes: string | null;
}

export interface RevocationDoc {
  sha256: string;
  reason: (typeof REVOCATION_REASONS)[number];
  supersededBy: string | null;
  revokedAt: string;
  draftId: string;
  tenant: string;
}

export const CreateDraftSchema = z
  .object({
    deepAnalysis: z.unknown(),
    showFilename: z.boolean().default(false),
    showEmail: z.boolean().default(false),
    supersedes: z.string().regex(SHA).nullable().default(null),
  })
  .strict();
export const SubmitSchema = z.object({ action: z.literal('submit') }).strict();
export const ReviewSchema = z.object({ action: z.enum(['approve', 'reject']), note: z.string().trim().min(3).max(2000), showEmail: z.boolean().default(false) }).strict();
export const IssueSchema = z.object({ action: z.literal('issue') }).strict();
export const RevokeSchema = z
  .object({ action: z.literal('revoke'), reason: z.enum(REVOCATION_REASONS), supersededBy: z.string().regex(SHA).nullable().default(null) })
  .strict()
  .refine((r) => (r.reason === 'superseded') === (r.supersededBy !== null), 'supersededBy is required for, and only for, reason superseded');

const col = (t: string) => `tenants/${t}/${DRAFTS}`;
const auditCol = (t: string) => `tenants/${t}/audit`;

function checkIds(t: string, id?: string) {
  if (!TENANT_ID.test(t)) throw new WorkspaceAccessError(404, 'NOT_FOUND', 'Unknown workspace.');
  if (id !== undefined && !ENTITY_ID.test(id)) throw new WorkspaceAccessError(404, 'NOT_FOUND', 'Not found.');
}

async function guard<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (e) {
    if (e instanceof FirestoreRequestError && e.httpStatus === 403) throw new WorkspaceAccessError(403, 'DENIED_BY_RULES', 'Refused by the database security rules.');
    throw e;
  }
}

function auditEvent(t: string, actor: WorkspaceActor, changeType: PassportChange, entityId: string, detail: string, extra: Record<string, unknown> = {}) {
  const id = newId('aud');
  const event = { id, tenant: t, changeType, entityType: 'PASSPORT', entityId, actorId: actor.uid, actorEmail: null, at: new Date().toISOString(), detail, ...extra };
  return { id, event: event as RecordAuditEvent & Record<string, unknown>, write: { collection: auditCol(t), id, fields: event, precondition: { exists: false } } as FsWrite };
}

const asDraft = (d: FsDocument) => d.fields as unknown as PassportDraftDoc;

/** The draft as the record engine sees it. A revoked passport is rebuilt as it was issued. */
export function recordDraftOf(d: PassportDraftDoc): RecordDraft {
  return {
    id: d.id,
    status: d.status === 'revoked' ? 'issued' : d.status,
    binding: JSON.parse(d.bindingJson) as Binding,
    proposer: { uid: d.createdBy, email: d.createdByEmail, showEmail: d.proposerShowEmail },
    createdAt: d.createdAt,
    submittedAt: d.submittedAt,
    reviewer: d.reviewedBy ? { uid: d.reviewedBy, email: d.reviewedByEmail, showEmail: d.reviewerShowEmail } : null,
    reviewedAt: d.reviewedAt,
    reviewNote: d.reviewNote,
    issuedAt: d.issuedAt,
    supersedes: d.supersedes,
  };
}

/** Summary for lists: no binding JSON. */
export function draftSummary(d: PassportDraftDoc) {
  const { bindingJson, signatureJson, ...rest } = d;
  void bindingJson;
  void signatureJson;
  return rest;
}

export async function listDrafts(actor: WorkspaceActor, t: string) {
  checkIds(t);
  requireMember(actor, t);
  const rows = await guard(actor.db.list(col(t)));
  return rows.map(asDraft).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getDraft(actor: WorkspaceActor, t: string, id: string) {
  checkIds(t, id);
  requireMember(actor, t);
  const d = await guard(actor.db.get(col(t), id));
  if (!d) throw new WorkspaceAccessError(404, 'NOT_FOUND', 'No such passport draft in this workspace.');
  return { draft: asDraft(d), updateTime: d.updateTime };
}

async function draftAudit(actor: WorkspaceActor, t: string, id: string): Promise<RecordAuditEvent[]> {
  const rows = await guard(actor.db.list(auditCol(t)));
  return rows.map((r) => r.fields as unknown as RecordAuditEvent).filter((a) => a.entityType === 'PASSPORT' && a.entityId === id);
}

export async function createDraft(actor: WorkspaceActor, t: string, input: z.infer<typeof CreateDraftSchema>): Promise<PassportDraftDoc> {
  checkIds(t);
  requireMember(actor, t);
  if (input.showEmail && (!actor.email || !actor.emailVerified)) throw new WorkspaceAccessError(400, 'EMAIL_NOT_VERIFIED', 'Only a verified email address can be shown in a passport.');
  const bound = bindDeepAnalysis(input.deepAnalysis, { showFilename: input.showFilename });
  if (!bound.ok) throw new WorkspaceAccessError(422, 'BINDING_REFUSED', `The Deep Analysis bundle did not verify: ${bound.problems.join('; ')}`);
  if (input.supersedes) {
    const prev = await guard(actor.db.get(REGISTRY, input.supersedes));
    if (!prev || (prev.fields as unknown as RegistryEntry).tenant !== t) throw new WorkspaceAccessError(400, 'UNKNOWN_SUPERSEDED', 'The superseded passport is not an issued passport of this workspace.');
  }
  const id = newId('pd');
  const at = nowIso();
  const a = auditEvent(t, actor, 'DRAFTED', id, `Drafted a passport for Deep Analysis report ${bound.binding.reportSha256} (${bound.binding.findings.length} findings, ${bound.binding.spans.length} cited spans).`);
  const draft: PassportDraftDoc = {
    id,
    tenant: t,
    kind: 'deep-analysis',
    title: bound.binding.title.slice(0, 300),
    reportSha256: bound.binding.reportSha256,
    bindingJson: bound.json,
    bindingSha256: bound.sha256,
    policyVersion: CURRENT_POLICY.version,
    supersedes: input.supersedes,
    status: 'draft',
    createdBy: actor.uid,
    createdByEmail: input.showEmail ? actor.email : null,
    proposerShowEmail: input.showEmail,
    createdAt: at,
    draftAuditId: a.id,
    submittedAt: null,
    submitAuditId: null,
    reviewedBy: null,
    reviewedByEmail: null,
    reviewerShowEmail: false,
    reviewedAt: null,
    reviewNote: null,
    reviewAuditId: null,
    issuedAt: null,
    issuedBy: null,
    issueAuditId: null,
    passportSha256: null,
    passportAuditIds: [],
    signatureJson: null,
    kid: null,
    revokedAt: null,
    revokedBy: null,
    revocationReason: null,
    revokeAuditId: null,
  };
  const ok = await guard(actor.db.commit([{ collection: col(t), id, fields: draft as unknown as Record<string, unknown>, precondition: { exists: false } }, a.write]));
  if (!ok) throw new WorkspaceAccessError(409, 'CONFLICT', 'The draft could not be stored; try again.');
  return draft;
}

async function update(actor: WorkspaceActor, t: string, next: PassportDraftDoc, updateTime: string, extra: FsWrite[]) {
  const ok = await guard(actor.db.commit([{ collection: col(t), id: next.id, fields: next as unknown as Record<string, unknown>, precondition: { updateTime } }, ...extra]));
  if (!ok) throw new WorkspaceAccessError(409, 'CONFLICT', 'The draft changed meanwhile; reload.');
  return next;
}

export async function submitDraft(actor: WorkspaceActor, t: string, id: string) {
  const { draft, updateTime } = await getDraft(actor, t, id);
  if (draft.status !== 'draft') throw new WorkspaceAccessError(409, 'WRONG_STATE', `The draft is ${draft.status}; only a draft can be submitted.`);
  if (draft.createdBy !== actor.uid) throw new WorkspaceAccessError(403, 'NOT_THE_PROPOSER', 'Only the member who drafted the passport can submit it for review.');
  const a = auditEvent(t, actor, 'SUBMITTED', id, 'Submitted for two-person review.');
  return update(actor, t, { ...draft, status: 'submitted', submittedAt: nowIso(), submitAuditId: a.id }, updateTime, [a.write]);
}

export async function reviewDraft(actor: WorkspaceActor, t: string, id: string, input: z.infer<typeof ReviewSchema>) {
  const role = requireMember(actor, t);
  const { draft, updateTime } = await getDraft(actor, t, id);
  if (draft.status !== 'submitted') throw new WorkspaceAccessError(409, 'WRONG_STATE', `The draft is ${draft.status}; only a submitted draft can be reviewed.`);
  if (draft.createdBy === actor.uid) throw new WorkspaceAccessError(403, 'SELF_APPROVAL', 'Two-person rule: the proposer cannot review their own passport. Another editor of this workspace must review it.');
  if (role !== 'editor') throw new WorkspaceAccessError(403, 'NOT_AN_EDITOR', 'Only a workspace editor can approve or reject a passport draft.');
  if (input.showEmail && (!actor.email || !actor.emailVerified)) throw new WorkspaceAccessError(400, 'EMAIL_NOT_VERIFIED', 'Only a verified email address can be shown in a passport.');
  const status = input.action === 'approve' ? 'approved' : 'rejected';
  const a = auditEvent(t, actor, status === 'approved' ? 'APPROVED' : 'REJECTED', id, input.note);
  return update(
    actor,
    t,
    { ...draft, status, reviewedBy: actor.uid, reviewedByEmail: input.showEmail ? actor.email : null, reviewerShowEmail: input.showEmail, reviewedAt: nowIso(), reviewNote: input.note, reviewAuditId: a.id },
    updateTime,
    [a.write],
  );
}

/** Sign and issue an approved draft. Server-side only; refused without the server's signing key. */
export async function issueDraft(actor: WorkspaceActor, t: string, id: string, signer: SignerState = configuredSigner()): Promise<{ draft: PassportDraftDoc; bundle: DaPassportBundle }> {
  const { draft, updateTime } = await getDraft(actor, t, id);
  if (draft.status !== 'approved') throw new WorkspaceAccessError(409, 'WRONG_STATE', `The draft is ${draft.status}; only an approved draft can be issued.`);
  if (actor.uid !== draft.createdBy && actor.uid !== draft.reviewedBy) throw new WorkspaceAccessError(403, 'NOT_A_PARTY', 'Only the proposer or the reviewer of this draft can issue it.');
  if (!draft.reviewedBy || draft.reviewedBy === draft.createdBy) throw new WorkspaceAccessError(409, 'NO_SECOND_PERSON', 'The draft has no second-person approval.');
  if (signer.status !== 'signing') throw new WorkspaceAccessError(503, 'SIGNING_UNAVAILABLE', 'Issuing needs the server signing key, which is configured only on the production deployment. Drafts can still be exported unsigned.');
  const issuedAt = nowIso();
  // The detail is part of the signed passport, so it cannot name the passport's own hash; the registry entry does.
  const a = auditEvent(t, actor, 'ISSUED', id, `Issued and signed by the server with key ${signer.signer.keyId}.`);
  const events = [...(await draftAudit(actor, t, id)), a.event];
  const rec = recordDraftOf({ ...draft, status: 'issued', issuedAt });
  const bundle = buildDaPassportBundle({ tenant: t, draft: rec, audit: events, signer });
  const sig = bundle.artifacts.crypto.signature!;
  const sha = bundle.integrity.passport_sha256;
  const rebuilt = buildDaPassportBundle({ tenant: t, draft: rec, audit: events, signature: sig });
  if (rebuilt.integrity.passport_sha256 !== sha) throw new Error('passport rebuild mismatch');
  const next: PassportDraftDoc = {
    ...draft,
    status: 'issued',
    issuedAt,
    issuedBy: actor.uid,
    issueAuditId: a.id,
    passportSha256: sha,
    passportAuditIds: events.map((e) => e.id),
    signatureJson: canonicalJson(sig),
    kid: sig.kid,
  };
  const entry: RegistryEntry = {
    sha256: sha,
    passportId: bundle.passport_id,
    kind: 'deep-analysis',
    tenant: t,
    draftId: id,
    kid: sig.kid,
    issuedAt,
    signatureValue: sig.value,
    engineVersion: bundle.artifacts.passport.engine.version,
    policyVersion: bundle.artifacts.passport.policy.version,
    supersedes: draft.supersedes,
  };
  await update(actor, t, next, updateTime, [a.write, { collection: REGISTRY, id: sha, fields: entry as unknown as Record<string, unknown>, precondition: { exists: false } }]);
  return { draft: next, bundle: rebuilt };
}

/** The bundle of a draft (unsigned, labelled DRAFT) or of an issued passport (rebuilt with its stored signature). */
export async function draftBundle(actor: WorkspaceActor, t: string, id: string): Promise<DaPassportBundle> {
  const { draft } = await getDraft(actor, t, id);
  const events = await draftAudit(actor, t, id);
  if (draft.status === 'issued' || draft.status === 'revoked') {
    const keep = new Set(draft.passportAuditIds);
    const sig = JSON.parse(draft.signatureJson ?? 'null') as IssuedSignature | null;
    if (!sig) throw new WorkspaceAccessError(409, 'NO_SIGNATURE', 'The issued draft carries no signature.');
    const b = buildDaPassportBundle({ tenant: t, draft: recordDraftOf(draft), audit: events.filter((e) => keep.has(e.id)), signature: sig });
    if (b.integrity.passport_sha256 !== draft.passportSha256) throw new WorkspaceAccessError(409, 'REBUILD_MISMATCH', 'The stored record no longer rebuilds the issued passport.');
    return b;
  }
  return buildDaPassportBundle({ tenant: t, draft: recordDraftOf(draft), audit: events });
}

export async function revokeDraft(actor: WorkspaceActor, t: string, id: string, input: z.infer<typeof RevokeSchema>) {
  const role = requireMember(actor, t);
  if (role !== 'editor') throw new WorkspaceAccessError(403, 'NOT_AN_EDITOR', 'Only a workspace editor can revoke a passport.');
  const { draft, updateTime } = await getDraft(actor, t, id);
  if (draft.status !== 'issued' || !draft.passportSha256) throw new WorkspaceAccessError(409, 'WRONG_STATE', `The draft is ${draft.status}; only an issued passport can be revoked.`);
  if (input.supersededBy) {
    const succ = await guard(actor.db.get(REGISTRY, input.supersededBy));
    if (!succ || (succ.fields as unknown as RegistryEntry).supersedes !== draft.passportSha256) throw new WorkspaceAccessError(400, 'NOT_A_SUCCESSOR', 'The successor must be an issued passport that names this passport as superseded.');
  }
  const revokedAt = nowIso();
  const a = auditEvent(t, actor, 'REVOKED', id, `Revoked passport ${draft.passportSha256} (${input.reason}).`);
  const rev: RevocationDoc = { sha256: draft.passportSha256, reason: input.reason, supersededBy: input.supersededBy, revokedAt, draftId: id, tenant: t };
  return update(actor, t, { ...draft, status: 'revoked', revokedAt, revokedBy: actor.uid, revocationReason: input.reason, revokeAuditId: a.id }, updateTime, [
    a.write,
    { collection: REVOCATIONS, id: draft.passportSha256, fields: rev as unknown as Record<string, unknown>, precondition: { exists: false } },
  ]);
}

/** Public reads (no sign-in): the registry entry of a hash, a passport ID lookup, and every revocation. */
export async function registryEntry(db: FirestoreRest, sha: string): Promise<RegistryEntry | null> {
  if (!SHA.test(sha)) return null;
  const d = await db.get(REGISTRY, sha);
  return d ? (d.fields as unknown as RegistryEntry) : null;
}
export async function registryByPassportId(db: FirestoreRest, passportId: string): Promise<RegistryEntry | null> {
  const rows = await db.query(REGISTRY, [{ field: 'passportId', op: 'EQUAL', value: passportId }], 1);
  return rows[0] ? (rows[0].fields as unknown as RegistryEntry) : null;
}
export async function revocationOf(db: FirestoreRest, sha: string): Promise<RevocationDoc | null> {
  if (!SHA.test(sha)) return null;
  const d = await db.get(REVOCATIONS, sha);
  return d ? (d.fields as unknown as RevocationDoc) : null;
}
export async function allRevocations(db: FirestoreRest): Promise<RevocationDoc[]> {
  return (await db.list(REVOCATIONS)).map((d) => d.fields as unknown as RevocationDoc);
}

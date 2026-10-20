/**
 * Firestore-backed EvidenceStore (ADR 0001: Firebase, EU region, project abrahammoses-a0a26). No admin key.
 *
 * Every write is made with the acting user's own Firebase ID token, so firestore.rules decide what is allowed:
 * the server can never do more than the user could do directly. Bind a user with `forActor(actor)`.
 *
 * The curated demonstration analyses are produced from code on every cold start (bootstrap.ts) and are not
 * written to Firestore: without a user they are kept in a process-local overlay, which is safe to lose because it
 * is regenerated identically. Firestore documents take precedence over the overlay, so the first approved
 * revision of a curated analysis is stored durably and wins from then on.
 *
 * Each document stores the validated entity as JSON in `json`, plus the fields that queries and rules use.
 * Append-only collections are created with an `exists: false` precondition; compare-and-set uses `updateTime`
 * preconditions; a decision (proposal + analysis + challenge + audit) is one atomic commit, which the rules require.
 */
import type { Actor } from '@/lib/auth/actor';
import { idTokenOf } from '@/lib/auth/actor';
import { FirestoreRest, firestoreConfigFromEnv, type FsDocument, type FsWrite } from '@/lib/firebase/firestore-rest';
import {
  AnalysisDraftSchema,
  AnalysisSchema,
  AssessmentChallengeSchema,
  AuditRecordSchema,
  ChallengeProposalSchema,
  type Analysis,
  type AnalysisDraft,
  type AssessmentChallenge,
  type AuditRecord,
  type ChallengeProposal,
  type ProposalStatus,
} from '../schema';
import { MemoryEvidenceStore } from './memory-store';
import type { DecisionCommit, EvidenceStore } from './types';

export const COLLECTIONS = {
  analyses: 'evidence_analyses',
  challenges: 'evidence_challenges',
  proposals: 'evidence_challenge_proposals',
  drafts: 'evidence_analysis_drafts',
  audit: 'evidence_audit',
} as const;

export class IdentityRequiredError extends Error {
  constructor(what: string) {
    super(`${what} requires a signed-in user: this store writes only with the user's own Firebase ID token.`);
    this.name = 'IdentityRequiredError';
  }
}

function proposalOf(doc: FsDocument): ChallengeProposal {
  const decision = Object.fromEntries(DECISION_KEYS.map((k) => [k, doc.fields[k] ?? null]));
  return ChallengeProposalSchema.parse({ ...(body(doc) as object), ...decision });
}

function body(doc: FsDocument): unknown {
  const raw = doc.fields.json;
  if (typeof raw !== 'string') throw new Error(`Document ${doc.name.split('/').slice(-2).join('/')} has no json body.`);
  return JSON.parse(raw);
}

const newestFirst = (key: string) => (a: { fields: Record<string, unknown> }, b: { fields: Record<string, unknown> }) =>
  String(b.fields[key]).localeCompare(String(a.fields[key]));

function analysisFields(a: Analysis, proposalId: string | null, auditId: string | null) {
  return {
    json: JSON.stringify(a),
    resourceId: a.resourceId,
    slug: a.passageReference?.slug ?? a.resourceId,
    title: a.title,
    claimIds: a.claims.map((c) => c.id),
    seeded: a.seeded,
    updatedAt: a.updatedAt,
    lastProposalId: proposalId,
    lastAuditId: auditId,
  };
}

const DECISION_KEYS = ['status', 'decidedBy', 'decidedRole', 'decidedAt', 'decisionReason'] as const;

/**
 * `json` holds the submission exactly as proposed and never changes (firestore.rules freezes it); the decision lives
 * in its own fields, which are the only ones an editor's update may touch.
 */
function proposalFields(p: ChallengeProposal, decisionAuditId: string | null) {
  const submission = { ...p, status: 'proposed', decidedBy: null, decidedRole: null, decidedAt: null, decisionReason: null };
  return {
    json: JSON.stringify(submission),
    claimId: p.claimId,
    analysisId: p.analysisId,
    status: p.status,
    proposedBy: p.proposedBy,
    proposerRole: p.proposerRole,
    idempotencyKey: p.idempotencyKey,
    decidedBy: p.decidedBy,
    decidedRole: p.decidedRole,
    decidedAt: p.decidedAt,
    decisionReason: p.decisionReason,
    createdAt: p.createdAt,
    decisionAuditId,
  };
}

function auditFields(r: AuditRecord, proposalId: string | null) {
  return {
    json: JSON.stringify(r),
    entityType: r.entityType,
    entityId: r.entityId,
    changeType: r.changeType,
    actorId: r.actorId ?? null,
    proposalId,
    timestamp: r.timestamp,
  };
}

export class FirestoreEvidenceStore implements EvidenceStore {
  readonly durable = true;
  readonly requiresIdentity = true;

  constructor(
    readonly db: FirestoreRest = new FirestoreRest(firestoreConfigFromEnv()),
    /** Curated, regenerated-from-code analyses and their system audit records. Shared by all bound instances. */
    private readonly overlay: MemoryEvidenceStore = new MemoryEvidenceStore(),
  ) {}

  /** The store acting as this user: writes carry the user's ID token; anonymous actors cannot write. */
  forActor(actor: Actor): FirestoreEvidenceStore {
    return new FirestoreEvidenceStore(this.db.as(idTokenOf(actor)), this.overlay);
  }

  private requireUser(what: string): void {
    if (!this.db.authenticated) throw new IdentityRequiredError(what);
  }

  private async create(collection: string, id: string, fields: Record<string, unknown>, what: string): Promise<void> {
    this.requireUser(`Saving a ${what}`);
    const ok = await this.db.commit([{ collection, id, fields, precondition: { exists: false } }]);
    if (!ok) throw new Error(`Failed to save ${what} ${id}: it already exists.`);
  }

  /* ---------- analyses ---------- */

  async saveAnalysis(analysis: Analysis): Promise<void> {
    const v = AnalysisSchema.parse(analysis);
    if (!this.db.authenticated) {
      if (!v.seeded) throw new IdentityRequiredError('Saving a non-curated analysis');
      // Curated demonstration, regenerated from code on every cold start: kept in the overlay, not in Firestore.
      await this.overlay.saveAnalysis(v);
      return;
    }
    throw new Error('Canonical analyses change only through an approved decision (commitDecision).');
  }

  private async current(id: string): Promise<{ analysis: Analysis; doc: FsDocument | null } | null> {
    const doc = await this.db.get(COLLECTIONS.analyses, id);
    if (doc) return { analysis: AnalysisSchema.parse(body(doc)), doc };
    const seeded = await this.overlay.getAnalysis(id);
    return seeded ? { analysis: seeded, doc: null } : null;
  }

  async replaceAnalysisIfVersion(): Promise<boolean> {
    throw new Error('Use commitDecision: on Firestore a revision is applied atomically with its decision and audit record.');
  }

  async getAnalysis(id: string): Promise<Analysis | null> {
    return (await this.current(id))?.analysis ?? null;
  }

  async getAnalysisBySlug(slug: string): Promise<Analysis | null> {
    const s = slug.replace(/^\/+|\/+$/g, '');
    const [hit] = await this.db.query(COLLECTIONS.analyses, [{ field: 'slug', op: 'EQUAL', value: s }], 1);
    const doc = hit ?? (await this.db.query(COLLECTIONS.analyses, [{ field: 'resourceId', op: 'EQUAL', value: s }], 1))[0];
    return doc ? AnalysisSchema.parse(body(doc)) : this.overlay.getAnalysisBySlug(s);
  }

  async listAnalyses(): Promise<Analysis[]> {
    const stored = (await this.db.query(COLLECTIONS.analyses, [])).map((d) => AnalysisSchema.parse(body(d)));
    const ids = new Set(stored.map((a) => a.id));
    const curated = (await this.overlay.listAnalyses()).filter((a) => !ids.has(a.id));
    return [...stored, ...curated].sort((a, b) => a.title.localeCompare(b.title));
  }

  async findClaim(claimId: string): Promise<{ analysis: Analysis; claimIndex: number } | null> {
    const [doc] = await this.db.query(COLLECTIONS.analyses, [{ field: 'claimIds', op: 'ARRAY_CONTAINS', value: claimId }], 1);
    if (!doc) return this.overlay.findClaim(claimId);
    const analysis = AnalysisSchema.parse(body(doc));
    const claimIndex = analysis.claims.findIndex((c) => c.id === claimId);
    if (claimIndex === -1) throw new Error(`Analysis ${analysis.id} is indexed against claim ${claimId} but does not contain it.`);
    return { analysis, claimIndex };
  }

  /* ---------- challenges ---------- */

  async saveChallenge(): Promise<void> {
    throw new Error('Use commitDecision: on Firestore a challenge is recorded atomically with its approval.');
  }

  async listChallenges(claimId: string): Promise<AssessmentChallenge[]> {
    const docs = await this.db.query(COLLECTIONS.challenges, [{ field: 'claimId', op: 'EQUAL', value: claimId }]);
    return docs.sort(newestFirst('createdAt')).map((d) => AssessmentChallengeSchema.parse(body(d)));
  }

  /* ---------- proposals ---------- */

  async saveProposal(proposal: ChallengeProposal): Promise<void> {
    const v = ChallengeProposalSchema.parse(proposal);
    await this.create(COLLECTIONS.proposals, v.id, proposalFields(v, null), 'proposal');
  }

  async getProposal(id: string): Promise<ChallengeProposal | null> {
    const doc = await this.db.get(COLLECTIONS.proposals, id);
    return doc ? proposalOf(doc) : null;
  }

  async findProposalByIdempotencyKey(key: string): Promise<ChallengeProposal | null> {
    if (!this.db.authenticated) return null;
    // Rules let a user read only their own proposals, so the key is scoped to the user.
    const docs = await this.db.query(COLLECTIONS.proposals, [{ field: 'idempotencyKey', op: 'EQUAL', value: key }]).catch(() => []);
    return docs[0] ? proposalOf(docs[0]) : null;
  }

  async listProposals(claimId: string): Promise<ChallengeProposal[]> {
    const docs = await this.db.query(COLLECTIONS.proposals, [{ field: 'claimId', op: 'EQUAL', value: claimId }]);
    return docs.sort(newestFirst('createdAt')).map((d) => proposalOf(d));
  }

  async transitionProposal(): Promise<boolean> {
    throw new Error('Use commitDecision: on Firestore a decision is committed atomically with its audit record.');
  }

  /**
   * One atomic commit for a decision: the proposal moves `from` → `patch.status` (compare-and-set on its
   * updateTime), the audit record is created, and on approval the revised analysis (compare-and-set on its
   * version) and the challenge are written. Returns false, writing nothing, on any concurrent change.
   */
  async commitDecision(d: DecisionCommit): Promise<boolean> {
    this.requireUser('An editorial decision');
    const pdoc = await this.db.get(COLLECTIONS.proposals, d.proposalId);
    if (!pdoc) return false;
    const current = proposalOf(pdoc);
    if (current.status !== d.from) return false;
    const next = ChallengeProposalSchema.parse({ ...current, ...d.patch });
    const writes: FsWrite[] = [
      { collection: COLLECTIONS.proposals, id: d.proposalId, fields: proposalFields(next, d.audit.id), precondition: { updateTime: pdoc.updateTime } },
      { collection: COLLECTIONS.audit, id: d.audit.id, fields: auditFields(AuditRecordSchema.parse(d.audit), d.proposalId), precondition: { exists: false } },
    ];
    if (d.analysis) {
      const v = AnalysisSchema.parse(d.analysis.next);
      const cur = await this.current(v.id);
      if (!cur || cur.analysis.updatedAt !== d.analysis.expectedUpdatedAt) return false;
      writes.push({
        collection: COLLECTIONS.analyses,
        id: v.id,
        fields: analysisFields(v, d.proposalId, d.audit.id),
        precondition: cur.doc ? { updateTime: cur.doc.updateTime } : { exists: false },
      });
    }
    if (d.challenge) {
      const c = AssessmentChallengeSchema.parse(d.challenge);
      writes.push({ collection: COLLECTIONS.challenges, id: c.id, fields: { json: JSON.stringify(c), claimId: c.claimId, analysisId: c.analysisId, proposalId: d.proposalId, createdAt: c.createdAt }, precondition: { exists: false } });
    }
    return this.db.commit(writes);
  }

  /* ---------- drafts ---------- */

  async saveDraft(draft: AnalysisDraft): Promise<void> {
    const v = AnalysisDraftSchema.parse(draft);
    await this.create(COLLECTIONS.drafts, v.id, { json: JSON.stringify(v), createdBy: v.createdBy, creatorRole: v.creatorRole, createdAt: v.createdAt }, 'draft');
  }

  async getDraft(id: string): Promise<AnalysisDraft | null> {
    const doc = await this.db.get(COLLECTIONS.drafts, id);
    return doc ? AnalysisDraftSchema.parse(body(doc)) : null;
  }

  /* ---------- audit ---------- */

  async appendAudit(record: AuditRecord): Promise<void> {
    const v = AuditRecordSchema.parse(record);
    if (!this.db.authenticated) {
      // System events of the curated, regenerated-from-code demonstrations only.
      if (v.actorId) throw new IdentityRequiredError('An attributed audit record');
      await this.overlay.appendAudit(v);
      return;
    }
    await this.create(COLLECTIONS.audit, v.id, auditFields(v, v.entityType === 'PROPOSAL' ? v.entityId : null), 'audit record');
  }

  async listAudit(entityId: string): Promise<AuditRecord[]> {
    const curated = await this.overlay.listAudit(entityId);
    if (!this.db.authenticated) return curated;
    const docs = await this.db.query(COLLECTIONS.audit, [{ field: 'entityId', op: 'EQUAL', value: entityId }]).catch(() => []);
    return [...docs.map((d) => AuditRecordSchema.parse(body(d))), ...curated].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }
}

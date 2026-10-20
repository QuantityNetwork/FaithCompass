/**
 * Firestore-backed EvidenceStore (ADR 0001: Firebase, EU region, project abrahammoses-a0a26).
 *
 * Each entity is stored whole as canonical JSON in `json` and re-validated on the way out, beside the few fields
 * that queries and security rules need (claimId, status, proposedBy, decidedBy, createdBy, entityId, ...). All
 * writes are server-side with the service account; clients never write canonical collections (firestore.rules).
 *
 * Invariants that Postgres triggers enforced are enforced here, the only writer:
 * - creates use an `exists: false` precondition, so challenges, proposals, drafts and audit events are never
 *   overwritten (append-only);
 * - compare-and-set (`replaceAnalysisIfVersion`, `transitionProposal`) reads the document and commits with an
 *   `updateTime` precondition, so a concurrent change makes the write fail and return false;
 * - ordering is done here, so no composite index is needed.
 */
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
import { FirestoreRest, firestoreConfigFromEnv, type FsDocument } from '@/lib/firebase/firestore-rest';
import type { EvidenceStore } from './types';

export const COLLECTIONS = {
  analyses: 'evidence_analyses',
  challenges: 'evidence_challenges',
  proposals: 'evidence_challenge_proposals',
  drafts: 'evidence_analysis_drafts',
  audit: 'evidence_audit',
} as const;

function body(doc: FsDocument | null | undefined): unknown {
  if (!doc) return null;
  const raw = doc.fields.json;
  if (typeof raw !== 'string') throw new Error(`Document ${doc.name.split('/').slice(-2).join('/')} has no json body.`);
  return JSON.parse(raw);
}

const desc = (key: (x: { fields: Record<string, unknown> }) => string) => (a: FsDocument, b: FsDocument) => key(b).localeCompare(key(a));

export class FirestoreEvidenceStore implements EvidenceStore {
  readonly durable = true;
  readonly db: FirestoreRest;

  constructor(db?: FirestoreRest) {
    this.db = db ?? new FirestoreRest(firestoreConfigFromEnv());
  }

  private static analysisFields(a: Analysis) {
    return {
      json: JSON.stringify(a),
      resourceId: a.resourceId,
      slug: a.passageReference?.slug ?? a.resourceId,
      title: a.title,
      claimIds: a.claims.map((c) => c.id),
      seeded: a.seeded,
      updatedAt: a.updatedAt,
    };
  }

  async saveAnalysis(analysis: Analysis): Promise<void> {
    const v = AnalysisSchema.parse(analysis);
    // Upsert: seeding may run concurrently on several cold starts with identical curated content.
    await this.db.commit([{ collection: COLLECTIONS.analyses, id: v.id, fields: FirestoreEvidenceStore.analysisFields(v) }]);
  }

  async replaceAnalysisIfVersion(analysis: Analysis, expectedUpdatedAt: string): Promise<boolean> {
    const v = AnalysisSchema.parse(analysis);
    const current = await this.db.get(COLLECTIONS.analyses, v.id);
    if (!current || AnalysisSchema.parse(body(current)).updatedAt !== expectedUpdatedAt) return false;
    return this.db.commit([{ collection: COLLECTIONS.analyses, id: v.id, fields: FirestoreEvidenceStore.analysisFields(v), precondition: { updateTime: current.updateTime } }]);
  }

  async getAnalysis(id: string): Promise<Analysis | null> {
    const doc = await this.db.get(COLLECTIONS.analyses, id);
    return doc ? AnalysisSchema.parse(body(doc)) : null;
  }

  async getAnalysisBySlug(slug: string): Promise<Analysis | null> {
    const s = slug.replace(/^\/+|\/+$/g, '');
    const [hit] = await this.db.query(COLLECTIONS.analyses, [{ field: 'slug', op: 'EQUAL', value: s }], 1);
    const doc = hit ?? (await this.db.query(COLLECTIONS.analyses, [{ field: 'resourceId', op: 'EQUAL', value: s }], 1))[0];
    return doc ? AnalysisSchema.parse(body(doc)) : null;
  }

  async listAnalyses(): Promise<Analysis[]> {
    const docs = await this.db.query(COLLECTIONS.analyses, []);
    return docs.map((d) => AnalysisSchema.parse(body(d))).sort((a, b) => a.title.localeCompare(b.title));
  }

  async findClaim(claimId: string): Promise<{ analysis: Analysis; claimIndex: number } | null> {
    const [doc] = await this.db.query(COLLECTIONS.analyses, [{ field: 'claimIds', op: 'ARRAY_CONTAINS', value: claimId }], 1);
    if (!doc) return null;
    const analysis = AnalysisSchema.parse(body(doc));
    const claimIndex = analysis.claims.findIndex((c) => c.id === claimId);
    if (claimIndex === -1) {
      throw new Error(`Analysis ${analysis.id} is indexed against claim ${claimId} but does not contain it. The claimIds field is out of step with the stored document.`);
    }
    return { analysis, claimIndex };
  }

  private async create(collection: string, id: string, fields: Record<string, unknown>, what: string): Promise<void> {
    const ok = await this.db.commit([{ collection, id, fields, precondition: { exists: false } }]);
    if (!ok) throw new Error(`Failed to save ${what} ${id}: it already exists.`);
  }

  async saveChallenge(challenge: AssessmentChallenge): Promise<void> {
    const v = AssessmentChallengeSchema.parse(challenge);
    await this.create(COLLECTIONS.challenges, v.id, { json: JSON.stringify(v), claimId: v.claimId, analysisId: v.analysisId, createdAt: v.createdAt }, 'challenge');
  }

  async listChallenges(claimId: string): Promise<AssessmentChallenge[]> {
    const docs = await this.db.query(COLLECTIONS.challenges, [{ field: 'claimId', op: 'EQUAL', value: claimId }]);
    return docs.sort(desc((d) => String(d.fields.createdAt))).map((d) => AssessmentChallengeSchema.parse(body(d)));
  }

  private static proposalFields(p: ChallengeProposal) {
    return {
      json: JSON.stringify(p),
      claimId: p.claimId,
      analysisId: p.analysisId,
      status: p.status,
      proposedBy: p.proposedBy,
      proposerRole: p.proposerRole,
      idempotencyKey: p.idempotencyKey,
      decidedBy: p.decidedBy,
      decidedRole: p.decidedRole,
      decidedAt: p.decidedAt,
      createdAt: p.createdAt,
    };
  }

  async saveProposal(proposal: ChallengeProposal): Promise<void> {
    const v = ChallengeProposalSchema.parse(proposal);
    await this.create(COLLECTIONS.proposals, v.id, FirestoreEvidenceStore.proposalFields(v), 'proposal');
  }

  async getProposal(id: string): Promise<ChallengeProposal | null> {
    const doc = await this.db.get(COLLECTIONS.proposals, id);
    return doc ? ChallengeProposalSchema.parse(body(doc)) : null;
  }

  async findProposalByIdempotencyKey(key: string): Promise<ChallengeProposal | null> {
    const [doc] = await this.db.query(COLLECTIONS.proposals, [{ field: 'idempotencyKey', op: 'EQUAL', value: key }], 1);
    return doc ? ChallengeProposalSchema.parse(body(doc)) : null;
  }

  async listProposals(claimId: string): Promise<ChallengeProposal[]> {
    const docs = await this.db.query(COLLECTIONS.proposals, [{ field: 'claimId', op: 'EQUAL', value: claimId }]);
    return docs.sort(desc((d) => String(d.fields.createdAt))).map((d) => ChallengeProposalSchema.parse(body(d)));
  }

  async transitionProposal(
    id: string,
    from: ProposalStatus,
    patch: Pick<ChallengeProposal, 'status' | 'decidedBy' | 'decidedRole' | 'decidedAt' | 'decisionReason'>,
  ): Promise<boolean> {
    const doc = await this.db.get(COLLECTIONS.proposals, id);
    if (!doc) return false;
    const current = ChallengeProposalSchema.parse(body(doc));
    if (current.status !== from) return false;
    const next = ChallengeProposalSchema.parse({ ...current, ...patch });
    return this.db.commit([{ collection: COLLECTIONS.proposals, id, fields: FirestoreEvidenceStore.proposalFields(next), precondition: { updateTime: doc.updateTime } }]);
  }

  async saveDraft(draft: AnalysisDraft): Promise<void> {
    const v = AnalysisDraftSchema.parse(draft);
    await this.create(COLLECTIONS.drafts, v.id, { json: JSON.stringify(v), createdBy: v.createdBy, creatorRole: v.creatorRole, createdAt: v.createdAt }, 'draft');
  }

  async getDraft(id: string): Promise<AnalysisDraft | null> {
    const doc = await this.db.get(COLLECTIONS.drafts, id);
    return doc ? AnalysisDraftSchema.parse(body(doc)) : null;
  }

  async appendAudit(record: AuditRecord): Promise<void> {
    const v = AuditRecordSchema.parse(record);
    await this.create(
      COLLECTIONS.audit,
      v.id,
      { json: JSON.stringify(v), entityType: v.entityType, entityId: v.entityId, changeType: v.changeType, actorId: v.actorId ?? null, timestamp: v.timestamp },
      'audit record',
    );
  }

  async listAudit(entityId: string): Promise<AuditRecord[]> {
    const docs = await this.db.query(COLLECTIONS.audit, [{ field: 'entityId', op: 'EQUAL', value: entityId }]);
    return docs.sort(desc((d) => String(d.fields.timestamp))).map((d) => AuditRecordSchema.parse(body(d)));
  }
}

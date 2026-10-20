import type {
  Analysis,
  AnalysisDraft,
  AssessmentChallenge,
  AuditRecord,
  ChallengeProposal,
  ProposalStatus,
} from '../schema';
import type { EvidenceStore } from './types';

/**
 * In-memory store, for tests and for demonstration deployments.
 *
 * A serverless host without a database can still show the curated
 * demonstrations: they are produced by the deterministic corpus pipeline, so
 * every instance rebuilds the same analyses on its first request. What it
 * cannot do is keep anything a visitor creates, so it reports `durable: false`
 * and the write routes refuse with 503 instead of accepting work that the next
 * cold start would lose.
 */
export class MemoryEvidenceStore implements EvidenceStore {
  readonly durable: boolean = false;
  protected analyses = new Map<string, Analysis>();
  protected challenges = new Map<string, AssessmentChallenge[]>();
  protected proposals = new Map<string, ChallengeProposal>();
  protected drafts = new Map<string, AnalysisDraft>();
  protected audit: AuditRecord[] = [];

  async saveAnalysis(analysis: Analysis) {
    this.analyses.set(analysis.id, structuredClone(analysis));
  }
  async replaceAnalysisIfVersion(analysis: Analysis, expectedUpdatedAt: string) {
    const current = this.analyses.get(analysis.id);
    if (!current || current.updatedAt !== expectedUpdatedAt) return false;
    this.analyses.set(analysis.id, structuredClone(analysis));
    return true;
  }
  async getAnalysis(id: string) {
    const a = this.analyses.get(id);
    return a ? structuredClone(a) : null;
  }
  async getAnalysisBySlug(slug: string) {
    const normalised = slug.replace(/^\/+|\/+$/g, '');
    const a = [...this.analyses.values()].find(
      (x) => x.passageReference?.slug === normalised || x.resourceId === normalised,
    );
    return a ? structuredClone(a) : null;
  }
  async listAnalyses() {
    return [...this.analyses.values()].map((a) => structuredClone(a));
  }
  async findClaim(claimId: string) {
    for (const analysis of this.analyses.values()) {
      const claimIndex = analysis.claims.findIndex((c) => c.id === claimId);
      if (claimIndex !== -1) return { analysis: structuredClone(analysis), claimIndex };
    }
    return null;
  }
  async saveChallenge(challenge: AssessmentChallenge) {
    const list = this.challenges.get(challenge.claimId) ?? [];
    list.push(challenge);
    this.challenges.set(challenge.claimId, list);
  }
  async listChallenges(claimId: string) {
    return this.challenges.get(claimId) ?? [];
  }
  async saveProposal(proposal: ChallengeProposal) {
    if (this.proposals.has(proposal.id)) throw new Error(`Proposal ${proposal.id} already exists.`);
    this.proposals.set(proposal.id, structuredClone(proposal));
  }
  async getProposal(id: string) {
    const p = this.proposals.get(id);
    return p ? structuredClone(p) : null;
  }
  async findProposalByIdempotencyKey(key: string) {
    const p = [...this.proposals.values()].find((x) => x.idempotencyKey === key);
    return p ? structuredClone(p) : null;
  }
  async listProposals(claimId: string) {
    return [...this.proposals.values()].filter((p) => p.claimId === claimId).map((p) => structuredClone(p));
  }
  async transitionProposal(
    id: string,
    from: ProposalStatus,
    patch: Pick<ChallengeProposal, 'status' | 'decidedBy' | 'decidedRole' | 'decidedAt' | 'decisionReason'>,
  ) {
    const p = this.proposals.get(id);
    if (!p || p.status !== from) return false;
    this.proposals.set(id, { ...p, ...patch });
    return true;
  }
  async saveDraft(draft: AnalysisDraft) {
    this.drafts.set(draft.id, structuredClone(draft));
  }
  async getDraft(id: string) {
    const d = this.drafts.get(id);
    return d ? structuredClone(d) : null;
  }
  async appendAudit(record: AuditRecord) {
    this.audit.push(record);
  }
  async listAudit(entityId: string) {
    return this.audit.filter((r) => r.entityId === entityId);
  }
}

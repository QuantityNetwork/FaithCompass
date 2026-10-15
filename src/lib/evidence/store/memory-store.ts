import type { Analysis, AssessmentChallenge, AuditRecord } from '../schema';
import type { EvidenceStore } from './types';

/**
 * In-memory store, for tests and for demonstration deployments.
 *
 * A serverless host without a database can still show the curated
 * demonstrations: they are produced by the deterministic corpus pipeline, so
 * every instance rebuilds the same analyses on its first request. What it
 * cannot do is keep anything a visitor creates, so the routes that would save
 * a new analysis or challenge refuse while this store is active (see
 * canPersist) instead of accepting work that the next cold start would lose.
 */
export class MemoryEvidenceStore implements EvidenceStore {
  private analyses = new Map<string, Analysis>();
  private challenges = new Map<string, AssessmentChallenge[]>();
  private audit: AuditRecord[] = [];

  async saveAnalysis(analysis: Analysis) {
    this.analyses.set(analysis.id, analysis);
  }
  async getAnalysis(id: string) {
    return this.analyses.get(id) ?? null;
  }
  async getAnalysisBySlug(slug: string) {
    const normalised = slug.replace(/^\/+|\/+$/g, '');
    return (
      [...this.analyses.values()].find(
        (a) => a.passageReference?.slug === normalised || a.resourceId === normalised,
      ) ?? null
    );
  }
  async listAnalyses() {
    return [...this.analyses.values()];
  }
  async findClaim(claimId: string) {
    for (const analysis of this.analyses.values()) {
      const claimIndex = analysis.claims.findIndex((c) => c.id === claimId);
      if (claimIndex !== -1) return { analysis, claimIndex };
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
  async appendAudit(record: AuditRecord) {
    this.audit.push(record);
  }
  async listAudit(entityId: string) {
    return this.audit.filter((r) => r.entityId === entityId);
  }
}

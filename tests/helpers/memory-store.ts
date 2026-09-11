import type { EvidenceStore } from '@/lib/evidence/store';
import type { Analysis, AssessmentChallenge, AuditRecord } from '@/lib/evidence/schema';

/** In-memory EvidenceStore, so tests never touch the filesystem. */
export class MemoryStore implements EvidenceStore {
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

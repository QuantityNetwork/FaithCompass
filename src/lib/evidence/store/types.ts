import type { Analysis, AssessmentChallenge, AuditRecord } from '../schema';

/**
 * Persistence abstraction.
 *
 * Deliberately narrow so a Postgres or Prisma implementation can replace the
 * JSON store without touching anything above it. Analyses are stored whole: a
 * claim only means anything in the context of its evidence ledger and its
 * sources, so they version together.
 */
export interface EvidenceStore {
  saveAnalysis(analysis: Analysis): Promise<void>;
  getAnalysis(id: string): Promise<Analysis | null>;
  getAnalysisBySlug(slug: string): Promise<Analysis | null>;
  listAnalyses(): Promise<Analysis[]>;
  findClaim(claimId: string): Promise<{ analysis: Analysis; claimIndex: number } | null>;

  saveChallenge(challenge: AssessmentChallenge): Promise<void>;
  listChallenges(claimId: string): Promise<AssessmentChallenge[]>;

  appendAudit(record: AuditRecord): Promise<void>;
  listAudit(entityId: string): Promise<AuditRecord[]>;
}

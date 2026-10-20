import type {
  Analysis,
  AnalysisDraft,
  AssessmentChallenge,
  AuditRecord,
  ChallengeProposal,
  ProposalStatus,
} from '../schema';

/**
 * Persistence abstraction.
 *
 * Analyses are stored whole: a claim only means anything in the context of its
 * evidence ledger and its sources, so they version together.
 *
 * Canonical (published) analyses, visitor drafts and challenge proposals are
 * separate collections. Nothing a visitor submits is written to the canonical
 * collection; see src/lib/evidence/revisions.ts.
 */
/** One editorial decision, applied atomically by stores that support it (Firestore, whose rules require it). */
export interface DecisionCommit {
  proposalId: string;
  from: ProposalStatus;
  patch: Pick<ChallengeProposal, 'status' | 'decidedBy' | 'decidedRole' | 'decidedAt' | 'decisionReason'>;
  audit: AuditRecord;
  /** On approval: the revised analysis, applied only if the analysis is still at `expectedUpdatedAt`. */
  analysis?: { next: Analysis; expectedUpdatedAt: string };
  challenge?: AssessmentChallenge;
}

export interface EvidenceStore {
  /** True when writes are made with the acting user's identity (bind with `forActor`); anonymous actors cannot write. */
  readonly requiresIdentity?: boolean;
  /** The store acting as this user. Stores without per-user identity return themselves. */
  forActor?(actor: import('@/lib/auth/actor').Actor): EvidenceStore;
  /** Atomic decision; when present, revisions.ts uses it instead of the separate calls below. */
  commitDecision?(decision: DecisionCommit): Promise<boolean>;
  /**
   * Stores that keep curated demonstrations apart from durable records (Firestore) report here whether this process
   * already holds the curated version; seeding then never depends on what the database holds.
   */
  hasCurated?(slug: string): Promise<boolean>;

  /**
   * True only when writes survive the current process. A store that would lose
   * a write on the next cold start must say so, so routes refuse rather than
   * accept work that silently disappears.
   */
  readonly durable: boolean;

  saveAnalysis(analysis: Analysis): Promise<void>;
  /**
   * Replace a canonical analysis only if it is still at `expectedUpdatedAt`.
   * Returns false on a version mismatch (a concurrent edit) and writes nothing.
   */
  replaceAnalysisIfVersion(analysis: Analysis, expectedUpdatedAt: string): Promise<boolean>;
  getAnalysis(id: string): Promise<Analysis | null>;
  getAnalysisBySlug(slug: string): Promise<Analysis | null>;
  listAnalyses(): Promise<Analysis[]>;
  findClaim(claimId: string): Promise<{ analysis: Analysis; claimIndex: number } | null>;

  saveChallenge(challenge: AssessmentChallenge): Promise<void>;
  listChallenges(claimId: string): Promise<AssessmentChallenge[]>;

  saveProposal(proposal: ChallengeProposal): Promise<void>;
  getProposal(id: string): Promise<ChallengeProposal | null>;
  findProposalByIdempotencyKey(key: string): Promise<ChallengeProposal | null>;
  listProposals(claimId: string): Promise<ChallengeProposal[]>;
  /**
   * Compare-and-set on status. Returns false, writing nothing, when the
   * proposal is no longer in `from` (someone else decided it first).
   */
  transitionProposal(
    id: string,
    from: ProposalStatus,
    patch: Pick<ChallengeProposal, 'status' | 'decidedBy' | 'decidedRole' | 'decidedAt' | 'decisionReason'>,
  ): Promise<boolean>;

  saveDraft(draft: AnalysisDraft): Promise<void>;
  getDraft(id: string): Promise<AnalysisDraft | null>;

  appendAudit(record: AuditRecord): Promise<void>;
  listAudit(entityId: string): Promise<AuditRecord[]>;
}

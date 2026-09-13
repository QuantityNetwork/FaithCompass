/**
 * The reasoning provider abstraction.
 *
 * Evidence Intelligence must not be welded to one model vendor. A provider is
 * responsible for judgement — which claims a passage makes, which sources bear
 * on them, how strong each dimension looks — and for nothing else. It never
 * returns a score, never writes to the store, and never decides whether a
 * citation is real.
 *
 * Two capability tiers, because the work is not uniform: claim extraction and
 * classification are cheap and mechanical, while contested interpretation and
 * Challenge Assessment are the expensive part.
 */

import type {
  ChallengeResult,
  ClaimAssessmentResult,
  ClaimExtractionResult,
  PassageReference,
} from '../schema';
import type { ClaimType } from '../taxonomy';

export type ReasoningTier = 'fast' | 'deep';

export interface ProviderIdentity {
  provider: string;
  /** Model identifier actually used, recorded on every analysis for audit. */
  modelVersion: string;
}

export interface ExtractionRequest {
  passageText: string | null;
  reference: PassageReference | null;
  query: string;
  /** Perspective / corpus constraints from Ask AbrahamMoses. */
  lens?: AnalysisLens;
}

export interface AssessmentRequest {
  claimStatement: string;
  claimType: ClaimType;
  scope: string;
  passageText: string | null;
  reference: PassageReference | null;
  /** Corpus entry ids the provider is permitted to cite. */
  availableSourceIds: string[];
  lens?: AnalysisLens;
}

export interface ChallengeRequest {
  claimStatement: string;
  claimType: ClaimType;
  currentScore: number | null;
  currentSummary: string;
  assumptions: string[];
  supportingEvidence: string[];
  counterEvidence: string[];
  availableSourceIds: string[];
}

/**
 * Constraints a user can impose from Ask AbrahamMoses — "show only primary
 * sources", "analyse using evidence before AD 500", "remove theological
 * assumptions". These narrow the corpus and the reasoning frame; they never
 * change the scoring arithmetic.
 */
export interface AnalysisLens {
  primarySourcesOnly?: boolean;
  beforeYear?: number;
  perspectives?: string[];
  /** Assess on textual and historical grounds only, setting theology aside. */
  historicalOnly?: boolean;
  /** Restrict evidence to the canonical text itself. */
  scriptureOnly?: boolean;
  note?: string;
}

export interface EvidenceReasoningProvider {
  readonly name: string;
  identity(tier: ReasoningTier): ProviderIdentity;
  /** True when this provider can run without external configuration. */
  isAvailable(): boolean;

  extractClaims(req: ExtractionRequest): Promise<ClaimExtractionResult>;
  assessClaim(req: AssessmentRequest): Promise<ClaimAssessmentResult>;
  challengeAssessment(req: ChallengeRequest): Promise<ChallengeResult>;
}

export class ProviderUnavailableError extends Error {
  constructor(name: string, reason: string) {
    super(`Reasoning provider "${name}" is unavailable: ${reason}`);
    this.name = 'ProviderUnavailableError';
  }
}

export class NoAnalysisAvailableError extends Error {
  readonly subject: string;
  constructor(subject: string) {
    super(
      `No Evidence Intelligence analysis is available for "${subject}". The corpus-backed provider only returns assessments it can ground in curated sources, and no live reasoning provider is configured.`,
    );
    this.name = 'NoAnalysisAvailableError';
    this.subject = subject;
  }
}

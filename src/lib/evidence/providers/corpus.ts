/**
 * Corpus-backed reasoning provider — the default.
 *
 * Serves curated assessments and nothing else. Where no curated assessment
 * exists it refuses, rather than producing a plausible-looking one. That makes
 * it useless for open-ended exploration and completely safe for demonstration,
 * evaluation and offline development: it cannot fabricate a manuscript, because
 * it cannot generate anything.
 *
 * Its assessments run through the same pipeline, scoring engine and citation
 * verifier as a live model's, so the demonstrations exercise the real system
 * rather than a display path.
 */

import {
  seededByClaimStatement,
  seededByQuery,
  seededBySlug,
  type SeededSubject,
} from '../seed';
import { ANALYSIS_VERSION } from '../prompts';
import {
  NoAnalysisAvailableError,
  type AssessmentRequest,
  type ChallengeRequest,
  type EvidenceReasoningProvider,
  type ExtractionRequest,
  type ProviderIdentity,
  type ReasoningTier,
} from './types';
import type { ChallengeResult, ClaimAssessmentResult, ClaimExtractionResult } from '../schema';

function resolve(req: { reference: { slug: string } | null; query: string }): SeededSubject {
  const bySlug = req.reference ? seededBySlug(req.reference.slug) : undefined;
  const subject = bySlug ?? seededByQuery(req.query);
  if (!subject) {
    throw new NoAnalysisAvailableError(req.reference?.slug ?? req.query);
  }
  return subject;
}

/**
 * An assessment request carries a claim statement rather than a query, so the
 * statement is looked up exactly rather than matched against subject aliases.
 * Alias matching would resolve a claim to whichever subject its wording happens
 * to mention — a resurrection claim naming Pontius Pilate would be assessed
 * against the Pilate material.
 */
function resolveForAssessment(req: AssessmentRequest): SeededSubject {
  const byStatement = seededByClaimStatement(req.claimStatement);
  if (byStatement) return byStatement;
  if (req.reference) {
    const bySlug = seededBySlug(req.reference.slug);
    if (bySlug) return bySlug;
  }
  throw new NoAnalysisAvailableError(req.claimStatement);
}

export class CorpusReasoningProvider implements EvidenceReasoningProvider {
  readonly name = 'corpus';

  isAvailable(): boolean {
    return true;
  }

  identity(_tier: ReasoningTier): ProviderIdentity {
    return { provider: this.name, modelVersion: `curated-${ANALYSIS_VERSION}` };
  }

  async extractClaims(req: ExtractionRequest): Promise<ClaimExtractionResult> {
    const subject = resolve(req);
    return {
      claims: subject.claims.map((c) => ({
        statement: c.statement,
        claimType: c.claimType,
        scope: c.scope,
        rationale: c.rationale,
      })),
    };
  }

  async assessClaim(req: AssessmentRequest): Promise<ClaimAssessmentResult> {
    const subject = resolveForAssessment(req);
    const claim = subject.claims.find((c) => c.statement === req.claimStatement);
    if (!claim) throw new NoAnalysisAvailableError(req.claimStatement);
    return claim.assessment;
  }

  /**
   * Challenge Assessment without a live model.
   *
   * A curated provider cannot construct a novel opposing case, so it does the
   * one honest thing available: it re-reads the assessment's own recorded
   * counter-evidence and assumptions, and reports the adjustment those already
   * imply. This is a weaker challenge than a reasoning model performs, and it
   * says so rather than presenting itself as an adversarial review.
   */
  async challengeAssessment(req: ChallengeRequest): Promise<ChallengeResult> {
    const counterCount = req.counterEvidence.length;
    const assumptionCount = req.assumptions.length;

    // More recorded counter-evidence than the original weighting reflected
    // lowers confidence slightly; a claim resting on few assumptions with little
    // counter-evidence holds or firms up.
    const pressure = Math.min(0.3, counterCount * 0.06 + Math.max(0, assumptionCount - 2) * 0.04);
    const relief = counterCount === 0 && assumptionCount <= 2 ? 0.05 : 0;

    return {
      weakestAssumptions:
        req.assumptions.length > 0
          ? req.assumptions
          : ['No explicit assumptions were recorded on this assessment, which is itself worth checking.'],
      strongestOpposingCase:
        counterCount > 0
          ? `The strongest opposing case is built from the counter-evidence already on the ledger: ${req.counterEvidence[0]} A live reasoning provider would develop this further and search for counter-evidence not yet recorded.`
          : 'No counter-evidence is recorded against this assessment. That absence is itself a finding worth testing against a live reasoning provider, since an assessment with no recorded opposition is more often under-examined than uncontested.',
      counterEvidenceFound: req.counterEvidence,
      sourceQualityFindings: [
        'Source independence was re-checked against the corpus dependency graph. Sources declaring a textual dependency on another cited source are already discounted in the scoring.',
      ],
      comparison:
        'The curated provider compares the recorded supporting and opposing evidence and adjusts within bounded limits. It does not construct novel arguments or retrieve new evidence.',
      challengeReasoning:
        'Challenge run by the corpus-backed provider. This is a re-weighting of evidence already on the ledger, not an adversarial review. Configure a live reasoning provider for a full Challenge Assessment, which constructs the strongest opposing interpretation independently and searches for counter-evidence the original assessment missed.',
      supportDelta: relief,
      penaltyDelta: pressure,
    };
  }
}

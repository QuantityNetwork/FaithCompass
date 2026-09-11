/**
 * Challenge Assessment.
 *
 * An adversarial pass over an existing assessment: find the weakest
 * assumptions, build the strongest opposing case, look for counter-evidence,
 * re-check whether the cited sources are as independent as the assessment
 * treated them as being, and re-score.
 *
 * Two rules make this meaningful rather than theatrical. The challenge may
 * raise confidence as well as lower it — if the opposing case needs more
 * unsupported assumptions than the original reading, that is a finding. And the
 * previous score is preserved in the audit history, so a reader can always see
 * what changed, when, under which model and which prompt version.
 */

import { randomUUID } from 'node:crypto';
import {
  AssessmentChallengeSchema,
  type Analysis,
  type AssessmentChallenge,
  type Claim,
} from './schema';
import { computeScore, type ScorableEvidence } from './scoring';
import { getReasoningProvider } from './providers/registry';
import type { EvidenceReasoningProvider } from './providers/types';
import { getStore } from './store';
import { PROMPT_VERSION } from './prompts';
import { filterCorpus } from './corpus';

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export interface ChallengeOutcome {
  challenge: AssessmentChallenge;
  updatedClaim: Claim;
}

export async function challengeClaim(
  claimId: string,
  provider: EvidenceReasoningProvider = getReasoningProvider(),
): Promise<ChallengeOutcome | null> {
  const store = getStore();
  const found = await store.findClaim(claimId);
  if (!found) return null;

  const { analysis, claimIndex } = found;
  const claim = analysis.claims[claimIndex];

  const claimEvidence = analysis.evidence.filter((e) => e.claimId === claimId);
  const supporting = claimEvidence
    .filter((e) => e.relationship === 'SUPPORTS' || e.relationship === 'WEAKLY_SUPPORTS')
    .map((e) => `${e.title}: ${e.description}`);
  const opposing = claimEvidence
    .filter(
      (e) =>
        e.relationship === 'CHALLENGES' ||
        e.relationship === 'WEAKLY_CHALLENGES' ||
        e.relationship === 'CONTRADICTS',
    )
    .map((e) => `${e.title}: ${e.description}`);

  const result = await provider.challengeAssessment({
    claimStatement: claim.statement,
    claimType: claim.claimType,
    currentScore: claim.overallConfidence,
    currentSummary: claim.summary,
    assumptions: claim.assumptions,
    supportingEvidence: supporting,
    counterEvidence: opposing,
    availableSourceIds: filterCorpus({}).map((e) => e.id),
  });

  // The challenge adjusts the *inputs* to the scoring engine, never the score
  // itself. Re-running the same arithmetic on revised inputs is what keeps a
  // challenged score comparable with an unchallenged one.
  const scorable: ScorableEvidence[] = claimEvidence.map((e) => ({
    relationship: e.relationship,
    dimension: e.dimension,
    qualityTier: e.qualityTier,
    directness: e.directness,
    relevance: e.relevance,
    independence:
      result.supportDelta < 0
        ? clamp01(e.independence + result.supportDelta)
        : e.independence,
  }));

  const revisedPenalties = {
    missingEvidence: clamp01(claim.scoringFactors.missingEvidence + result.penaltyDelta),
    sourceDependence: clamp01(claim.scoringFactors.sourceDependence + result.penaltyDelta * 0.5),
    chronologyUncertainty: clamp01(claim.scoringFactors.chronologyUncertainty),
    interpretiveAmbiguity: clamp01(
      claim.scoringFactors.interpretiveAmbiguity + result.penaltyDelta * 0.5,
    ),
    scholarlyDisagreement: clamp01(claim.scoringFactors.scholarlyDisagreement),
  };

  const rescored = computeScore({
    claimType: claim.claimType,
    evidence: scorable,
    penalties: revisedPenalties,
    scholarlyPosition: claim.scholarlyPosition,
    absencePenalty: claim.absence?.penalty,
    evidenceInconsistent: claim.absence?.verdict === 'EVIDENCE_INCONSISTENT_WITH_CLAIM',
  });

  const previousScore = claim.overallConfidence;
  const revisedScore = rescored.score;

  const outcome: AssessmentChallenge['outcome'] =
    previousScore === null || revisedScore === null || previousScore === revisedScore
      ? 'UNCHANGED'
      : revisedScore < previousScore
        ? 'LOWERED'
        : 'RAISED';

  const identity = provider.identity('deep');
  const timestamp = new Date().toISOString();

  const challenge = AssessmentChallengeSchema.parse({
    id: randomUUID(),
    claimId,
    analysisId: analysis.id,
    previousScore,
    revisedScore,
    previousLabel: claim.confidenceLabel,
    revisedLabel: rescored.confidenceLabel,
    weakestAssumptions: result.weakestAssumptions,
    strongestOpposingCase: result.strongestOpposingCase,
    counterEvidenceFound: result.counterEvidenceFound,
    sourceQualityFindings: result.sourceQualityFindings,
    comparison: result.comparison,
    challengeReasoning: result.challengeReasoning,
    outcome,
    modelProvider: identity.provider,
    modelVersion: identity.modelVersion,
    createdAt: timestamp,
  } satisfies AssessmentChallenge);

  const updatedClaim: Claim = {
    ...claim,
    overallConfidence: revisedScore,
    confidenceLabel: rescored.confidenceLabel,
    certainty: rescored.certainty,
    scoringFactors: rescored.factors,
    calibrationNotes: [
      ...claim.calibrationNotes,
      `Rescored by Challenge Assessment on ${timestamp}: ${outcome.toLowerCase()}.`,
      ...rescored.calibrationNotes,
    ],
  };

  const updatedAnalysis: Analysis = {
    ...analysis,
    claims: analysis.claims.map((c, i) => (i === claimIndex ? updatedClaim : c)),
    updatedAt: timestamp,
  };

  await store.saveAnalysis(updatedAnalysis);
  await store.saveChallenge(challenge);
  await store.appendAudit({
    id: randomUUID(),
    entityType: 'CLAIM',
    entityId: claimId,
    changeType: 'CHALLENGED',
    oldValue: { score: previousScore, label: claim.confidenceLabel },
    newValue: { score: revisedScore, label: rescored.confidenceLabel },
    reason: result.challengeReasoning,
    modelProvider: identity.provider,
    modelVersion: identity.modelVersion,
    promptVersion: PROMPT_VERSION,
    timestamp,
  });

  return { challenge, updatedClaim };
}

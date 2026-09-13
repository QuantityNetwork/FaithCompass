/**
 * The scoring engine.
 *
 * A reasoning model never returns a score. It returns structured factor
 * assessments — the quality, relevance, directness and independence of specific
 * evidence items, and bounded penalty estimates — and this module turns those
 * into a number through ordinary application logic.
 *
 * That is the whole point. Two analyses run months apart, by different
 * providers, are comparable because the arithmetic is fixed even though the
 * judgement is not. The number is a calibration device, not a probability, and
 * nothing in this file should ever be described as establishing that a claim is
 * true.
 */

import {
  CONSENSUS_ADJUSTMENT,
  NON_EMPIRICAL_CLAIM_TYPES,
  PRIMARY_DIMENSION_META,
  RELATIONSHIP_VALENCE,
  SOURCE_TIER_META,
  certaintyFor,
  confidenceLabelFor,
  isDimensionAdmissible,
  type ClaimType,
  type ConfidenceLabel,
  type EvidenceDimensionType,
  type PrimaryDimension,
  type ScholarlyPosition,
  type SourceTier,
} from './taxonomy';
import type { ScoringFactors } from './schema';

export interface ScorableEvidence {
  relationship: keyof typeof RELATIONSHIP_VALENCE;
  dimension: EvidenceDimensionType;
  qualityTier: SourceTier;
  directness: number;
  relevance: number;
  independence: number;
}

export interface ScoreInput {
  claimType: ClaimType;
  evidence: ScorableEvidence[];
  penalties: {
    missingEvidence: number;
    sourceDependence: number;
    chronologyUncertainty: number;
    interpretiveAmbiguity: number;
    scholarlyDisagreement: number;
  };
  scholarlyPosition: ScholarlyPosition;
  /** Extra 0–1 penalty from the absence-of-evidence framework, if any. */
  absencePenalty?: number;
  /**
   * Set when positive evidence has been recovered that conflicts with the
   * claim. Distinct from a high absence penalty: an argument from silence,
   * however strong, is not a contradiction.
   */
  evidenceInconsistent?: boolean;
}

export interface ScoreResult {
  /** Null when the claim is not scorable under historical method. */
  score: number | null;
  confidenceLabel: ConfidenceLabel;
  certainty: ReturnType<typeof certaintyFor>;
  scorable: boolean;
  factors: ScoringFactors;
  calibrationNotes: string[];
  /** Per-item contributions, retained for "Why This Score?" and audit. */
  contributions: Array<{ dimension: EvidenceDimensionType; signed: number }>;
  /**
   * The calibration floor this claim's supporting evidence sustains, or null
   * where no floor applies. Exposed so the primary-dimension roll-ups can be
   * held to the same floor: a headline dimension reading below the claim it
   * dominates would be incoherent, since the claim is scored from those very
   * dimensions.
   */
  floor: number | null;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const clamp100 = (n: number) => Math.min(100, Math.max(0, n));

/**
 * Weight of one evidence item.
 *
 * Multiplicative, because these are conjunctive requirements: a Tier A
 * manuscript that is only tangentially relevant to the claim is weak evidence
 * for *this* claim, however excellent the manuscript.
 */
export function itemWeight(item: ScorableEvidence): number {
  const tier = SOURCE_TIER_META[item.qualityTier].weight;
  return (
    tier * clamp01(item.relevance) * clamp01(item.directness) * clamp01(item.independence)
  );
}

/**
 * Diminishing returns on accumulated evidence.
 *
 * Ten corroborating inscriptions are better than two, but not five times
 * better, and a linear sum would let a pile of mediocre citations outrank a
 * decisive one. Saturating keeps quantity from substituting for quality.
 *
 * Exponential rather than the more obvious total/(total+k): a hyperbolic curve
 * approaches its ceiling so slowly that even an outstanding evidence base — a
 * contemporary inscription plus three independent literary witnesses — tops out
 * around 0.6, which drags every strong claim into the middle bands. The
 * exponential form still rewards the second and third source far less than the
 * first while letting genuinely decisive evidence read as decisive.
 */
function saturate(total: number, scale: number): number {
  if (total <= 0) return 0;
  return 1 - Math.exp(-total / scale);
}

/** Support saturates faster than challenge: it takes more to overturn than to establish. */
const SUPPORT_SCALE = 0.7;
const CHALLENGE_SCALE = 1.2;

/**
 * A single dimension is expected to carry one to three items, not the whole
 * ledger, so it saturates faster. Reusing the claim-level scales here would
 * make every individual dimension read as weaker than the claim it feeds, for
 * no reason but the smaller item count.
 */
const DIMENSION_SUPPORT_SCALE = 0.45;
const DIMENSION_CHALLENGE_SCALE = 0.8;

export function computeScore(input: ScoreInput): ScoreResult {
  const notes: string[] = [];
  const contributions: Array<{ dimension: EvidenceDimensionType; signed: number }> = [];

  const scorable = !NON_EMPIRICAL_CLAIM_TYPES.includes(input.claimType);

  let supportRaw = 0;
  let challengeRaw = 0;
  let inadmissible = 0;

  for (const item of input.evidence) {
    if (!isDimensionAdmissible(input.claimType, item.dimension)) {
      // A category error, not weak evidence. Excluded outright.
      inadmissible += 1;
      continue;
    }
    const valence = RELATIONSHIP_VALENCE[item.relationship];
    const weight = itemWeight(item);
    const signed = weight * valence;
    contributions.push({ dimension: item.dimension, signed });
    if (valence > 0) supportRaw += weight * valence;
    else if (valence < 0) challengeRaw += weight * Math.abs(valence);
  }

  if (inadmissible > 0) {
    notes.push(
      `${inadmissible} evidence item(s) excluded as inadmissible for a ${input.claimType} claim.`,
    );
  }

  const support = saturate(supportRaw, SUPPORT_SCALE);
  const challenge = saturate(challengeRaw, CHALLENGE_SCALE);

  const penaltySum =
    clamp01(input.penalties.missingEvidence) * 0.9 +
    clamp01(input.penalties.sourceDependence) * 0.8 +
    clamp01(input.penalties.chronologyUncertainty) * 0.7 +
    clamp01(input.penalties.interpretiveAmbiguity) * 0.9 +
    clamp01(input.penalties.scholarlyDisagreement) * 0.6 +
    clamp01(input.absencePenalty ?? 0) * 1.0;

  // Normalised against the theoretical maximum so the penalty stays a fraction.
  const uncertainty = clamp01(penaltySum / 4.9);

  // Net evidential position before penalties, on 0–1.
  //
  // Counter-evidence is applied as a *share* of the total evidential mass
  // rather than as an absolute deduction. Two strong objections mean something
  // very different against four independent primary witnesses than they do
  // against one weak secondary source, and an absolute deduction would treat
  // them identically.
  const evidentialMass = support + challenge;
  const challengeShare = evidentialMass > 0 ? challenge / evidentialMass : 0;
  const net = clamp01(support * (1 - 0.6 * challengeShare));

  let score = clamp100(net * 100 * (1 - 0.55 * uncertainty));

  const consensusAdjustment = CONSENSUS_ADJUSTMENT[input.scholarlyPosition];
  if (consensusAdjustment !== 0) {
    score = clamp100(score + consensusAdjustment);
    notes.push(
      `Scholarly landscape (${input.scholarlyPosition}) adjusted the score by ${
        consensusAdjustment > 0 ? '+' : ''
      }${consensusAdjustment}. Consensus is recorded separately and is never treated as proof.`,
    );
  }

  const calibrated = applyCalibration(score, {
    claimType: input.claimType,
    evidence: input.evidence,
    support,
    challenge,
    notes,
  });

  const factors: ScoringFactors = {
    supportingStrength: support,
    challengeStrength: challenge,
    missingEvidence: clamp01(input.penalties.missingEvidence),
    sourceDependence: clamp01(input.penalties.sourceDependence),
    chronologyUncertainty: clamp01(input.penalties.chronologyUncertainty),
    interpretiveAmbiguity: clamp01(input.penalties.interpretiveAmbiguity),
    scholarlyDisagreement: clamp01(input.penalties.scholarlyDisagreement),
  };

  if (!scorable) {
    notes.push(
      'Claim type is not adjudicable by historical or textual method. No numerical evidence confidence is issued.',
    );
    return {
      score: null,
      confidenceLabel: 'NOT DIRECTLY SCORABLE',
      certainty: 'NOT_DIRECTLY_SCORABLE',
      scorable: false,
      factors,
      calibrationNotes: notes,
      contributions,
      floor: null,
    };
  }

  // "Contradicted" requires that someone recorded evidence conflicting with the
  // claim — a CONTRADICTS item, or an absence assessment that recovered
  // positive evidence against it. Inferring it from an aggregate of weak
  // support would turn "poorly evidenced" into "refuted", which is the
  // distinction §23 of the methodology exists to protect.
  const evidenceConflicts =
    input.evidence.some(
      (e) => e.relationship === 'CONTRADICTS' && isDimensionAdmissible(input.claimType, e.dimension),
    ) || input.evidenceInconsistent === true;
  const final = Math.round(calibrated);

  return {
    score: final,
    confidenceLabel: confidenceLabelFor(final),
    certainty: certaintyFor(final, { evidenceConflicts }),
    scorable: true,
    factors,
    calibrationNotes: notes,
    contributions,
    floor: calibrationFloor(support),
  };
}

/* ------------------------------------------------------------------ *
 * Calibration
 * ------------------------------------------------------------------ */

interface CalibrationContext {
  claimType: ClaimType;
  evidence: ScorableEvidence[];
  support: number;
  challenge: number;
  notes: string[];
}

/**
 * Confidence inflation is the standing risk in a system like this, so the
 * ceiling is defended explicitly rather than left to the arithmetic.
 */
export function calibrationFloor(support: number): number | null {
  if (support <= 0.15) return null;
  return Math.round(Math.min(35, 12 + support * 100 * 0.45));
}

export function applyCalibration(score: number, ctx: CalibrationContext): number {
  let out = score;

  const primaryItems = ctx.evidence.filter((e) => e.qualityTier === 'A');
  const independentPrimary = primaryItems.filter((e) => e.independence >= 0.6).length;

  // 95+ requires exceptionally direct and stable primary evidence.
  if (out > 95) {
    if (independentPrimary < 3 || ctx.challenge > 0.1) {
      out = 95;
      ctx.notes.push(
        'Capped at 95: scores above 95 require at least three independent Tier A sources and negligible counter-evidence.',
      );
    }
  }

  // A claim resting on nothing better than Tier D/E cannot read as Very High.
  const bestTier = ctx.evidence.reduce<number>(
    (best, e) => Math.max(best, SOURCE_TIER_META[e.qualityTier].weight),
    0,
  );
  if (bestTier <= SOURCE_TIER_META.D.weight && out > 69) {
    out = 69;
    ctx.notes.push(
      'Capped at 69: no source above Tier D supports this claim, so the assessment cannot read as High confidence.',
    );
  }

  // Interpretive and theological claims do not reach the top band. The text
  // underdetermines them by nature, however well attested the manuscripts are.
  if ((ctx.claimType === 'INTERPRETIVE' || ctx.claimType === 'THEOLOGICAL') && out > 92) {
    out = 92;
    ctx.notes.push(
      'Capped at 92: interpretive and theological readings remain underdetermined by the text even at their strongest.',
    );
  }

  // The floor.
  //
  // Penalties and counter-evidence must not be able to drive a claim far below
  // the level its own supporting evidence would justify. A reading defended by
  // serious interpreters on real, if thin, evidence is weakly supported; it is
  // not evidentially void, and scoring it as though it were would say something
  // the ledger does not support. Scaled to the support level rather than flat,
  // so the floor rises only as far as the claim's own evidence carries it.
  //
  // Note this floor is about evidential support, not subject matter: a claim is
  // never scored low merely for being supernatural. Claims historical method
  // cannot reach take the NOT_DIRECTLY_SCORABLE path instead of a number.
  const floor = calibrationFloor(ctx.support);
  if (floor !== null) {
    if (out < floor) {
      out = floor;
      ctx.notes.push(
        `Floored at ${floor}: genuine supporting evidence exists for this claim, and penalties may not drive the assessment below the level that evidence sustains. Very low scores are reserved for claims with no meaningful evidential support.`,
      );
    }
  }

  return clamp100(out);
}

/* ------------------------------------------------------------------ *
 * Primary dimension roll-up
 * ------------------------------------------------------------------ */

export interface PrimaryDimensionInput {
  claimType: ClaimType;
  /** Scores already computed for individual evidence dimensions. */
  dimensionScores: Partial<Record<EvidenceDimensionType, number>>;
  /**
   * Dimensions that at least one cited evidence item actually speaks to. Only
   * these roll up: a headline confidence figure should summarise the evidence
   * ledger, not a model's unevidenced assertion about a dimension.
   */
  evidencedDimensions: ReadonlySet<EvidenceDimensionType>;
}

/**
 * Roll individual evidence dimensions up into one of the three headline
 * dimensions — without ever collapsing all three into a single number.
 *
 * Returns null when no admissible dimension feeds it, which the UI renders as
 * "not applicable" rather than as zero. A metaphysical claim with no historical
 * corroboration has not scored badly on that axis; the axis does not apply.
 */
export function rollUpPrimary(
  primary: PrimaryDimension,
  input: PrimaryDimensionInput,
): number | null {
  const feeds = PRIMARY_DIMENSION_META[primary].feeds.filter(
    (d) => isDimensionAdmissible(input.claimType, d) && input.evidencedDimensions.has(d),
  );
  const values = feeds
    .map((d) => input.dimensionScores[d])
    .filter((v): v is number => typeof v === 'number');

  if (values.length === 0) return null;

  // Mean, then pulled toward the weakest contributor: an evidence profile is
  // only as good as its weakest evidenced dimension, and averaging alone hides
  // a single decisive weakness.
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const min = Math.min(...values);
  return Math.round(mean * 0.85 + min * 0.15);
}

/**
 * Score a single evidence dimension from the items that speak to it.
 */
export function scoreDimension(
  dimension: EvidenceDimensionType,
  claimType: ClaimType,
  evidence: ScorableEvidence[],
  modelStrength: number,
): number {
  if (!isDimensionAdmissible(claimType, dimension)) return 0;
  const relevant = evidence.filter((e) => e.dimension === dimension);

  let supportRaw = 0;
  let challengeRaw = 0;
  for (const item of relevant) {
    const valence = RELATIONSHIP_VALENCE[item.relationship];
    const weight = itemWeight(item);
    if (valence > 0) supportRaw += weight * valence;
    else if (valence < 0) challengeRaw += weight * Math.abs(valence);
  }

  // Same curves and the same share-based damping as the claim-level score, so a
  // dimension and the claim it feeds cannot disagree about what the evidence is
  // worth.
  const support = saturate(supportRaw, DIMENSION_SUPPORT_SCALE);
  const challenge = saturate(challengeRaw, DIMENSION_CHALLENGE_SCALE);
  const mass = support + challenge;
  const evidential = support * (1 - 0.6 * (mass > 0 ? challenge / mass : 0));

  // The model's structured read of the dimension is a minority input. It
  // informs the score where the evidence ledger is thin, but it cannot override
  // what the cited items actually show. A dimension with no cited item at all
  // is an unevidenced assertion: it is discounted here and excluded from the
  // primary roll-up entirely — see rollUpPrimary.
  const blended =
    relevant.length === 0 ? modelStrength * 0.75 : evidential * 0.7 + modelStrength * 0.3;

  return Math.round(clamp01(blended) * 100);
}

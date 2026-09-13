/**
 * Absence-of-evidence reasoning.
 *
 * "No archaeological evidence has been found" is one of the most abused
 * sentences in this subject area, in both directions. It can mean almost
 * nothing, or it can be decisive, and which one depends on questions that are
 * answerable: would the evidence survive, has anyone looked, how large was the
 * population, how distinctive was its material culture, how precise are the
 * dates.
 *
 * This module forces those questions to be answered before any absence
 * penalty is applied.
 */

import type { AbsenceAssessment } from './schema';
import type { AbsenceVerdict } from './taxonomy';

export interface AbsenceInputs {
  /** Would material evidence plausibly survive in this environment? 0–1. */
  survivalLikelihood: number;
  /** How thoroughly has the relevant region been excavated? 0–1. */
  excavationCoverage: number;
  /** How large a material footprint would the claim predict? 0–1. */
  expectedFootprint: number;
  /** How precisely are the claimed dates specified? 0–1. */
  datingPrecision: number;
  /** How distinctive would the predicted material culture be? 0–1. */
  materialDistinctiveness: number;
  /** Has positive evidence been recovered that conflicts with the claim? */
  conflictingEvidenceFound: boolean;
  /** Does the claim predict recoverable material evidence at all? */
  predictsMaterialEvidence: boolean;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * How much an absence should count against a claim.
 *
 * The product of the five conditions, not their average: if any single one
 * fails — the evidence would not survive, or nobody has excavated, or the
 * predicted footprint is tiny — the silence is uninformative regardless of how
 * favourable the others are. Averaging would let four strong conditions drown
 * out the one that actually defeats the inference.
 */
export function absenceWeight(inputs: AbsenceInputs): number {
  if (!inputs.predictsMaterialEvidence) return 0;
  return (
    clamp01(inputs.survivalLikelihood) *
    clamp01(inputs.excavationCoverage) *
    clamp01(inputs.expectedFootprint) *
    clamp01(inputs.datingPrecision) *
    clamp01(inputs.materialDistinctiveness)
  );
}

export function absenceVerdict(inputs: AbsenceInputs): AbsenceVerdict {
  if (!inputs.predictsMaterialEvidence) return 'NOT_APPLICABLE';
  if (inputs.conflictingEvidenceFound) return 'EVIDENCE_INCONSISTENT_WITH_CLAIM';
  return absenceWeight(inputs) >= 0.35
    ? 'EXPECTED_EVIDENCE_CONSPICUOUSLY_ABSENT'
    : 'NO_EVIDENCE_DISCOVERED';
}

export function buildAbsenceAssessment(
  inputs: AbsenceInputs,
  prose: Omit<AbsenceAssessment, 'verdict' | 'penalty'>,
): AbsenceAssessment {
  const verdict = absenceVerdict(inputs);
  const weight = absenceWeight(inputs);

  // Conflicting positive evidence is not an argument from silence and carries
  // its own, heavier penalty floor.
  const penalty = inputs.conflictingEvidenceFound
    ? Math.max(0.6, weight)
    : verdict === 'EXPECTED_EVIDENCE_CONSPICUOUSLY_ABSENT'
      ? weight
      : weight * 0.3;

  return { ...prose, verdict, penalty: clamp01(penalty) };
}

/**
 * Display helpers.
 *
 * The wording rules live here rather than in components, because the same
 * distinctions have to hold everywhere: a score is always labelled "evidence
 * confidence", never "probability", and an inapplicable dimension is never
 * rendered as a zero.
 */

import { EPISTEMIC_META, type EpistemicStatus } from '@/lib/epistemic';
import {
  CERTAINTY_META,
  certaintyFor,
  PERSPECTIVE_LABELS,
  RELATIONSHIP_LABELS,
  SCHOLARLY_POSITION_LABELS,
  SOURCE_TIER_META,
  VERIFICATION_LABELS,
  type CertaintyLevel,
  type ClaimType,
  type EvidenceRelationship,
  type ScholarlyPosition,
  type SourceTier,
  type TraditionPerspective,
  type VerificationState,
} from './taxonomy';

export function certaintyLabel(level: CertaintyLevel): string {
  return CERTAINTY_META[level].label;
}

export function certaintyDefinition(level: CertaintyLevel): string {
  return CERTAINTY_META[level].definition;
}

export function relationshipLabel(r: EvidenceRelationship): string {
  return RELATIONSHIP_LABELS[r];
}

export function relationshipClass(r: EvidenceRelationship): string {
  return `rel--${r.toLowerCase().replace(/_/g, '-')}`;
}

export function tierLabel(t: SourceTier): string {
  return SOURCE_TIER_META[t].label;
}

export function perspectiveLabel(p: TraditionPerspective): string {
  return PERSPECTIVE_LABELS[p];
}

export function scholarlyPositionLabel(p: ScholarlyPosition): string {
  return SCHOLARLY_POSITION_LABELS[p];
}

export function verificationLabel(v: VerificationState): string {
  return VERIFICATION_LABELS[v];
}

export function claimTypeLabel(t: string): string {
  return t.replace(/_/g, ' ');
}

export function dimensionLabel(d: string): string {
  return d.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** The one permitted phrasing for a score. Never "probability that this is true". */
export const SCORE_CAPTION = 'Evidence confidence';

export function ordinal(n: number): string {
  return String(n).padStart(2, '0');
}

/* ------------------------------------------------------------------ *
 * Epistemic wording for interpretive and theological claims
 * ------------------------------------------------------------------ */

/**
 * Claim types whose assessment is a judgement about meaning, canon, fulfilment or doctrine rather
 * than about manuscripts or events. For these the site shows no 0–100 figure and no
 * probability-style label ("Highly Probable"): a number would read as the probability that a
 * theological reading is true (master prompt §3.3). They are described in the epistemic vocabulary
 * of src/lib/epistemic.ts instead (§6.4). The underlying scores are kept in the stored analysis and
 * still drive calibration; only their display changes.
 */
export const INTERPRETIVE_CLAIM_TYPES: readonly ClaimType[] = [
  'INTERPRETIVE',
  'THEOLOGICAL',
  'CANONICAL',
  'PROPHETIC',
  'METAPHYSICAL',
];

export function isInterpretiveClaim(claim: { claimType: string }): boolean {
  return (INTERPRETIVE_CLAIM_TYPES as readonly string[]).includes(claim.claimType);
}

/**
 * Translate the internal certainty ladder into the public epistemic vocabulary.
 * Returns null for NOT_DIRECTLY_SCORABLE, which keeps its own wording: it says what historical
 * method cannot reach, not how well something is supported.
 */
export function epistemicFromCertainty(level: CertaintyLevel, position?: ScholarlyPosition): EpistemicStatus | null {
  if (level === 'NOT_DIRECTLY_SCORABLE') return null;
  if (position === 'SIGNIFICANTLY_DISPUTED') return 'disputed_interpretation';
  switch (level) {
    case 'ESTABLISHED':
    case 'HIGHLY_PROBABLE':
      return 'supported';
    case 'PROBABLE':
    case 'PLAUSIBLE':
      return 'partially_supported';
    case 'POSSIBLE':
    case 'SPECULATIVE':
      return 'insufficient_evidence';
    case 'UNSUPPORTED':
    case 'CONTRADICTED':
      return 'not_established';
  }
}

export function epistemicFromScore(score: number | null, position?: ScholarlyPosition): EpistemicStatus | null {
  return score === null ? null : epistemicFromCertainty(certaintyFor(score), position);
}

/** Label and definition for an interpretive claim, or null when it is not directly scorable. */
export function interpretiveAssessment(claim: {
  certainty: CertaintyLevel;
  scholarlyPosition: ScholarlyPosition;
}): { status: EpistemicStatus; label: string; definition: string } | null {
  const status = epistemicFromCertainty(claim.certainty, claim.scholarlyPosition);
  return status ? { status, ...EPISTEMIC_META[status] } : null;
}

/* ------------------------------------------------------------------ *
 * Review state of an analysis
 * ------------------------------------------------------------------ */

/**
 * Every Evidence Intelligence analysis is, today, machine-produced and unreviewed: the system has
 * no editorial review step yet. The curated analyses were drafted with AI assistance (Claude,
 * Anthropic) in September 2026, per the repository history, and are served from the offline corpus
 * provider. Nothing here may claim a review that did not happen.
 */
export function analysisReviewState(analysis: { seeded: boolean; modelProvider: string; modelVersion: string }): {
  state: 'awaiting_editorial_review';
  label: string;
  disclosure: string;
} {
  const origin = analysis.seeded
    ? 'This assessment was drafted with AI assistance (Claude, Anthropic) in September 2026 and is served from a curated, offline corpus.'
    : `This assessment was generated by ${analysis.modelProvider} (${analysis.modelVersion}).`;
  return {
    state: 'awaiting_editorial_review',
    label: 'AI-drafted · awaiting editorial review',
    disclosure: `${origin} Its sources, wording and assessments have not been reviewed by an AbrahamMoses editor or by any external scholar.`,
  };
}

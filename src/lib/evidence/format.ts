/**
 * Display helpers.
 *
 * The wording rules live here rather than in components, because the same
 * distinctions have to hold everywhere: a score is always labelled "evidence
 * confidence", never "probability", and an inapplicable dimension is never
 * rendered as a zero.
 */

import {
  CERTAINTY_META,
  PERSPECTIVE_LABELS,
  RELATIONSHIP_LABELS,
  SCHOLARLY_POSITION_LABELS,
  SOURCE_TIER_META,
  VERIFICATION_LABELS,
  type CertaintyLevel,
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

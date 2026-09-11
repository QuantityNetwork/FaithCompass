/**
 * Curated demonstration material.
 *
 * A seeded subject supplies exactly what a reasoning provider would supply —
 * claims and structured assessments — and nothing more. It does not supply
 * scores. Seeded analyses run through the same pipeline, the same scoring
 * engine, the same calibration rules and the same citation verifier as
 * generated ones, so the demonstrations are not a separate code path pretending
 * to be the product.
 */

import type { ClaimAssessmentResult, PassageReference } from '../schema';
import type { ClaimType } from '../taxonomy';

export interface SeededClaim {
  statement: string;
  claimType: ClaimType;
  scope: string;
  rationale: string;
  assessment: ClaimAssessmentResult;
}

export interface SeededSubject {
  /** Stable resource id, also the analysis id for seeded material. */
  id: string;
  slug: string;
  resourceType: 'PASSAGE' | 'CLAIM_QUERY' | 'DOCUMENT' | 'TOPIC';
  title: string;
  subtitle: string | null;
  reference: PassageReference | null;
  passageText: string | null;
  passageAttribution: string | null;
  summary: string;
  /** Query strings that should resolve to this subject. */
  aliases: string[];
  claims: SeededClaim[];
}

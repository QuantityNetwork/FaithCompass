/**
 * Structured schemas for Evidence Intelligence.
 *
 * Two jobs:
 *   1. Define the persisted entities.
 *   2. Define what a reasoning model is *allowed* to return. Model output is
 *      parsed through these schemas before it touches the store, so free prose
 *      can never be rendered as data and a malformed citation cannot be
 *      silently persisted.
 *
 * Note what the model-facing schemas omit: no schema anywhere accepts a
 * finished score. Models supply structured factor assessments; the number is
 * computed by scoring.ts. See ScoringFactorsSchema.
 */

import { z } from 'zod';
import {
  ABSENCE_VERDICTS,
  CERTAINTY_LEVELS,
  CLAIM_TYPES,
  CONFIDENCE_LABELS,
  EVIDENCE_DIMENSIONS,
  EVIDENCE_RELATIONSHIPS,
  PRIMARY_DIMENSIONS,
  SCHOLARLY_POSITIONS,
  SOURCE_TIERS,
  SOURCE_TYPES,
  TRADITION_PERSPECTIVES,
  VERIFICATION_STATES,
} from './taxonomy';

/* ------------------------------------------------------------------ *
 * Primitives
 * ------------------------------------------------------------------ */

export const ScoreSchema = z.number().min(0).max(100);
export const UnitSchema = z.number().min(0).max(1);
const Id = z.string().min(1);
const NonEmpty = z.string().min(1).max(4000);

export const PassageReferenceSchema = z.object({
  /** Canonical work identifier, e.g. "daniel", "book-of-mormon", "matthew". */
  work: z.string().min(1),
  /** Human-readable citation, e.g. "Daniel 12:1". */
  display: z.string().min(1),
  chapter: z.number().int().positive().optional(),
  verse: z.number().int().positive().optional(),
  verseEnd: z.number().int().positive().optional(),
  /** URL slug, e.g. "daniel/12/1". */
  slug: z.string().min(1),
});
export type PassageReference = z.infer<typeof PassageReferenceSchema>;

/* ------------------------------------------------------------------ *
 * Source
 * ------------------------------------------------------------------ */

export const SourceSchema = z.object({
  id: Id,
  title: NonEmpty,
  author: z.string().max(500).nullable(),
  publication: z.string().max(500).nullable(),
  /** Free-form because ancient sources are dated in ranges and eras. */
  date: z.string().max(200).nullable(),
  sourceType: z.enum(SOURCE_TYPES),
  qualityTier: z.enum(SOURCE_TIERS),
  traditionPerspective: z.enum(TRADITION_PERSPECTIVES),
  url: z.string().url().nullable().optional(),
  doi: z.string().max(200).nullable().optional(),
  isbn: z.string().max(40).nullable().optional(),
  archiveReference: z.string().max(300).nullable().optional(),
  citation: NonEmpty,
  verified: z.enum(VERIFICATION_STATES),
  /** Why this source is reliable, and where its limits are. */
  reliabilityAssessment: z.string().max(2000),
  /**
   * Independence from the other sources cited for the same claim. Two chronicles
   * that copy a common original are one source, not two, and this is where that
   * gets recorded.
   */
  independence: UnitSchema,
});
export type Source = z.infer<typeof SourceSchema>;

/* ------------------------------------------------------------------ *
 * Evidence item
 * ------------------------------------------------------------------ */

export const EvidenceItemSchema = z.object({
  id: Id,
  claimId: Id,
  title: NonEmpty,
  description: NonEmpty,
  sourceId: Id,
  relationship: z.enum(EVIDENCE_RELATIONSHIPS),
  /** Which evidence dimension this item speaks to. */
  dimension: z.enum(EVIDENCE_DIMENSIONS),
  /** How directly the source bears on the claim, as opposed to its background. */
  directness: UnitSchema,
  relevance: UnitSchema,
  /** Independence of this item from others on the same claim. */
  independence: UnitSchema,
  qualityTier: z.enum(SOURCE_TIERS),
  /** Verbatim excerpt or a faithful summary. */
  excerpt: z.string().max(3000).nullable(),
  whyItMatters: NonEmpty,
});
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

/* ------------------------------------------------------------------ *
 * Evidence dimension assessment
 * ------------------------------------------------------------------ */

export const EvidenceDimensionSchema = z.object({
  id: Id,
  claimId: Id,
  dimensionType: z.enum(EVIDENCE_DIMENSIONS),
  score: ScoreSchema,
  confidenceLabel: z.enum(CONFIDENCE_LABELS),
  reasoningSummary: NonEmpty,
});
export type EvidenceDimensionAssessment = z.infer<typeof EvidenceDimensionSchema>;

/** One of the three headline dimensions shown on every claim. */
export const PrimaryProfileSchema = z.object({
  dimension: z.enum(PRIMARY_DIMENSIONS),
  score: ScoreSchema.nullable(),
  confidenceLabel: z.enum(CONFIDENCE_LABELS),
  reasoningSummary: NonEmpty,
  /**
   * False when this dimension cannot bear on the claim at all — e.g. historical
   * corroboration of a metaphysical proposition. Rendered as "not applicable",
   * never as a zero.
   */
  applicable: z.boolean(),
});
export type PrimaryProfile = z.infer<typeof PrimaryProfileSchema>;

/* ------------------------------------------------------------------ *
 * Scoring factors — what a model may return
 * ------------------------------------------------------------------ */

export const ScoringFactorsSchema = z.object({
  /** Aggregate support, derived from the evidence items by scoring.ts. */
  supportingStrength: UnitSchema,
  challengeStrength: UnitSchema,
  /** Penalties, each 0–1, applied additively and then bounded. */
  missingEvidence: UnitSchema,
  sourceDependence: UnitSchema,
  chronologyUncertainty: UnitSchema,
  interpretiveAmbiguity: UnitSchema,
  scholarlyDisagreement: UnitSchema,
  notes: z.string().max(2000).optional(),
});
export type ScoringFactors = z.infer<typeof ScoringFactorsSchema>;

/* ------------------------------------------------------------------ *
 * Interpretation
 * ------------------------------------------------------------------ */

export const InterpretationSchema = z.object({
  id: Id,
  claimId: Id,
  name: NonEmpty,
  description: NonEmpty,
  tradition: z.enum(TRADITION_PERSPECTIVES),
  confidence: ScoreSchema,
  confidenceLabel: z.enum(CONFIDENCE_LABELS),
  scholarlyPosition: z.enum(SCHOLARLY_POSITIONS),
  directTextualSupport: NonEmpty,
  canonicalSupport: NonEmpty,
  historicalReception: NonEmpty,
  assumptionsRequired: z.array(NonEmpty),
  counterarguments: z.array(NonEmpty),
  supportingEvidenceIds: z.array(Id),
  challengingEvidenceIds: z.array(Id),
});
export type Interpretation = z.infer<typeof InterpretationSchema>;

/* ------------------------------------------------------------------ *
 * Absence of evidence
 * ------------------------------------------------------------------ */

export const AbsenceAssessmentSchema = z.object({
  verdict: z.enum(ABSENCE_VERDICTS),
  wouldEvidenceSurvive: NonEmpty,
  excavationCoverage: NonEmpty,
  expectedMaterialFootprint: NonEmpty,
  datingPrecision: NonEmpty,
  materialCultureDistinctiveness: NonEmpty,
  /** Bounded 0–1 penalty this assessment contributes to the score. */
  penalty: UnitSchema,
});
export type AbsenceAssessment = z.infer<typeof AbsenceAssessmentSchema>;

/* ------------------------------------------------------------------ *
 * Prophecy and miracle frameworks
 * ------------------------------------------------------------------ */

export const PropheticAssessmentSchema = z.object({
  compositionDate: NonEmpty,
  earliestManuscriptEvidence: NonEmpty,
  specificity: NonEmpty,
  ambiguity: NonEmpty,
  retrospectiveCompositionRisk: NonEmpty,
  historicalCorrespondence: NonEmpty,
  interpretiveAssumptionCount: z.number().int().min(0),
  alternativeFulfilmentCandidates: z.array(NonEmpty),
});
export type PropheticAssessment = z.infer<typeof PropheticAssessmentSchema>;

export const MetaphysicalNoteSchema = z.object({
  /** What historical method can and cannot reach on this claim. */
  historicalReach: NonEmpty,
  theologicalReading: NonEmpty,
});
export type MetaphysicalNote = z.infer<typeof MetaphysicalNoteSchema>;

/* ------------------------------------------------------------------ *
 * Claim
 * ------------------------------------------------------------------ */

export const WhyThisScoreSchema = z.object({
  increasing: z.array(NonEmpty),
  lowering: z.array(NonEmpty),
  uncertainties: z.array(NonEmpty),
  assumptions: z.array(NonEmpty),
  alternativeInterpretations: z.array(NonEmpty),
  missingEvidence: z.array(NonEmpty),
  scholarlyDisagreements: z.array(NonEmpty),
  conclusion: NonEmpty,
});
export type WhyThisScore = z.infer<typeof WhyThisScoreSchema>;

export const CertaintyBreakdownSchema = z.object({
  certain: z.array(NonEmpty),
  probable: z.array(NonEmpty),
  possible: z.array(NonEmpty),
  speculative: z.array(NonEmpty),
  unknown: z.array(NonEmpty),
});
export type CertaintyBreakdown = z.infer<typeof CertaintyBreakdownSchema>;

export const ClaimSchema = z.object({
  id: Id,
  analysisId: Id,
  ordinal: z.number().int().positive(),
  statement: NonEmpty,
  claimType: z.enum(CLAIM_TYPES),
  /** What the claim ranges over, e.g. "Daniel 12:1" or "the Nephite record". */
  scope: NonEmpty,
  certainty: z.enum(CERTAINTY_LEVELS),
  /** Null when the claim is NOT_DIRECTLY_SCORABLE under historical method. */
  overallConfidence: ScoreSchema.nullable(),
  confidenceLabel: z.enum(CONFIDENCE_LABELS),
  summary: NonEmpty,
  /** Shown verbatim in the UI when a claim is a minority reading. */
  positionNote: z.string().max(500).nullable(),
  scholarlyPosition: z.enum(SCHOLARLY_POSITIONS),
  scholarlyLandscape: NonEmpty,
  assumptions: z.array(NonEmpty),
  uncertainties: z.array(NonEmpty),
  whatWouldChangeThis: z.array(NonEmpty),
  whyThisScore: WhyThisScoreSchema,
  certaintyBreakdown: CertaintyBreakdownSchema,
  primaryProfile: z.array(PrimaryProfileSchema),
  dimensions: z.array(EvidenceDimensionSchema),
  interpretations: z.array(InterpretationSchema),
  absence: AbsenceAssessmentSchema.nullable(),
  prophetic: PropheticAssessmentSchema.nullable(),
  metaphysical: MetaphysicalNoteSchema.nullable(),
  scoringFactors: ScoringFactorsSchema,
  /** Every calibration rule that fired, for audit. */
  calibrationNotes: z.array(z.string().max(500)),
});
export type Claim = z.infer<typeof ClaimSchema>;

/* ------------------------------------------------------------------ *
 * Analysis
 * ------------------------------------------------------------------ */

export const AnalysisSchema = z.object({
  id: Id,
  resourceId: z.string().min(1),
  resourceType: z.enum(['PASSAGE', 'CLAIM_QUERY', 'DOCUMENT', 'TOPIC']),
  passageReference: PassageReferenceSchema.nullable(),
  title: NonEmpty,
  subtitle: z.string().max(500).nullable(),
  passageText: z.string().max(20000).nullable(),
  passageAttribution: z.string().max(500).nullable(),
  summary: NonEmpty,
  analysisVersion: z.string().min(1),
  promptVersion: z.string().min(1),
  modelProvider: z.string().min(1),
  modelVersion: z.string().min(1),
  claims: z.array(ClaimSchema),
  evidence: z.array(EvidenceItemSchema),
  sources: z.array(SourceSchema),
  /** Present when the analysis is a curated demonstration rather than generated. */
  seeded: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Analysis = z.infer<typeof AnalysisSchema>;

/* ------------------------------------------------------------------ *
 * Challenge and audit
 * ------------------------------------------------------------------ */

export const AssessmentChallengeSchema = z.object({
  id: Id,
  claimId: Id,
  analysisId: Id,
  previousScore: ScoreSchema.nullable(),
  revisedScore: ScoreSchema.nullable(),
  previousLabel: z.enum(CONFIDENCE_LABELS),
  revisedLabel: z.enum(CONFIDENCE_LABELS),
  weakestAssumptions: z.array(NonEmpty),
  strongestOpposingCase: NonEmpty,
  counterEvidenceFound: z.array(NonEmpty),
  sourceQualityFindings: z.array(NonEmpty),
  comparison: NonEmpty,
  challengeReasoning: NonEmpty,
  outcome: z.enum(['LOWERED', 'RAISED', 'UNCHANGED']),
  modelProvider: z.string().min(1),
  modelVersion: z.string().min(1),
  createdAt: z.string(),
});
export type AssessmentChallenge = z.infer<typeof AssessmentChallengeSchema>;

export const AuditRecordSchema = z.object({
  id: Id,
  entityType: z.enum(['ANALYSIS', 'CLAIM', 'EVIDENCE_ITEM', 'SOURCE', 'INTERPRETATION']),
  entityId: Id,
  changeType: z.enum(['CREATED', 'UPDATED', 'CHALLENGED', 'RESCORED', 'CITATION_FLAGGED']),
  oldValue: z.unknown().nullable(),
  newValue: z.unknown().nullable(),
  reason: NonEmpty,
  modelProvider: z.string().nullable(),
  modelVersion: z.string().nullable(),
  promptVersion: z.string().nullable(),
  timestamp: z.string(),
});
export type AuditRecord = z.infer<typeof AuditRecordSchema>;

/* ------------------------------------------------------------------ *
 * Model-facing schemas
 * ------------------------------------------------------------------ *
 *
 * These are what a reasoning provider is contractually allowed to return.
 * They are deliberately narrower than the persisted entities: no ids, no
 * scores, no confidence labels. The pipeline assigns those.
 */

export const ClaimExtractionResultSchema = z.object({
  claims: z
    .array(
      z.object({
        statement: NonEmpty,
        claimType: z.enum(CLAIM_TYPES),
        scope: NonEmpty,
        rationale: NonEmpty,
      }),
    )
    .min(1)
    .max(24),
});
export type ClaimExtractionResult = z.infer<typeof ClaimExtractionResultSchema>;

export const EvidenceItemProposalSchema = z.object({
  title: NonEmpty,
  description: NonEmpty,
  /** Must resolve against the corpus; unresolvable ids are dropped and flagged. */
  sourceRef: z.string().min(1),
  relationship: z.enum(EVIDENCE_RELATIONSHIPS),
  dimension: z.enum(EVIDENCE_DIMENSIONS),
  directness: UnitSchema,
  relevance: UnitSchema,
  independence: UnitSchema,
  excerpt: z.string().max(3000).nullable(),
  whyItMatters: NonEmpty,
});
export type EvidenceItemProposal = z.infer<typeof EvidenceItemProposalSchema>;

export const ClaimAssessmentResultSchema = z.object({
  summary: NonEmpty,
  scope: NonEmpty,
  scholarlyPosition: z.enum(SCHOLARLY_POSITIONS),
  scholarlyLandscape: NonEmpty,
  positionNote: z.string().max(500).nullable(),
  assumptions: z.array(NonEmpty),
  uncertainties: z.array(NonEmpty),
  whatWouldChangeThis: z.array(NonEmpty).min(1),
  evidence: z.array(EvidenceItemProposalSchema),
  dimensionReasoning: z.array(
    z.object({
      dimensionType: z.enum(EVIDENCE_DIMENSIONS),
      reasoningSummary: NonEmpty,
      /** Model's structured read of this dimension, 0–1. Not a score. */
      strength: UnitSchema,
    }),
  ),
  primaryReasoning: z.array(
    z.object({
      dimension: z.enum(PRIMARY_DIMENSIONS),
      applicable: z.boolean(),
      reasoningSummary: NonEmpty,
    }),
  ),
  interpretations: z.array(
    z.object({
      name: NonEmpty,
      description: NonEmpty,
      tradition: z.enum(TRADITION_PERSPECTIVES),
      scholarlyPosition: z.enum(SCHOLARLY_POSITIONS),
      directTextualSupport: NonEmpty,
      canonicalSupport: NonEmpty,
      historicalReception: NonEmpty,
      assumptionsRequired: z.array(NonEmpty),
      counterarguments: z.array(NonEmpty),
      strength: UnitSchema,
    }),
  ),
  whyThisScore: WhyThisScoreSchema,
  certaintyBreakdown: CertaintyBreakdownSchema,
  penalties: z.object({
    missingEvidence: UnitSchema,
    sourceDependence: UnitSchema,
    chronologyUncertainty: UnitSchema,
    interpretiveAmbiguity: UnitSchema,
    scholarlyDisagreement: UnitSchema,
  }),
  absence: AbsenceAssessmentSchema.nullable(),
  prophetic: PropheticAssessmentSchema.nullable(),
  metaphysical: MetaphysicalNoteSchema.nullable(),
});
export type ClaimAssessmentResult = z.infer<typeof ClaimAssessmentResultSchema>;

export const ChallengeResultSchema = z.object({
  weakestAssumptions: z.array(NonEmpty).min(1),
  strongestOpposingCase: NonEmpty,
  counterEvidenceFound: z.array(NonEmpty),
  sourceQualityFindings: z.array(NonEmpty),
  comparison: NonEmpty,
  challengeReasoning: NonEmpty,
  /**
   * Signed adjustment to the *penalty and support* inputs, not to the score.
   * Bounded so a single challenge pass cannot swing an assessment wildly.
   */
  supportDelta: z.number().min(-0.35).max(0.35),
  penaltyDelta: z.number().min(-0.35).max(0.35),
});
export type ChallengeResult = z.infer<typeof ChallengeResultSchema>;

/* ------------------------------------------------------------------ *
 * Validation helpers
 * ------------------------------------------------------------------ */

export class StructuredOutputError extends Error {
  readonly issues: z.ZodIssue[];
  readonly stage: string;

  constructor(stage: string, issues: z.ZodIssue[]) {
    const detail = issues
      .slice(0, 6)
      .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('; ');
    super(`Structured output rejected at stage "${stage}": ${detail}`);
    this.name = 'StructuredOutputError';
    this.stage = stage;
    this.issues = issues;
  }
}

/**
 * Parse model output, or refuse it.
 *
 * There is no lenient path and no partial acceptance: an analysis built from
 * output that did not satisfy its schema would be exactly the failure mode this
 * product exists to avoid.
 */
export function parseStructured<T>(stage: string, schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new StructuredOutputError(stage, result.error.issues);
  return result.data;
}

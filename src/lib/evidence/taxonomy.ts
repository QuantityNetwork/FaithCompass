/**
 * Evidence Intelligence taxonomy.
 *
 * Everything the system says about a claim is expressed in this vocabulary.
 * Nothing here describes *whether a religion is true*; every construct scopes
 * to a single claim and a single kind of evidence.
 */

/* ------------------------------------------------------------------ *
 * Claim types
 * ------------------------------------------------------------------ */

export const CLAIM_TYPES = [
  'TEXTUAL',
  'HISTORICAL',
  'ARCHAEOLOGICAL',
  'LINGUISTIC',
  'GEOGRAPHICAL',
  'CHRONOLOGICAL',
  'BIOGRAPHICAL',
  'INTERPRETIVE',
  'THEOLOGICAL',
  'CANONICAL',
  'METAPHYSICAL',
  'TRADITIONAL',
  'PROPHETIC',
] as const;

export type ClaimType = (typeof CLAIM_TYPES)[number];

/* ------------------------------------------------------------------ *
 * Evidence dimensions
 * ------------------------------------------------------------------ */

export const EVIDENCE_DIMENSIONS = [
  'manuscript_attestation',
  'dating_confidence',
  'authorship_confidence',
  'provenance',
  'archaeological_correspondence',
  'external_historical_corroboration',
  'geographic_accuracy',
  'linguistic_fit',
  'chronological_fit',
  'cultural_fit',
  'independent_sources',
  'source_dependence',
  'material_culture',
  'transmission_stability',
  'scholarly_consensus',
  'interpretive_consensus',
  'canonical_correspondence',
  'ancient_reception',
  'modern_scholarly_dispute',
] as const;

export type EvidenceDimensionType = (typeof EVIDENCE_DIMENSIONS)[number];

export const DIMENSION_LABELS: Record<EvidenceDimensionType, string> = {
  manuscript_attestation: 'Manuscript Attestation',
  dating_confidence: 'Dating Confidence',
  authorship_confidence: 'Authorship Confidence',
  provenance: 'Provenance',
  archaeological_correspondence: 'Archaeological Correspondence',
  external_historical_corroboration: 'External Historical Corroboration',
  geographic_accuracy: 'Geographic Accuracy',
  linguistic_fit: 'Linguistic Fit',
  chronological_fit: 'Chronological Fit',
  cultural_fit: 'Cultural Fit',
  independent_sources: 'Independent Sources',
  source_dependence: 'Source Dependence',
  material_culture: 'Material Culture',
  transmission_stability: 'Transmission Stability',
  scholarly_consensus: 'Scholarly Consensus',
  interpretive_consensus: 'Interpretive Consensus',
  canonical_correspondence: 'Canonical Correspondence',
  ancient_reception: 'Ancient Reception',
  modern_scholarly_dispute: 'Modern Scholarly Dispute',
};

/**
 * Which dimensions can bear on which claim type.
 *
 * This is the category-boundary rule of the system: archaeology cannot speak to
 * the Trinity, and manuscript counts cannot establish whether God exists. A
 * dimension that is not admissible for a claim type is not merely
 * uninformative — attaching it would be a category error, and the reasoning
 * pipeline rejects it.
 */
export const ADMISSIBLE_DIMENSIONS: Record<ClaimType, readonly EvidenceDimensionType[]> = {
  TEXTUAL: [
    'manuscript_attestation',
    'dating_confidence',
    'transmission_stability',
    'provenance',
    'ancient_reception',
    'linguistic_fit',
    'scholarly_consensus',
    'modern_scholarly_dispute',
  ],
  HISTORICAL: [
    'external_historical_corroboration',
    'independent_sources',
    'source_dependence',
    'chronological_fit',
    'dating_confidence',
    // How well the reporting sources are transmitted bears on a historical
    // claim: an event known only from a passage absent in the best manuscripts
    // is less well evidenced than one that is not.
    'manuscript_attestation',
    'transmission_stability',
    'archaeological_correspondence',
    'geographic_accuracy',
    'cultural_fit',
    'material_culture',
    'provenance',
    'scholarly_consensus',
    'modern_scholarly_dispute',
  ],
  ARCHAEOLOGICAL: [
    'archaeological_correspondence',
    'material_culture',
    'geographic_accuracy',
    'chronological_fit',
    'dating_confidence',
    'provenance',
    'independent_sources',
    'scholarly_consensus',
    'modern_scholarly_dispute',
  ],
  LINGUISTIC: [
    'linguistic_fit',
    'manuscript_attestation',
    'dating_confidence',
    'cultural_fit',
    'ancient_reception',
    'scholarly_consensus',
    'modern_scholarly_dispute',
  ],
  GEOGRAPHICAL: [
    'geographic_accuracy',
    'archaeological_correspondence',
    'material_culture',
    'external_historical_corroboration',
    'independent_sources',
    'scholarly_consensus',
  ],
  CHRONOLOGICAL: [
    'chronological_fit',
    'dating_confidence',
    'external_historical_corroboration',
    'independent_sources',
    'source_dependence',
    'scholarly_consensus',
    'modern_scholarly_dispute',
    // Dating a text is done largely by its language and by when it is first
    // quoted. Excluding these would rule out the two standard arguments.
    'linguistic_fit',
    'ancient_reception',
    'authorship_confidence',
    'manuscript_attestation',
  ],
  BIOGRAPHICAL: [
    'external_historical_corroboration',
    'independent_sources',
    'source_dependence',
    'chronological_fit',
    'archaeological_correspondence',
    'provenance',
    'scholarly_consensus',
    'cultural_fit',
    'dating_confidence',
    'modern_scholarly_dispute',
  ],
  INTERPRETIVE: [
    'linguistic_fit',
    'canonical_correspondence',
    'ancient_reception',
    'interpretive_consensus',
    'cultural_fit',
    'manuscript_attestation',
    'modern_scholarly_dispute',
  ],
  THEOLOGICAL: [
    'canonical_correspondence',
    'ancient_reception',
    'interpretive_consensus',
    'linguistic_fit',
    'modern_scholarly_dispute',
  ],
  CANONICAL: [
    'canonical_correspondence',
    'manuscript_attestation',
    'ancient_reception',
    'interpretive_consensus',
    'transmission_stability',
    'linguistic_fit',
  ],
  METAPHYSICAL: [
    // Deliberately narrow. A metaphysical claim can be assessed for its
    // grounding in the texts and its reception history; it cannot be assessed
    // for archaeological correspondence, and historical method cannot
    // adjudicate it at all. See scoring.ts — these claims are NOT_DIRECTLY_SCORABLE.
    'canonical_correspondence',
    'ancient_reception',
    'interpretive_consensus',
  ],
  TRADITIONAL: [
    'ancient_reception',
    'independent_sources',
    'source_dependence',
    'dating_confidence',
    'external_historical_corroboration',
    'interpretive_consensus',
  ],
  PROPHETIC: [
    'dating_confidence',
    'manuscript_attestation',
    'chronological_fit',
    'external_historical_corroboration',
    'interpretive_consensus',
    'ancient_reception',
    'modern_scholarly_dispute',
    // Whether a prediction is specific enough to identify a fulfilment is
    // largely a question about what its words can bear.
    'linguistic_fit',
    'source_dependence',
  ],
};

/**
 * Claim types that historical method cannot directly adjudicate.
 * These are never scored to a number; they receive NOT_DIRECTLY_SCORABLE.
 */
export const NON_EMPIRICAL_CLAIM_TYPES: readonly ClaimType[] = ['METAPHYSICAL'];

export function isDimensionAdmissible(
  claimType: ClaimType,
  dimension: EvidenceDimensionType,
): boolean {
  return ADMISSIBLE_DIMENSIONS[claimType].includes(dimension);
}

/* ------------------------------------------------------------------ *
 * The three primary confidence dimensions
 * ------------------------------------------------------------------ */

export const PRIMARY_DIMENSIONS = ['textual', 'historical', 'interpretive'] as const;
export type PrimaryDimension = (typeof PRIMARY_DIMENSIONS)[number];

export const PRIMARY_DIMENSION_META: Record<
  PrimaryDimension,
  { label: string; question: string; feeds: readonly EvidenceDimensionType[] }
> = {
  textual: {
    label: 'Textual Confidence',
    question:
      'How confidently can we establish what the underlying ancient text originally said?',
    feeds: [
      'manuscript_attestation',
      'transmission_stability',
      'dating_confidence',
      'provenance',
    ],
  },
  historical: {
    label: 'Historical Corroboration',
    question:
      'To what degree do independent historical, archaeological, geographic, linguistic or documentary sources support the historical claim?',
    feeds: [
      'external_historical_corroboration',
      'archaeological_correspondence',
      'independent_sources',
      'source_dependence',
      'geographic_accuracy',
      'chronological_fit',
      'cultural_fit',
      'material_culture',
      'provenance',
    ],
  },
  interpretive: {
    label: 'Interpretive Confidence',
    question:
      'How strongly does the textual and contextual evidence support this particular interpretation?',
    feeds: [
      'linguistic_fit',
      'canonical_correspondence',
      'ancient_reception',
      'interpretive_consensus',
      'cultural_fit',
      'modern_scholarly_dispute',
    ],
  },
};

/* ------------------------------------------------------------------ *
 * Confidence bands
 * ------------------------------------------------------------------ */

export const CONFIDENCE_LABELS = [
  'EXCEPTIONAL',
  'VERY HIGH',
  'HIGH',
  'MODERATE',
  'LIMITED',
  'LOW',
  'VERY LOW',
  'NOT DIRECTLY SCORABLE',
  'NOT ASSESSED',
] as const;

export type ConfidenceLabel = (typeof CONFIDENCE_LABELS)[number];

const CONFIDENCE_BANDS: ReadonlyArray<{ min: number; label: ConfidenceLabel }> = [
  { min: 95, label: 'EXCEPTIONAL' },
  { min: 85, label: 'VERY HIGH' },
  { min: 70, label: 'HIGH' },
  { min: 55, label: 'MODERATE' },
  { min: 40, label: 'LIMITED' },
  { min: 20, label: 'LOW' },
  { min: 0, label: 'VERY LOW' },
];

/**
 * Map an evidence-confidence score to its human-readable band.
 *
 * The number is an *evidence confidence*, not a probability that the claim is
 * true. Nothing downstream may relabel it as one.
 */
export function confidenceLabelFor(score: number): ConfidenceLabel {
  if (!Number.isFinite(score)) throw new RangeError('Confidence score must be finite');
  if (score < 0 || score > 100) {
    throw new RangeError(`Confidence score out of range: ${score}`);
  }
  const band = CONFIDENCE_BANDS.find((b) => score >= b.min);
  // The 0-floor band makes this exhaustive.
  return band!.label;
}

/* ------------------------------------------------------------------ *
 * Certainty taxonomy
 * ------------------------------------------------------------------ */

export const CERTAINTY_LEVELS = [
  'ESTABLISHED',
  'HIGHLY_PROBABLE',
  'PROBABLE',
  'PLAUSIBLE',
  'POSSIBLE',
  'SPECULATIVE',
  'UNSUPPORTED',
  'CONTRADICTED',
  'NOT_DIRECTLY_SCORABLE',
] as const;

export type CertaintyLevel = (typeof CERTAINTY_LEVELS)[number];

export const CERTAINTY_META: Record<
  CertaintyLevel,
  { label: string; definition: string }
> = {
  ESTABLISHED: {
    label: 'Established',
    definition: 'Strongly supported across the available evidence.',
  },
  HIGHLY_PROBABLE: {
    label: 'Highly Probable',
    definition: 'The best explanation, with strong supporting evidence.',
  },
  PROBABLE: {
    label: 'Probable',
    definition: 'The evidence favours the conclusion.',
  },
  PLAUSIBLE: {
    label: 'Plausible',
    definition: 'Reasonable, but not sufficiently established.',
  },
  POSSIBLE: {
    label: 'Possible',
    definition: 'Cannot be ruled out on the available evidence.',
  },
  SPECULATIVE: {
    label: 'Speculative',
    definition: 'Requires assumptions that are not themselves strongly evidenced.',
  },
  UNSUPPORTED: {
    label: 'Unsupported',
    definition: 'Adequate supporting evidence is presently absent.',
  },
  CONTRADICTED: {
    label: 'Contradicted',
    definition: 'Available evidence materially conflicts with the claim.',
  },
  NOT_DIRECTLY_SCORABLE: {
    label: 'Not Directly Scorable Under Historical Method',
    definition:
      'The claim is not the kind of proposition historical or textual method can adjudicate. It may still be assessed for canonical grounding, coherence and reception.',
  },
};

/**
 * Derive a certainty level from an evidence-confidence score.
 *
 * Note what this deliberately does NOT do: a low score never yields
 * "CONTRADICTED". Weak evidence and conflicting evidence are different states,
 * and only an explicit finding of conflicting evidence produces the latter.
 */
export function certaintyFor(
  score: number,
  opts: { evidenceConflicts?: boolean; scorable?: boolean } = {},
): CertaintyLevel {
  // evidenceConflicts must be set from an explicit finding of conflicting
  // evidence — a CONTRADICTS item on the ledger, or an absence assessment that
  // recovered positive evidence against the claim. It is never inferred from
  // an aggregate of weak support, which would collapse "poorly evidenced" into
  // "refuted".
  if (opts.scorable === false) return 'NOT_DIRECTLY_SCORABLE';
  if (opts.evidenceConflicts) return 'CONTRADICTED';
  if (score >= 88) return 'ESTABLISHED';
  if (score >= 78) return 'HIGHLY_PROBABLE';
  if (score >= 65) return 'PROBABLE';
  if (score >= 50) return 'PLAUSIBLE';
  if (score >= 35) return 'POSSIBLE';
  if (score >= 20) return 'SPECULATIVE';
  return 'UNSUPPORTED';
}

/* ------------------------------------------------------------------ *
 * Evidence relationships
 * ------------------------------------------------------------------ */

export const EVIDENCE_RELATIONSHIPS = [
  'SUPPORTS',
  'WEAKLY_SUPPORTS',
  'CONTEXTUAL',
  'NEUTRAL',
  'WEAKLY_CHALLENGES',
  'CHALLENGES',
  'CONTRADICTS',
  'INSUFFICIENT_DATA',
] as const;

export type EvidenceRelationship = (typeof EVIDENCE_RELATIONSHIPS)[number];

export const RELATIONSHIP_LABELS: Record<EvidenceRelationship, string> = {
  SUPPORTS: 'Supports',
  WEAKLY_SUPPORTS: 'Weakly Supports',
  CONTEXTUAL: 'Contextual',
  NEUTRAL: 'Neutral',
  WEAKLY_CHALLENGES: 'Weakly Challenges',
  CHALLENGES: 'Challenges',
  CONTRADICTS: 'Contradicts',
  INSUFFICIENT_DATA: 'Insufficient Data',
};

/** Signed directional weight of a relationship, used by the scoring engine. */
export const RELATIONSHIP_VALENCE: Record<EvidenceRelationship, number> = {
  SUPPORTS: 1,
  WEAKLY_SUPPORTS: 0.5,
  CONTEXTUAL: 0,
  NEUTRAL: 0,
  WEAKLY_CHALLENGES: -0.5,
  CHALLENGES: -1,
  CONTRADICTS: -1.4,
  INSUFFICIENT_DATA: 0,
};

/* ------------------------------------------------------------------ *
 * Source quality
 * ------------------------------------------------------------------ */

export const SOURCE_TIERS = ['A', 'B', 'C', 'D', 'E'] as const;
export type SourceTier = (typeof SOURCE_TIERS)[number];

export const SOURCE_TIER_META: Record<
  SourceTier,
  { label: string; description: string; weight: number }
> = {
  A: {
    label: 'Tier A — Primary Evidence',
    description:
      'Manuscripts, inscriptions, excavation reports, ancient documentary evidence, critical editions.',
    weight: 1.0,
  },
  B: {
    label: 'Tier B — Scholarly Synthesis',
    description:
      'Peer-reviewed scholarship, academic monographs, major critical commentaries, university publications.',
    weight: 0.85,
  },
  C: {
    label: 'Tier C — Serious Secondary Interpretation',
    description:
      'Denominational scholarship, theological institutes, established apologetic and established critical scholarship.',
    weight: 0.65,
  },
  D: {
    label: 'Tier D — General Secondary Material',
    description: 'Encyclopedic sources, educational publications, popular academic material.',
    weight: 0.4,
  },
  E: {
    label: 'Tier E — Advocacy / Unverified',
    description: 'Advocacy material, popular claims, and material that has not been verified.',
    weight: 0.2,
  },
};

/**
 * A source's confessional or methodological standpoint.
 *
 * Perspective is recorded, never penalised. A Latter-day Saint or Evangelical
 * source is weighted by its tier like any other; the perspective label exists so
 * a reader can see the shape of the evidence base, not so the engine can
 * discount a tradition.
 */
export const TRADITION_PERSPECTIVES = [
  'SECULAR_HISTORICAL_CRITICAL',
  'JEWISH',
  'CATHOLIC',
  'ORTHODOX',
  'PROTESTANT',
  'EVANGELICAL',
  'LATTER_DAY_SAINT',
  'ISLAMIC',
  'ANCIENT_SOURCE',
  'INTERDISCIPLINARY',
  'NOT_APPLICABLE',
] as const;

export type TraditionPerspective = (typeof TRADITION_PERSPECTIVES)[number];

export const PERSPECTIVE_LABELS: Record<TraditionPerspective, string> = {
  SECULAR_HISTORICAL_CRITICAL: 'Secular historical-critical scholarship',
  JEWISH: 'Jewish scholarship',
  CATHOLIC: 'Catholic scholarship',
  ORTHODOX: 'Orthodox scholarship',
  PROTESTANT: 'Protestant scholarship',
  EVANGELICAL: 'Evangelical scholarship',
  LATTER_DAY_SAINT: 'Latter-day Saint scholarship',
  ISLAMIC: 'Islamic scholarship',
  ANCIENT_SOURCE: 'Ancient source',
  INTERDISCIPLINARY: 'Interdisciplinary / scientific',
  NOT_APPLICABLE: 'Not applicable',
};

export const SOURCE_TYPES = [
  'MANUSCRIPT',
  'INSCRIPTION',
  'EXCAVATION_REPORT',
  'CRITICAL_EDITION',
  'ANCIENT_TEXT',
  'MONOGRAPH',
  'JOURNAL_ARTICLE',
  'COMMENTARY',
  'REFERENCE_WORK',
  'LEXICON',
  'INSTITUTIONAL_PUBLICATION',
  'DATABASE',
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

/* ------------------------------------------------------------------ *
 * Scholarly landscape
 * ------------------------------------------------------------------ */

export const SCHOLARLY_POSITIONS = [
  'BROAD_CONSENSUS',
  'MAJORITY_POSITION',
  'PLURALITY_POSITION',
  'SIGNIFICANTLY_DISPUTED',
  'MINORITY_POSITION',
  'FRINGE_POSITION',
  'INSUFFICIENT_LITERATURE',
] as const;

export type ScholarlyPosition = (typeof SCHOLARLY_POSITIONS)[number];

export const SCHOLARLY_POSITION_LABELS: Record<ScholarlyPosition, string> = {
  BROAD_CONSENSUS: 'Broad consensus',
  MAJORITY_POSITION: 'Majority position',
  PLURALITY_POSITION: 'Plurality position',
  SIGNIFICANTLY_DISPUTED: 'Significantly disputed',
  MINORITY_POSITION: 'Minority position',
  FRINGE_POSITION: 'Fringe position',
  INSUFFICIENT_LITERATURE: 'Insufficient scholarly literature',
};

/**
 * How much consensus may move a score.
 *
 * Consensus is never proof. It enters the scoring engine as a bounded
 * adjustment only, and the UI always shows "what scholars commonly hold"
 * separately from "what the evidence establishes".
 */
export const CONSENSUS_ADJUSTMENT: Record<ScholarlyPosition, number> = {
  BROAD_CONSENSUS: 4,
  MAJORITY_POSITION: 2,
  PLURALITY_POSITION: 0,
  SIGNIFICANTLY_DISPUTED: -3,
  MINORITY_POSITION: -5,
  FRINGE_POSITION: -8,
  INSUFFICIENT_LITERATURE: -2,
};

/* ------------------------------------------------------------------ *
 * Citation verification
 * ------------------------------------------------------------------ */

export const VERIFICATION_STATES = [
  'VERIFIED',
  'PARTIALLY_VERIFIED',
  'UNVERIFIED',
  'INTERNAL_CORPUS',
] as const;

export type VerificationState = (typeof VERIFICATION_STATES)[number];

export const VERIFICATION_LABELS: Record<VerificationState, string> = {
  VERIFIED: 'Verified',
  PARTIALLY_VERIFIED: 'Partially verified',
  UNVERIFIED: 'Could not be independently verified',
  INTERNAL_CORPUS: 'Internal corpus record',
};

/* ------------------------------------------------------------------ *
 * Absence-of-evidence reasoning
 * ------------------------------------------------------------------ */

/**
 * Three states that are routinely conflated and must not be.
 */
export const ABSENCE_VERDICTS = [
  'NO_EVIDENCE_DISCOVERED',
  'EXPECTED_EVIDENCE_CONSPICUOUSLY_ABSENT',
  'EVIDENCE_INCONSISTENT_WITH_CLAIM',
  'NOT_APPLICABLE',
] as const;

export type AbsenceVerdict = (typeof ABSENCE_VERDICTS)[number];

export const ABSENCE_VERDICT_META: Record<
  AbsenceVerdict,
  { label: string; definition: string }
> = {
  NO_EVIDENCE_DISCOVERED: {
    label: 'No evidence discovered',
    definition:
      'Nothing bearing on the claim has been found. Given survival rates, excavation coverage or the nature of the claim, this carries little evidential weight either way.',
  },
  EXPECTED_EVIDENCE_CONSPICUOUSLY_ABSENT: {
    label: 'Expected evidence conspicuously absent',
    definition:
      'Evidence would reasonably be expected to survive and to have been found by now, and it has not been. This does carry evidential weight against the claim.',
  },
  EVIDENCE_INCONSISTENT_WITH_CLAIM: {
    label: 'Evidence inconsistent with the claim',
    definition:
      'Positive evidence has been recovered and it conflicts with the claim. This is the strongest of the three and is not an argument from silence at all.',
  },
  NOT_APPLICABLE: {
    label: 'Not applicable',
    definition: 'The claim is not of a kind that predicts recoverable material evidence.',
  },
};

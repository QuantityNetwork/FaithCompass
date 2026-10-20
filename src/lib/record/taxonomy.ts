/**
 * The vocabulary of the AbrahamMoses record.
 *
 * Every published claim is described in these terms. Two rules shape the
 * file:
 *
 *   1. Confidence is never a single number. A claim can be textually secure,
 *      philologically contested, historically unattested and accepted by one
 *      tradition only — all at once. The five axes below are recorded and shown
 *      separately and are never combined.
 *   2. Every level has a written criterion. "Very high" means nothing unless a
 *      reader can check what had to be true for a claim to earn it.
 */

/* ------------------------------------------------------------------ *
 * Claim classification
 * ------------------------------------------------------------------ */

export const CLAIM_CLASSIFICATIONS = [
  'quotation',
  'textual_proposition',
  'exegetical_lemma',
  'philological_claim',
  'historical_claim',
  'inference',
  'doctrinal_interpretation',
] as const;

export type ClaimClassification = (typeof CLAIM_CLASSIFICATIONS)[number];

export const CLASSIFICATION_META: Record<
  ClaimClassification,
  { label: string; definition: string; grounding: 'witness' | 'evidence' | 'derived' }
> = {
  quotation: {
    label: 'Quotation',
    definition: 'The verbatim wording of a witness, with its edition and translation recorded.',
    grounding: 'witness',
  },
  textual_proposition: {
    label: 'Explicit textual proposition',
    definition:
      'What a text explicitly states. It is a report about the text, and it stands or falls with the text, not with any reading of it.',
    grounding: 'witness',
  },
  exegetical_lemma: {
    label: 'Exegetical lemma',
    definition:
      'An intermediate reading step — what a text argues, or how one text reads another — recorded as its own claim so it can be examined and disputed.',
    grounding: 'witness',
  },
  philological_claim: {
    label: 'Philological claim',
    definition:
      'A claim about what a word or construction means, resting on lexical, grammatical and comparative evidence.',
    grounding: 'evidence',
  },
  historical_claim: {
    label: 'Historical claim',
    definition:
      'A claim about events, dates, documents or transmission, resting on historical and material evidence.',
    grounding: 'evidence',
  },
  inference: {
    label: 'Doctrinal inference',
    definition:
      'A conclusion drawn from stated premises. It holds only while at least one of its recorded derivations holds.',
    grounding: 'derived',
  },
  doctrinal_interpretation: {
    label: 'Doctrinal interpretation',
    definition:
      'A reading held by a named tradition or school. It is attributed, never presented as the text, and it holds only while one of its derivations holds.',
    grounding: 'derived',
  },
};

/** Claims that are grounded in a witness or in evidence rather than in other claims. */
export function isGroundedInSource(c: ClaimClassification): boolean {
  return CLASSIFICATION_META[c].grounding !== 'derived';
}

export const CLAIM_ROLES = ['thesis', 'lemma', 'parent', 'position'] as const;
export type ClaimRole = (typeof CLAIM_ROLES)[number];

export const ROLE_META: Record<ClaimRole, { label: string; definition: string }> = {
  thesis: {
    label: 'Thesis',
    definition: 'A claim reported from a text or established from evidence.',
  },
  lemma: {
    label: 'Lemma',
    definition: 'An in-between step an argument needs, recorded so it can be examined and disputed.',
  },
  parent: {
    label: 'Parent claim',
    definition: 'A broader conclusion built from theses and lemmas. Traditions most often disagree here.',
  },
  position: {
    label: 'Position',
    definition:
      'One tradition’s answer to a research question, recorded with the derivations it rests on so that rival positions can be tested the same way.',
  },
};

/* ------------------------------------------------------------------ *
 * Publication status
 * ------------------------------------------------------------------ */

export const REVISION_STATUSES = [
  'draft',
  'provisional',
  'published',
  'externally_reviewed',
  'withdrawn',
] as const;

export type RevisionStatus = (typeof REVISION_STATUSES)[number];

export const STATUS_META: Record<
  RevisionStatus,
  { label: string; definition: string; public: boolean }
> = {
  draft: {
    label: 'Draft',
    definition: 'Work in progress. Never served by the public site, API or MCP server.',
    public: false,
  },
  provisional: {
    label: 'Provisional',
    definition:
      'Awaiting editorial review. Public and citable, but its sources, references and wording have not yet been verified by an editor. Shown with a notice everywhere it appears.',
    public: true,
  },
  published: {
    label: 'Published',
    definition:
      'Verified against the cited editions by an AbrahamMoses editor, who is named with the date in the editorial history. A revision without a named reviewer is never published.',
    public: true,
  },
  externally_reviewed: {
    label: 'Externally reviewed',
    definition:
      'Published and additionally reviewed by a scholar outside the editorial team, named in the editorial history.',
    public: true,
  },
  withdrawn: {
    label: 'Withdrawn',
    definition:
      'No longer asserted. The claim stays resolvable so existing citations do not break, and the reason is recorded.',
    public: true,
  },
};

/**
 * Review state in plain words, for places that used to show the legacy headline-confidence label.
 * Maps the publication states onto the scholarly review sequence (master prompt §7.2):
 * provisional = public draft awaiting source validation and editorial review.
 */
export const REVIEW_STATE_LABELS: Record<RevisionStatus, string> = {
  draft: 'Draft, not public',
  provisional: 'Awaiting editorial review',
  published: 'Editor-verified',
  externally_reviewed: 'Externally reviewed',
  withdrawn: 'Withdrawn',
};

/** Whether a revision carries an editorial verification the record can evidence. */
export function isEditorVerified(status: RevisionStatus): boolean {
  return status === 'published' || status === 'externally_reviewed';
}

/* ------------------------------------------------------------------ *
 * The five confidence axes
 * ------------------------------------------------------------------ */

export const CONFIDENCE_AXES = ['textual', 'philological', 'historical', 'inferential'] as const;
export type ConfidenceAxis = (typeof CONFIDENCE_AXES)[number];

export type AxisLevel = 1 | 2 | 3 | 4 | 5;

interface AxisDefinition {
  label: string;
  question: string;
  levels: Record<AxisLevel, { label: string; criterion: string }>;
  /** Why the axis may be "not applicable" to a claim. */
  notApplicable: string;
}

export const AXIS_META: Record<ConfidenceAxis, AxisDefinition> = {
  textual: {
    label: 'Textual certainty',
    question: 'Is the wording the claim relies on securely established in the witnesses?',
    notApplicable: 'The claim does not depend on the wording of a particular witness.',
    levels: {
      5: {
        label: 'Secure',
        criterion:
          'The wording is stable across all major witnesses of the cited edition; no known variant affects the proposition.',
      },
      4: {
        label: 'Strong',
        criterion: 'Minor variants exist in the witnesses, but none alters the proposition.',
      },
      3: {
        label: 'Probable',
        criterion:
          'Variants affect the wording; the proposition holds on the reading the cited edition prefers.',
      },
      2: {
        label: 'Uncertain',
        criterion: 'A material variant bears directly on the proposition; the choice of reading is decisive.',
      },
      1: {
        label: 'Conjectural',
        criterion: 'The proposition depends on an emendation or on a poorly attested reading.',
      },
    },
  },
  philological: {
    label: 'Philological certainty',
    question: 'How securely is the meaning of the wording established?',
    notApplicable: 'The claim turns on no contested word or construction.',
    levels: {
      5: {
        label: 'Unambiguous',
        criterion: 'Lexically and syntactically unambiguous; standard lexica and grammars agree.',
      },
      4: {
        label: 'Established',
        criterion: 'The meaning is established; only nuances are debated.',
      },
      3: {
        label: 'Debated',
        criterion:
          'Standard lexica or grammars differ; the proposition holds on the majority reading.',
      },
      2: {
        label: 'Contested',
        criterion: 'The proposition depends on a disputed sense that is not the majority reading.',
      },
      1: {
        label: 'Speculative',
        criterion: 'The proposed sense is unattested elsewhere or rests on etymology alone.',
      },
    },
  },
  historical: {
    label: 'Historical support',
    question: 'What does evidence outside the claim’s own tradition support?',
    notApplicable:
      'The claim is about what a text says or means, not about an event, date or document, so external corroboration does not bear on it.',
    levels: {
      5: {
        label: 'Independently corroborated',
        criterion:
          'Corroborated by multiple independent sources or by material and documentary evidence.',
      },
      4: {
        label: 'Corroborated',
        criterion: 'Corroborated by at least one source independent of the claim’s tradition.',
      },
      3: {
        label: 'Consistent',
        criterion: 'Consistent with external evidence, but not directly corroborated by it.',
      },
      2: {
        label: 'Tradition-attested only',
        criterion: 'Attested only by sources within the tradition that holds the claim.',
      },
      1: {
        label: 'In tension',
        criterion: 'In tension with external historical or material evidence.',
      },
    },
  },
  inferential: {
    label: 'Inferential strength',
    question: 'How strongly does the claim follow from its stated premises?',
    notApplicable: 'The claim is reported directly from a witness and involves no inference.',
    levels: {
      5: {
        label: 'Direct',
        criterion: 'The source states the claim; no inferential step is involved.',
      },
      4: {
        label: 'Strong',
        criterion: 'Follows from the stated premises without contested assumptions.',
      },
      3: {
        label: 'Defeasible',
        criterion: 'Follows if the recorded interpretive axioms are accepted.',
      },
      2: {
        label: 'Weak',
        criterion: 'Requires several contested axioms, or an analogy the premises do not compel.',
      },
      1: {
        label: 'Speculative',
        criterion: 'The premises are compatible with the conclusion but do not support it.',
      },
    },
  },
};

/** The fifth axis is a matrix, not a level: acceptance is recorded per tradition. */
export const ACCEPTANCE_STANCES = [
  'affirms',
  'qualifies',
  'disputes',
  'rejects',
  'not_addressed',
] as const;
export type AcceptanceStance = (typeof ACCEPTANCE_STANCES)[number];

export const ACCEPTANCE_META: Record<AcceptanceStance, { label: string; definition: string }> = {
  affirms: { label: 'Affirms', definition: 'The tradition holds the claim as stated.' },
  qualifies: {
    label: 'Qualifies',
    definition: 'The tradition holds the claim in a modified or restricted sense, recorded in the note.',
  },
  disputes: {
    label: 'Disputes',
    definition: 'Voices within the tradition contest the claim; there is no settled position.',
  },
  rejects: { label: 'Rejects', definition: 'The tradition’s recorded position denies the claim.' },
  not_addressed: {
    label: 'Not addressed',
    definition:
      'The tradition does not ask this question in these terms. This is a finding about non-comparability, not a gap in the record.',
  },
};

/* ------------------------------------------------------------------ *
 * Dependencies and axioms
 * ------------------------------------------------------------------ */

export const DEPENDENCY_TYPES = [
  'premise',
  'lemma',
  'contrast',
  'interpretive_step',
  'evidence',
] as const;
export type DependencyType = (typeof DEPENDENCY_TYPES)[number];

export const DEPENDENCY_META: Record<DependencyType, { label: string; definition: string }> = {
  premise: { label: 'Premise', definition: 'A claim the argument takes as given.' },
  lemma: { label: 'Lemma', definition: 'An intermediate step the argument needs.' },
  contrast: {
    label: 'Argument by contrast',
    definition: 'The argument defines its conclusion against this claim.',
  },
  interpretive_step: {
    label: 'Interpretive step',
    definition: 'A reading that connects two texts or ideas.',
  },
  evidence: { label: 'Evidence', definition: 'A claim that supplies evidential support.' },
};

export const NECESSITIES = ['necessary', 'supporting'] as const;
export type Necessity = (typeof NECESSITIES)[number];

/**
 * What a derivation needs from a premise.
 *
 * `report` — only that the premise is reported by its witness. "Hebrews says X"
 * is enough. `warrant` — that the premise holds as a conclusion, which a bare
 * report cannot supply once the argument behind it has been rejected.
 */
export const PREMISE_USES = ['report', 'warrant'] as const;
export type PremiseUse = (typeof PREMISE_USES)[number];

export const AXIOM_ROLES = ['requires', 'strengthened_by'] as const;
export type AxiomRole = (typeof AXIOM_ROLES)[number];

export const AXIOM_STANCES = ['holds', 'qualifies', 'rejects', 'brackets'] as const;
export type AxiomStance = (typeof AXIOM_STANCES)[number];

export const AXIOM_STANCE_META: Record<AxiomStance, { label: string; definition: string }> = {
  holds: { label: 'Holds', definition: 'The tradition reads with this principle.' },
  qualifies: {
    label: 'Qualifies',
    definition: 'The tradition holds the principle in a restricted form, recorded in the note.',
  },
  rejects: { label: 'Rejects', definition: 'The tradition does not read with this principle.' },
  brackets: {
    label: 'Sets aside',
    definition:
      'A method that sets the principle aside for the purpose of analysis, without judging it.',
  },
};

/** Stances that a tradition lens removes when it is applied to the dependency model. */
export const LENS_REMOVES: readonly AxiomStance[] = ['rejects', 'brackets'];

/* ------------------------------------------------------------------ *
 * Corpus
 * ------------------------------------------------------------------ */

export const CORPUS_CATEGORIES = [
  'primary_text',
  'historical_witness',
  'reception_history',
  'modern_scholarship',
] as const;
export type CorpusCategory = (typeof CORPUS_CATEGORIES)[number];

export const CORPUS_CATEGORY_META: Record<
  CorpusCategory,
  { ordinal: string; label: string; description: string; includes: string[] }
> = {
  primary_text: {
    ordinal: '01',
    label: 'Primary text',
    description: 'The scriptures of the traditions in the record, cited by critical or standard edition.',
    includes: ['Tanakh', 'Christian Bible', 'Latter-day Saint canon', 'Qur’an'],
  },
  historical_witness: {
    ordinal: '02',
    label: 'Historical witnesses & material evidence',
    description:
      'Ancient manuscripts, versions, inscriptions, archaeological finds and early documents that bear on how a text was transmitted or on the events it reports.',
    includes: [
      'Manuscripts and ancient versions',
      'Second Temple literature',
      'Inscriptions',
      'Archaeology',
      'Early printed editions and documents',
    ],
  },
  reception_history: {
    ordinal: '03',
    label: 'Reception history',
    description: 'How communities have read the primary texts over time.',
    includes: [
      'Rabbinic literature',
      'Church Fathers',
      'Councils and magisterial documents',
      'Medieval theology and law',
      'Reformation writings',
      'Tafsīr and kalām',
    ],
  },
  modern_scholarship: {
    ordinal: '04',
    label: 'Modern scholarship',
    description: 'Critical editions, lexica and peer-reviewed historical and theological study.',
    includes: ['Textual criticism', 'Lexicography', 'Historical theology', 'History of religions'],
  },
};

export const MAP_KINDS = ['covenant', 'doctrine'] as const;
export type MapKind = (typeof MAP_KINDS)[number];

export const MAP_LINK_ROLES = ['grounds', 'illustrates'] as const;
export type MapLinkRole = (typeof MAP_LINK_ROLES)[number];

export const TRADITION_FAMILIES = [
  'jewish',
  'christian',
  'islamic',
  'latter-day-saint',
  'scholarly',
] as const;
export type TraditionFamily = (typeof TRADITION_FAMILIES)[number];

export const FAMILY_META: Record<TraditionFamily, { label: string; ordinal: number }> = {
  // Ordered by historical emergence — the only ordering the record uses, so no
  // tradition is listed first because of whose questions the site asks first.
  jewish: { label: 'Jewish', ordinal: 1 },
  christian: { label: 'Christian', ordinal: 2 },
  islamic: { label: 'Islamic', ordinal: 3 },
  'latter-day-saint': { label: 'Latter-day Saint', ordinal: 4 },
  scholarly: { label: 'Scholarly standpoint', ordinal: 5 },
};

export const CASE_RESPONSES = ['addresses', 'reframes', 'not_comparable'] as const;
export type CaseResponse = (typeof CASE_RESPONSES)[number];

export const CASE_RESPONSE_META: Record<CaseResponse, { label: string; definition: string }> = {
  addresses: {
    label: 'Addresses the question',
    definition: 'The tradition asks this question in these terms and gives a recorded answer.',
  },
  reframes: {
    label: 'Asks a different question',
    definition:
      'The tradition engages the material through its own categories. The comparison is shown, but the questions are not the same.',
  },
  not_comparable: {
    label: 'Not comparable',
    definition:
      'The tradition does not address this question; forcing an answer onto it would misrepresent it.',
  },
};

export const MACHINE_INVOLVEMENT = ['none', 'assisted', 'generated', 'not_recorded'] as const;
export type MachineInvolvement = (typeof MACHINE_INVOLVEMENT)[number];

export const MACHINE_META: Record<MachineInvolvement, { label: string }> = {
  none: { label: 'No machine involvement' },
  assisted: { label: 'Drafted with AI assistance' },
  generated: { label: 'Machine generated' },
  not_recorded: { label: 'Not recorded at publication' },
};

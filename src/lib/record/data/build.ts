/**
 * Authoring helpers for record data files.
 *
 * They exist to keep each claim readable as a scholarly entry rather than a
 * wall of object literals — and to make the honest defaults the easy ones: a
 * new revision is provisional, discloses machine assistance, and names no
 * reviewer it did not have.
 */

import { AXIS_META, type AxisLevel, type ClaimClassification, type ClaimRole } from '../taxonomy';
import type {
  Acceptance,
  Claim,
  ClaimRevision,
  ConfidenceProfile,
  Derivation,
  Premise,
} from '../schema';
import { ref, refs } from './corpus';

export const MIGRATION_DATE = '2026-10-14T12:00:00Z';
export const EDITORIAL_AUTHOR = 'AbrahamMoses editorial (Sagolik)';

export const AI_ASSISTED: ClaimRevision['machine'] = {
  level: 'assisted',
  description:
    'Drafted with AI assistance (Claude, Anthropic) in October 2026 from the cited editions and the published record. References, editions, variants and confidence levels await verification by an AbrahamMoses editor.',
  verification: 'pending',
};

export const NOT_RECORDED: ClaimRevision['machine'] = {
  level: 'not_recorded',
  description:
    'This revision was published before the record tracked machine involvement. It is reproduced here exactly as it appeared in the public Claim Ledger.',
  verification: 'not_applicable',
};

type AxisInput = [AxisLevel | null, string?];

export function conf(input: {
  textual: AxisInput;
  philological: AxisInput;
  historical: AxisInput;
  inferential: AxisInput;
}): ConfidenceProfile {
  const axis = (key: keyof typeof input) => {
    const [level, basis] = input[key];
    return {
      level,
      basis: basis ?? (level === null ? AXIS_META[key].notApplicable : AXIS_META[key].levels[level].criterion),
    };
  };
  return {
    textual: axis('textual'),
    philological: axis('philological'),
    historical: axis('historical'),
    inferential: axis('inferential'),
  };
}

/** Shorthand for a report straight from a secure witness. */
export const REPORT_CONFIDENCE = (textual: AxisInput = [5], philological: AxisInput = [5]) =>
  conf({ textual, philological, historical: [null], inferential: [5] });

type AcceptanceInput = [string, Acceptance['stance'], string | null, string[]?];

export function accept(...rows: AcceptanceInput[]): Acceptance[] {
  return rows.map(([tradition, stance, note, citations]) => ({
    tradition,
    stance,
    note,
    references: refs(...(citations ?? [])),
  }));
}

export interface RevisionInput {
  status?: ClaimRevision['status'];
  publishedAt?: string;
  statement: string;
  classification: ClaimClassification;
  headline: ClaimRevision['headlineConfidence'];
  disputed: string;
  divergence: string;
  witnesses: string[];
  evidence?: Array<[string, string | null]>;
  quotations?: Array<{ text: string; reference: string; translation: string | null }>;
  variants?: Array<{ reference: string; description: string; bearing: 'none' | 'minor' | 'material' }>;
  confidence: ConfidenceProfile | null;
  acceptance?: Acceptance[];
  attribution?: ClaimRevision['attribution'];
  provenance?: Array<{ label: string; detail: string }>;
  changeNote?: string;
  machine?: ClaimRevision['machine'];
}

export function revision(rev: number, input: RevisionInput): ClaimRevision {
  return {
    rev,
    status: input.status ?? 'provisional',
    publishedAt: input.publishedAt ?? MIGRATION_DATE,
    statement: input.statement,
    classification: input.classification,
    headlineConfidence: input.headline,
    disputed: input.disputed,
    interpretiveDivergence: input.divergence,
    primaryWitnesses: refs(...input.witnesses),
    evidence: (input.evidence ?? []).map(([citation, note]) => ({ reference: ref(citation), note })),
    quotations: (input.quotations ?? []).map((q) => ({
      text: q.text,
      reference: ref(q.reference),
      translation: q.translation,
    })),
    variants: (input.variants ?? []).map((v) => ({
      reference: ref(v.reference),
      description: v.description,
      bearing: v.bearing,
    })),
    confidence: input.confidence,
    acceptance: input.acceptance ?? [],
    attribution: input.attribution ?? { kind: 'textual_report', traditions: [], note: null },
    provenanceNotes: input.provenance ?? [],
    editorial: {
      author: EDITORIAL_AUTHOR,
      reviewers: [],
      changeNote: input.changeNote ?? 'First published.',
    },
    machine: input.machine ?? AI_ASSISTED,
  };
}

export function claim(input: {
  code: string;
  role: ClaimRole;
  topic: string;
  cases: string[];
  revisions: ClaimRevision[];
}): Claim {
  return input;
}

/** A claim authored once, in this migration. */
export function newClaim(
  code: string,
  role: ClaimRole,
  topic: string,
  cases: string[],
  input: RevisionInput,
): Claim {
  return claim({ code, role, topic, cases, revisions: [revision(1, input)] });
}

export const attributed = (traditions: string[], note: string | null = null): ClaimRevision['attribution'] => ({
  kind: 'tradition',
  traditions,
  note,
});

export const scholarship = (note: string | null = null): ClaimRevision['attribution'] => ({
  kind: 'scholarship',
  traditions: [],
  note,
});

/* ------------------------------------------------------------------ *
 * Derivations
 * ------------------------------------------------------------------ */

type PremiseInput = [
  claim: string,
  necessity: Premise['necessity'],
  type: Premise['type'],
  use: Premise['use'],
  rationale: string,
];

export function derivation(input: {
  code: string;
  claim: string;
  label: string;
  summary: string;
  premises?: PremiseInput[];
  axioms?: Array<[axiom: string, role: 'requires' | 'strengthened_by', note: string | null]>;
  since?: string;
}): Derivation {
  return {
    code: input.code,
    claim: input.claim,
    label: input.label,
    summary: input.summary,
    premises: (input.premises ?? []).map(([claim, necessity, type, use, rationale]) => ({
      claim,
      necessity,
      type,
      use,
      rationale,
    })),
    axioms: (input.axioms ?? []).map(([axiom, role, note]) => ({ axiom, role, note })),
    since: input.since ?? MIGRATION_DATE,
  };
}

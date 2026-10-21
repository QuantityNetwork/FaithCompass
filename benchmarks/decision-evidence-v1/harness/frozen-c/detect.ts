/* FROZEN COPY of src/lib/contradiction/detect.ts at merge cad6e95 (baseline C of decision-evidence-v1). Do not edit. */
/**
 * Contradiction detection in two separate layers.
 *
 * 1. Deterministic (`detectDeterministic`): fixed rules over normalised context. Its output is reproducible and
 *    can be CONFIRMED_CONFLICT.
 * 2. AI candidates (`CandidateSource`): an interface only. No AI provider is configured and no AI call is made;
 *    `NO_AI_CANDIDATES` returns nothing. If a source is configured later, `combineLayers` keeps its proposals in a
 *    separate list, caps them at POTENTIAL_CONFLICT, marks them for human review and never alters the
 *    deterministic findings.
 */
import { DIMENSIONS, normalizeFact, periodsDisjoint, type Dimension, type Fact, type NormalizedFact } from './normalize';

export const CLASSES = ['CONFIRMED_CONFLICT', 'POTENTIAL_CONFLICT', 'DIFFERENT_REPORTING_BASIS', 'MISSING_EVIDENCE', 'UNRESOLVED_INTERPRETATION'] as const;
export type ContradictionClass = (typeof CLASSES)[number];

export interface Finding {
  layer: 'deterministic';
  class: ContradictionClass;
  facts: [string, string];
  /** Context dimensions on which the two statements differ (normalised). */
  differs: Dimension[];
  /** Dimensions known on one side only. */
  unknown: Dimension[];
  rule: string;
}

/** Relative tolerance under which two numbers in the same canonical unit count as equal (rounding). */
export const TOLERANCE = 0.005;

/** A difference in these dimensions alone means two different facts (another period or version), not a conflict. */
const SERIES: Dimension[] = ['period', 'version', 'effectiveDate'];
/** A difference in these means the same quantity measured another way. */
const BASIS: Dimension[] = ['basis', 'definition', 'scope'];

const equalValues = (a: NormalizedFact, b: NormalizedFact) =>
  a.canonicalValue !== null && b.canonicalValue !== null
    ? Math.abs(a.canonicalValue - b.canonicalValue) <= TOLERANCE * Math.max(Math.abs(a.canonicalValue), Math.abs(b.canonicalValue))
    : String(a.value).trim().toLowerCase() === String(b.value).trim().toLowerCase();

/** Compare two statements. Returns null when they do not conflict or are not about the same thing. */
export function compareFacts(fa: Fact, fb: Fact): Finding | null {
  const a = normalizeFact(fa);
  const b = normalizeFact(fb);
  const pair: [string, string] = [a.id, b.id];
  if (a.context.entity !== b.context.entity) return null;
  // Mutually exclusive options: two different options of one group cannot both hold.
  if (a.exclusiveGroup && a.exclusiveGroup === b.exclusiveGroup) {
    return equalValues(a, b) ? null : { layer: 'deterministic', class: 'CONFIRMED_CONFLICT', facts: pair, differs: [], unknown: [], rule: 'mutually exclusive options asserted together' };
  }
  if (a.context.concept !== b.context.concept) return null;
  if (a.value === null || b.value === null) {
    return { layer: 'deterministic', class: 'MISSING_EVIDENCE', facts: pair, differs: [], unknown: [], rule: 'one side has no value' };
  }
  if (a.dimension && b.dimension && a.dimension !== b.dimension) return null; // different kinds of quantity
  if (equalValues(a, b)) return null;
  // Non-overlapping periods are two different facts (e.g. FY2025 actual and FY2026 forecast).
  if (periodsDisjoint(a.context.period, b.context.period)) return null;
  const known = (d: Dimension) => a.context[d] !== null && b.context[d] !== null;
  const differs = DIMENSIONS.filter((d) => known(d) && a.context[d] !== b.context[d]);
  const unknown = DIMENSIONS.filter((d) => (a.context[d] === null) !== (b.context[d] === null));
  if (a.dimension === 'text' || b.dimension === 'text' || a.canonicalValue === null || b.canonicalValue === null) {
    return { layer: 'deterministic', class: 'UNRESOLVED_INTERPRETATION', facts: pair, differs, unknown, rule: 'different wording of one term; meaning needs a human reading' };
  }
  if (differs.some((d) => BASIS.includes(d))) {
    return { layer: 'deterministic', class: 'DIFFERENT_REPORTING_BASIS', facts: pair, differs, unknown, rule: 'same quantity on a different basis, definition or scope' };
  }
  if (differs.some((d) => SERIES.includes(d))) return null;
  if (unknown.length) {
    return { layer: 'deterministic', class: 'POTENTIAL_CONFLICT', facts: pair, differs, unknown, rule: 'values differ; context incomplete on one side' };
  }
  return { layer: 'deterministic', class: 'CONFIRMED_CONFLICT', facts: pair, differs, unknown, rule: 'same context, different values' };
}

export function detectDeterministic(facts: readonly Fact[]): Finding[] {
  const out: Finding[] = [];
  for (let i = 0; i < facts.length; i++) for (let j = i + 1; j < facts.length; j++) {
    const f = compareFacts(facts[i], facts[j]);
    if (f) out.push(f);
  }
  return out;
}

/* ------------------------------------------------------------ AI candidates */

export interface Candidate {
  class: ContradictionClass;
  facts: string[];
  rationale: string;
}

export interface CandidateSource {
  id: string;
  /** Whether a provider is configured. The default source is not. */
  configured: boolean;
  propose(facts: readonly Fact[]): Promise<Candidate[]>;
}

/** The only source shipped: no provider, no call, no candidates. */
export const NO_AI_CANDIDATES: CandidateSource = { id: 'none', configured: false, propose: async () => [] };

export interface LayeredResult {
  deterministic: Finding[];
  candidates: (Candidate & { layer: 'ai_candidate'; source: string; requiresHumanReview: true })[];
  candidateSource: { id: string; configured: boolean };
}

export async function combineLayers(facts: readonly Fact[], source: CandidateSource = NO_AI_CANDIDATES): Promise<LayeredResult> {
  const deterministic = detectDeterministic(facts);
  const known = new Set(facts.map((f) => f.id));
  const raw = source.configured ? await source.propose(facts) : [];
  return {
    deterministic,
    candidates: raw
      .filter((c) => c.facts.length > 0 && c.facts.every((id) => known.has(id)))
      .map((c) => ({ ...c, class: c.class === 'CONFIRMED_CONFLICT' ? 'POTENTIAL_CONFLICT' : c.class, layer: 'ai_candidate' as const, source: source.id, requiresHumanReview: true as const })),
    candidateSource: { id: source.id, configured: source.configured },
  };
}

/**
 * Contradiction detection in two separate layers.
 *
 * 1. Deterministic (`detectDeterministic`): fixed rules over normalised context. Its output is reproducible and
 *    can be CONFIRMED_CONFLICT.
 * 2. AI candidates (`CandidateSource`): the default `NO_AI_CANDIDATES` makes no call and returns nothing; the
 *    production deployment configures no provider. A configured source (ai-candidates.ts, server-side key only)
 *    proposes pairs; `combineLayers` keeps them in a separate list, caps them at POTENTIAL_CONFLICT, marks them for
 *    human review and never alters the deterministic findings. A candidate on a pair the deterministic layer can
 *    positively show to be consistent (`deterministicVeto`) is moved to `vetoed`, with the reason, not shown as a
 *    candidate. Rules added on 2026-10-21 from the decision-evidence-v1 failure analysis (pre-registered before v2):
 *    legal forms, stated approximations, currency unit words, the veto, and version precedence (`supersedes`).
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
/** Wider tolerance when either value is stated as an approximation ("approximately $27m"). */
export const APPROX_TOLERANCE = 0.05;

/** A difference in these dimensions alone means two different facts (another period or version), not a conflict. */
const SERIES: Dimension[] = ['period', 'version', 'effectiveDate'];
/** A difference in these means the same quantity measured another way. */
const BASIS: Dimension[] = ['basis', 'definition', 'scope'];

const equalValues = (a: NormalizedFact, b: NormalizedFact) =>
  a.canonicalValue !== null && b.canonicalValue !== null
    ? Math.abs(a.canonicalValue - b.canonicalValue) <= (a.approximate || b.approximate ? APPROX_TOLERANCE : TOLERANCE) * Math.max(Math.abs(a.canonicalValue), Math.abs(b.canonicalValue))
    : String(a.value).trim().toLowerCase() === String(b.value).trim().toLowerCase();

/** Two different legal forms of one name are two legal entities. */
const differentLegalEntities = (a: NormalizedFact, b: NormalizedFact) => a.legalForm !== null && b.legalForm !== null && a.legalForm !== b.legalForm;

/** Compare two statements. Returns null when they do not conflict or are not about the same thing. */
export function compareFacts(fa: Fact, fb: Fact): Finding | null {
  const a = normalizeFact(fa);
  const b = normalizeFact(fb);
  const pair: [string, string] = [a.id, b.id];
  if (a.context.entity !== b.context.entity || differentLegalEntities(a, b)) return null;
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

/* ------------------------------------------------- consistency and versions */

/**
 * Why the deterministic layer can positively say two statements do NOT conflict, or null when it cannot. Only
 * reasons established on the same normalised entity and measure count: the values agree within tolerance, the
 * periods do not overlap, the statements are different versions or effective dates, or the entities are different
 * legal entities. A pair the rules cannot read (different entity or measure names) gets null: the layer is blind
 * there, so it must not overrule a reader that can see a definition in the text.
 */
export function deterministicVeto(fa: Fact, fb: Fact): string | null {
  const a = normalizeFact(fa);
  const b = normalizeFact(fb);
  if (a.context.entity !== b.context.entity) return null;
  if (differentLegalEntities(a, b)) return 'different legal entities';
  if (a.exclusiveGroup || b.exclusiveGroup) return null;
  if (a.context.concept !== b.context.concept || a.value === null || b.value === null) return null;
  if (a.dimension && b.dimension && a.dimension !== b.dimension) return null;
  if (equalValues(a, b)) return a.approximate || b.approximate ? 'values agree within the stated approximation' : 'values agree within rounding or after unit conversion';
  if (periodsDisjoint(a.context.period, b.context.period)) return 'different, non-overlapping periods';
  for (const d of ['version', 'effectiveDate'] as const) if (a.context[d] !== null && b.context[d] !== null && a.context[d] !== b.context[d]) return `different ${d === 'version' ? 'versions' : 'effective dates'}`;
  return null;
}

/** Version words that mark a statement as replacing an earlier one. */
const REPLACES = /supersed|amend|restat|replac|revis|correct/i;

/**
 * Version precedence: the id of the statement that supersedes the other, or null. Same entity and measure, both
 * versions stated, exactly one of them says it replaces, amends, restates or corrects.
 */
export function supersedes(fa: Fact, fb: Fact): string | null {
  const a = normalizeFact(fa);
  const b = normalizeFact(fb);
  if (a.context.entity !== b.context.entity || differentLegalEntities(a, b) || a.context.concept !== b.context.concept) return null;
  if (!a.context.version || !b.context.version || a.context.version === b.context.version) return null;
  const ra = REPLACES.test(a.context.version), rb = REPLACES.test(b.context.version);
  return ra && !rb ? a.id : rb && !ra ? b.id : null;
}

/* ------------------------------------------------------------ AI candidates */

export interface Candidate {
  class: ContradictionClass;
  facts: string[];
  rationale: string;
}

/** What a source may read besides the structured facts: the raw documents, span-labelled. */
export interface CandidateContext {
  documents?: readonly { id: string; title: string; text: string }[];
  spans?: readonly { id: string; doc: string; start: number; end: number; text: string }[];
  conclusions?: readonly { id: string; text: string }[];
}

export interface CandidateSource {
  id: string;
  /** Whether a provider is configured. The default source is not. */
  configured: boolean;
  propose(facts: readonly Fact[], context?: CandidateContext): Promise<Candidate[]>;
}

/** The only source shipped: no provider, no call, no candidates. */
export const NO_AI_CANDIDATES: CandidateSource = { id: 'none', configured: false, propose: async () => [] };

export type AiCandidate = Candidate & { layer: 'ai_candidate'; source: string; requiresHumanReview: true };

export interface LayeredResult {
  deterministic: Finding[];
  candidates: AiCandidate[];
  /** Candidates the deterministic layer showed to be consistent pairs; kept for audit, not shown as candidates. */
  vetoed: (AiCandidate & { vetoReason: string })[];
  candidateSource: { id: string; configured: boolean };
}

const pairKey = (ids: readonly string[]) => [...ids].sort().join('|');

export async function combineLayers(facts: readonly Fact[], source: CandidateSource = NO_AI_CANDIDATES, context?: CandidateContext): Promise<LayeredResult> {
  const deterministic = detectDeterministic(facts);
  const byId = new Map(facts.map((f) => [f.id, f]));
  const flagged = new Set(deterministic.map((f) => pairKey(f.facts)));
  const raw = source.configured ? await source.propose(facts, context) : [];
  const candidates: LayeredResult['candidates'] = [];
  const vetoed: LayeredResult['vetoed'] = [];
  const seen = new Set<string>();
  for (const c of raw) {
    if (c.facts.length === 0 || !c.facts.every((id) => byId.has(id))) continue;
    const k = pairKey(c.facts);
    // A pair the deterministic layer already flagged keeps the deterministic finding only; duplicates are dropped.
    if (flagged.has(k) || seen.has(k)) continue;
    seen.add(k);
    const cand: AiCandidate = { ...c, class: c.class === 'CONFIRMED_CONFLICT' ? 'POTENTIAL_CONFLICT' : c.class, layer: 'ai_candidate', source: source.id, requiresHumanReview: true };
    const reason = c.facts.length === 2 ? deterministicVeto(byId.get(c.facts[0])!, byId.get(c.facts[1])!) : null;
    if (reason) vetoed.push({ ...cand, vetoReason: reason });
    else candidates.push(cand);
  }
  return { deterministic, candidates, vetoed, candidateSource: { id: source.id, configured: source.configured } };
}

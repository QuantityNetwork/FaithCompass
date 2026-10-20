/**
 * Research dossiers (master prompt §6.2): a question, the records that bear on it, and
 * what the record does not cover — assembled from published record statements only.
 *
 * Nothing here composes prose about the subject. Every statement shown is a record
 * statement (claim, counter-model, covenant relation, case text) quoted verbatim; the
 * only text written here is structural (headings) or computed from the record (counts,
 * gaps), and is labelled as such.
 */
import { EPISTEMIC_META, type EpistemicStatus } from '@/lib/epistemic';
import { EPISTEMIC_STATUS_OF, simulate, type SimulationResult } from '@/lib/record/engine';
import type { AbrahamMosesRecord } from '@/lib/record/record';
import type { Claim, ClaimRevision, Derivation, ResearchCase } from '@/lib/record/schema';
import { chapterRange, referencesIn, search, tokens } from '@/lib/record/search';
import {
  CLASSIFICATION_META,
  CORPUS_CATEGORY_META,
  FAMILY_META,
  isEditorVerified,
  type ClaimClassification,
  type CorpusCategory,
  type TraditionFamily,
} from '@/lib/record/taxonomy';

/* ------------------------------------------------------------------ requests */

export interface DossierRequest {
  case?: string;
  dossier?: string;
  q?: string;
}

/** The one assembled (non-case) dossier: the demonstration question of master prompt §17. */
export const VISION_ID = 'covenants';
export const VISION_QUESTION = 'What is the relationship between the Abrahamic and Mosaic covenants?';

const C = (n: number) => `AM-CLAIM-000${n}`;
const VISION = {
  title: 'The Abrahamic and Mosaic covenants',
  claims: [187, 242, 188, 185, 192, 210, 211, 220, 244, 245, 224, 234, 228, 218, 219, 247, 221, 248, 227, 225, 246].map(C),
  covenants: ['AM-COV-0002', 'AM-COV-0003', 'AM-COV-0012', 'AM-COV-0015', 'AM-COV-0005', 'AM-COV-0006', 'AM-COV-0008'],
  summary: [
    { title: 'The Abrahamic covenant in the texts', items: [C(187), C(242)] },
    { title: 'The Sinai covenant in the texts', items: [C(188), C(210), C(211)] },
    { title: 'How the covenant map relates them', items: ['AM-COV-0002', 'AM-COV-0003', 'AM-COV-0012'] },
    { title: 'Where the Jewish and Christian positions divide', items: [C(219), C(221), C(247), C(248)] },
  ],
};

function isVisionQuestion(q: string): boolean {
  const n = q.toLowerCase();
  return /abraham/.test(n) && /(mosaic|moses|sinai)/.test(n) && /covenant/.test(n);
}

/**
 * Resolve a free-text question to the address it should be read at. Published dossiers
 * get their own address, so the question itself never needs to be kept in a URL.
 */
export type Resolution = { kind: 'case'; slug: string } | { kind: 'dossier'; id: string } | { kind: 'search'; keywords: string };

export function resolveQuestion(record: AbrahamMosesRecord, raw: string): Resolution {
  const q = raw.trim().slice(0, 500);
  const n = q.toLowerCase().replace(/[?.!\s]+$/g, '');
  const exact = record.data.cases.find(
    (c) => c.question.toLowerCase().replace(/[?.!\s]+$/g, '') === n || c.aliases.some((a) => a.toLowerCase() === n),
  );
  if (exact) return { kind: 'case', slug: exact.slug };
  if (isVisionQuestion(q)) return { kind: 'dossier', id: VISION_ID };
  const result = search(record, q);
  // A question the guardrails respond to is kept whole: the response depends on its wording.
  if (result.guardrail) return { kind: 'search', keywords: q };
  if (result.bestCase) return { kind: 'case', slug: result.bestCase.slug };
  return { kind: 'search', keywords: searchKeywords(q) };
}

/**
 * The minimal form of a free-text question kept in a URL: scripture references and
 * significant search terms, lower-cased, at most twelve. A question that trips a
 * guardrail is kept whole, because the guardrail reads its wording.
 */
export function searchKeywords(q: string): string {
  const text = q.trim().slice(0, 500);
  const refs = referencesIn(text).map((r) => r.display);
  const words = tokens(text.replace(/\b\d+(:\d+)?\b/g, ' '));
  const out = [...new Set([...refs, ...words])].slice(0, 12).join(' ');
  return out || text.slice(0, 80);
}

/* ------------------------------------------------------------------ dossier */

export interface Position {
  claim: string;
  label: string;
  traditions: string[];
  family: TraditionFamily | null;
}

export interface Gap {
  text: string;
  /** How the gap was established; every gap shown is computed from the record. */
  basis: string;
}

export interface Dossier {
  mode: 'case' | 'vision' | 'search' | 'none';
  id: string;
  question: string;
  title: string;
  scope: string;
  coverage: 'full' | 'partial' | 'none';
  claims: string[];
  positions: Position[];
  derivations: string[];
  axioms: string[];
  counterModels: string[];
  covenants: string[];
  summary: Array<{ title: string; items: string[] }> | null;
  summaryText: string | null;
  gaps: Gap[];
  limitations: string[];
  caseSlug: string | null;
  caseStatus: ResearchCase['status'] | null;
  relatedCases: string[];
  terms: string[];
  guardrail: { message: string; suggestedClaims: string[] } | null;
  near: string[];
}

function familyOf(record: AbrahamMosesRecord, traditions: string[]): TraditionFamily | null {
  return (traditions.map((t) => record.tradition(t)?.family).find(Boolean) as TraditionFamily | undefined) ?? null;
}

function positionFor(record: AbrahamMosesRecord, code: string): Position | null {
  const claim = record.claim(code);
  if (!claim || claim.role !== 'position') return null;
  const r = record.current(claim);
  const casePos = record.data.cases.flatMap((c) => c.positions).find((p) => p.claim === code);
  const traditions = casePos?.heldBy ?? r.attribution.traditions;
  return { claim: code, label: casePos?.label ?? claim.topic, traditions, family: familyOf(record, traditions) };
}

function related(record: AbrahamMosesRecord, claims: string[]) {
  const set = new Set(claims);
  const derivations = record.data.derivations.filter((d) => set.has(d.claim)).map((d) => d.code);
  const axioms = [
    ...new Set(record.data.derivations.filter((d) => set.has(d.claim)).flatMap((d) => d.axioms.map((a) => a.axiom))),
  ].sort();
  const counterModels = record.data.counterModels.filter((m) => set.has(m.targets)).map((m) => m.code);
  return { derivations, axioms, counterModels };
}

function casesOf(record: AbrahamMosesRecord, claims: string[]): string[] {
  const count = new Map<string, number>();
  for (const code of claims) for (const s of record.claim(code)?.cases ?? []) count.set(s, (count.get(s) ?? 0) + 1);
  return [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([s]) => s);
}

function computedGaps(record: AbrahamMosesRecord, claims: string[], covenants: string[]): Gap[] {
  const gaps: Gap[] = [];
  const revs = claims.map((c) => record.current(record.claim(c)!));
  // A covenant-map passage counts as covered when any claim cites the same work in an overlapping chapter range.
  const witnesses = record.data.claims.flatMap((c) => record.current(c).primaryWitnesses);
  const overlaps = (a: { work: string; locator: string; display: string }) =>
    witnesses.some((w) => {
      if (w.work !== a.work) return false;
      const ra = chapterRange(a);
      const rw = chapterRange(w);
      return !ra || !rw || (ra[0] <= rw[1] && rw[0] <= ra[1]);
    });
  for (const code of covenants) {
    const edge = record.covenantEdge(code);
    if (!edge) continue;
    const missing = edge.evidence.filter((e) => !overlaps(e));
    if (missing.length) {
      gaps.push({
        text: `The covenant map cites ${missing.map((m) => m.display).join('; ')} for ${code} (${edge.covenantName}), but no claim in the record cites ${missing.length === 1 ? 'that chapter' : 'those chapters'} as a primary witness.`,
        basis: `Compared ${code}'s evidence with the primary witnesses of all ${record.data.claims.length} claims, by work and chapter.`,
      });
    }
  }
  const historical = revs.filter((r) => r.classification === 'historical_claim').length;
  if (historical === 0) {
    gaps.push({
      text: 'No claim in this dossier is a historical claim, so nothing here dates or reconstructs the texts; any sequence shown is the order the traditions read them in.',
      basis: `Counted classifications of the ${claims.length} claims in this dossier.`,
    });
  }
  const noVariants = revs.every((r) => r.variants.length === 0);
  if (noVariants) {
    gaps.push({
      text: 'No textual variant is recorded for any passage cited in this dossier.',
      basis: `Checked the recorded variants of the ${claims.length} claims.`,
    });
  }
  return gaps;
}

export function buildDossier(record: AbrahamMosesRecord, req: DossierRequest): Dossier {
  const base = {
    summary: null,
    summaryText: null,
    gaps: [] as Gap[],
    limitations: [] as string[],
    caseSlug: null,
    caseStatus: null,
    relatedCases: [] as string[],
    terms: [] as string[],
    guardrail: null,
    near: [] as string[],
    covenants: [] as string[],
  };

  const caseSlug = req.case ?? (req.q ? record.data.cases.find((c) => c.question.toLowerCase() === req.q!.trim().toLowerCase())?.slug : undefined);
  const rc = caseSlug ? record.researchCase(caseSlug) : undefined;
  if (rc) {
    const claims = record.claimsInCase(rc.slug).map((c) => c.code);
    const rel = related(record, claims);
    return {
      ...base,
      mode: 'case',
      id: rc.slug,
      question: rc.question,
      title: rc.title,
      scope: rc.framing,
      coverage: 'full',
      claims,
      positions: rc.positions.map((p) => ({ claim: p.claim, label: p.label, traditions: p.heldBy, family: familyOf(record, p.heldBy) })),
      ...rel,
      summaryText: rc.summary,
      limitations: rc.limitations,
      caseSlug: rc.slug,
      caseStatus: rc.status,
      relatedCases: [rc.slug],
      gaps: computedGaps(record, claims, []),
    };
  }

  if (req.dossier === VISION_ID || (!req.case && req.q && isVisionQuestion(req.q))) {
    const claims = VISION.claims.filter((c) => record.claim(c));
    const covenants = VISION.covenants.filter((c) => record.covenantEdge(c));
    const relatedCases = casesOf(record, claims);
    const rel = related(record, claims);
    return {
      ...base,
      mode: 'vision',
      id: VISION_ID,
      question: VISION_QUESTION,
      title: VISION.title,
      scope: `No published research case asks this question as such. This dossier is assembled from ${claims.length} records published under ${relatedCases.length} cases, and ${covenants.length} relations from the covenant map.`,
      coverage: 'partial',
      claims,
      positions: claims.map((c) => positionFor(record, c)).filter((p): p is Position => p !== null),
      ...rel,
      covenants,
      summary: VISION.summary,
      relatedCases,
      gaps: [
        {
          text: `No published research case addresses this question as asked. The records below come from: ${relatedCases.map((s) => record.researchCase(s)?.title ?? s).join('; ')}.`,
          basis: 'Compared the question with the published research cases.',
        },
        ...computedGaps(record, claims, covenants),
      ],
    };
  }

  const q = (req.q ?? '').trim().slice(0, 500);
  if (!q) return buildDossier(record, { dossier: VISION_ID });

  const result = search(record, q, { limit: 24 });
  const terms = [...new Set(tokens(q))];
  const guardrail = result.guardrail ? { message: result.guardrail.message, suggestedClaims: result.guardrail.suggestedClaims } : null;
  const claims = result.claims.map((h) => h.claim.code);
  if (claims.length === 0) {
    return {
      ...base,
      mode: 'none',
      id: 'q',
      question: q,
      title: 'No coverage',
      scope: '',
      coverage: 'none',
      claims: [],
      positions: [],
      derivations: [],
      axioms: [],
      counterModels: [],
      terms,
      guardrail,
      near: [],
    };
  }
  const rel = related(record, claims);
  const relatedCases = casesOf(record, claims);
  return {
    ...base,
    mode: 'search',
    id: 'q',
    question: q,
    title: 'Matches in the record',
    scope: `Retrieval over the published record for: ${terms.join(', ') || q}. Only records that match are shown, ranked by how well they match. Nothing is generated: every item is a published record.`,
    coverage: 'partial',
    claims,
    positions: claims.map((c) => positionFor(record, c)).filter((p): p is Position => p !== null),
    ...rel,
    summary: [{ title: 'Closest matches', items: claims.slice(0, 3) }, ...(claims.length > 3 ? [{ title: 'Further matches', items: claims.slice(3, 6) }] : [])],
    relatedCases,
    terms,
    guardrail,
    gaps: [
      {
        text: result.bestCase
          ? `This question is close to a published research case (${result.bestCase.title}), but not a clear match; coverage here is limited to matching records.`
          : 'No published research case or dossier addresses this question; coverage is limited to matching records.',
        basis: 'Compared the question with the published research cases.',
      },
      ...computedGaps(record, claims, []),
    ],
  };
}

/* ------------------------------------------------------------------ the four-way split */

export type Column = 'direct' | 'interpretation' | 'inference';

const COLUMN_OF: Record<ClaimClassification, Column> = {
  quotation: 'direct',
  textual_proposition: 'direct',
  historical_claim: 'direct',
  exegetical_lemma: 'interpretation',
  philological_claim: 'interpretation',
  doctrinal_interpretation: 'interpretation',
  inference: 'inference',
};

export function columnOf(classification: ClaimClassification): Column {
  return COLUMN_OF[classification];
}

export const COLUMN_META = {
  direct: { title: 'Direct evidence', description: 'What the cited sources say, and historical propositions. Reports, not readings.' },
  interpretation: { title: 'Interpretations', description: 'Readings of words and texts, and positions held by traditions. Attributed, never asserted by the record.' },
  inference: { title: 'Inferences', description: 'What follows from what: premises, declared assumptions and conclusions.' },
  unresolved: { title: 'Unresolved questions', description: 'Objections, counter-models, coverage gaps and known limitations.' },
} as const;

/* ------------------------------------------------------------------ filters */

export type ReviewFilter = 'provisional' | 'editor_verified' | 'externally_reviewed';
export interface Filters {
  source: string;
  tradition: string;
  language: string;
  period: string;
  state: ReviewFilter | '';
}
export const NO_FILTERS: Filters = { source: '', tradition: '', language: '', period: '', state: '' };
export const REVIEW_FILTER_LABELS: Record<ReviewFilter, string> = {
  provisional: 'Provisional · awaiting editorial review',
  editor_verified: 'Editor-verified',
  externally_reviewed: 'Externally reviewed',
};

function witnessWorks(r: ClaimRevision): string[] {
  return [...new Set([...r.primaryWitnesses.map((w) => w.work), ...r.evidence.map((e) => e.reference.work)])];
}

function claimTraditions(r: ClaimRevision): string[] {
  return [...new Set([...r.attribution.traditions, ...r.acceptance.filter((a) => a.stance !== 'not_addressed').map((a) => a.tradition)])];
}

export function filterOptions(record: AbrahamMosesRecord, claims: string[]) {
  const works = new Set<string>();
  const traditions = new Set<string>();
  const languages = new Set<string>();
  const periods = new Set<CorpusCategory>();
  for (const code of claims) {
    const r = record.current(record.claim(code)!);
    for (const w of witnessWorks(r)) {
      const work = record.work(w);
      if (!work) continue;
      works.add(w);
      languages.add(work.edition.language);
      periods.add(work.category);
    }
    for (const t of claimTraditions(r)) traditions.add(t);
  }
  const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label);
  return {
    source: [...works].map((w) => ({ value: w, label: record.work(w)!.title })).sort(byLabel),
    tradition: [...traditions].map((t) => ({ value: t, label: record.tradition(t)?.name ?? t })).sort(byLabel),
    language: [...languages].sort().map((l) => ({ value: l, label: l })),
    period: [...periods]
      .sort((a, b) => CORPUS_CATEGORY_META[a].ordinal.localeCompare(CORPUS_CATEGORY_META[b].ordinal))
      .map((p) => ({ value: p, label: CORPUS_CATEGORY_META[p].label })),
    state: (Object.keys(REVIEW_FILTER_LABELS) as ReviewFilter[]).map((s) => ({ value: s, label: REVIEW_FILTER_LABELS[s] })),
  };
}

export function parseFilters(get: (k: string) => string | undefined): Filters {
  const state = get('state');
  return {
    source: get('source') ?? '',
    tradition: get('tradition') ?? '',
    language: get('language') ?? '',
    period: get('period') ?? '',
    state: state && state in REVIEW_FILTER_LABELS ? (state as ReviewFilter) : '',
  };
}

export function anyFilter(f: Filters): boolean {
  return Object.values(f).some(Boolean);
}

export function matchesFilters(record: AbrahamMosesRecord, claim: Claim, f: Filters): boolean {
  const r = record.current(claim);
  const works = witnessWorks(r);
  if (f.source && !works.includes(f.source)) return false;
  if (f.tradition && !claimTraditions(r).includes(f.tradition)) return false;
  if (f.language && !works.some((w) => record.work(w)?.edition.language === f.language)) return false;
  if (f.period && !works.some((w) => record.work(w)?.category === f.period)) return false;
  if (f.state === 'provisional' && r.status !== 'provisional') return false;
  if (f.state === 'editor_verified' && !isEditorVerified(r.status)) return false;
  if (f.state === 'externally_reviewed' && r.status !== 'externally_reviewed') return false;
  return true;
}

/* ------------------------------------------------------------------ assumptions and outcomes */

export function parseOff(record: AbrahamMosesRecord, raw: string | undefined): string[] {
  return [...new Set((raw ?? '').split(',').map((s) => s.trim()).filter((a) => record.axiom(a)))].sort();
}

export interface Outcomes {
  sim: SimulationResult;
  claim(code: string): EpistemicStatus;
  derivationValid(code: string): boolean;
}

export function outcomes(record: AbrahamMosesRecord, off: string[]): Outcomes {
  const sim = simulate(record.graph(), { rejectAxioms: off });
  return {
    sim,
    claim: (code) => EPISTEMIC_STATUS_OF[sim.statuses[code] ?? 'stands'],
    derivationValid: (code) => sim.derivations[code]?.valid ?? true,
  };
}

export function outcomeLabel(s: EpistemicStatus) {
  return EPISTEMIC_META[s].label;
}

/* ------------------------------------------------------------------ disagreement inside a tradition */

/**
 * For each position, the traditions of the same family as its holders that qualify,
 * dispute or reject it, with the note the record gives.
 */
export function intraTradition(record: AbrahamMosesRecord, positions: Position[]) {
  return positions
    .map((p) => {
      const r = record.current(record.claim(p.claim)!);
      const within = r.acceptance.filter(
        (a) => ['qualifies', 'disputes', 'rejects'].includes(a.stance) && record.tradition(a.tradition)?.family === p.family,
      );
      return { position: p, entries: within };
    })
    .filter((x) => x.entries.length > 0);
}

/* ------------------------------------------------------------------ coverage (§8 components) */

export type CoverageMark = 'covered' | 'partial' | 'missing';
export function coverageItems(record: AbrahamMosesRecord, d: Dossier): Array<{ component: string; mark: CoverageMark; detail: string }> {
  const revs = d.claims.map((c) => record.current(record.claim(c)!));
  const hist = revs.filter((r) => r.classification === 'historical_claim').length;
  const phil = revs.filter((r) => r.classification === 'philological_claim').length;
  const verified = revs.filter((r) => isEditorVerified(r.status)).length;
  return [
    { component: 'Question and scope', mark: 'covered', detail: d.mode === 'case' ? 'published case framing' : 'stated above' },
    { component: 'Corpus coverage', mark: 'covered', detail: `${d.claims.length} records` },
    { component: 'Primary source inventory', mark: 'covered', detail: `${new Set(revs.flatMap((r) => r.primaryWitnesses.map((w) => w.work))).size} works cited` },
    {
      component: 'Historical and linguistic context',
      mark: hist && phil ? 'covered' : hist || phil || d.covenants.length ? 'partial' : 'missing',
      detail: `${hist} historical, ${phil} philological${d.covenants.length ? `, ${d.covenants.length} covenant relations` : ''}`,
    },
    { component: 'Scholarly and tradition positions', mark: d.positions.length ? 'covered' : 'missing', detail: `${d.positions.length} positions` },
    { component: 'Contrary evidence', mark: d.counterModels.length ? 'covered' : 'missing', detail: `${d.counterModels.length} counter-models` },
    { component: 'Argument structure', mark: d.derivations.length ? 'covered' : 'missing', detail: `${d.derivations.length} derivations` },
    { component: 'Interpretive dependencies', mark: d.axioms.length ? 'covered' : 'missing', detail: `${d.axioms.length} assumptions` },
    { component: 'Uncertainties and gaps', mark: d.gaps.length || d.limitations.length ? 'covered' : 'partial', detail: `${d.gaps.length + d.limitations.length} listed` },
    { component: 'Editorial review', mark: verified === revs.length ? 'covered' : verified ? 'partial' : 'missing', detail: `${verified} of ${revs.length} editor-verified` },
    { component: 'Reproducibility manifest', mark: 'covered', detail: 'in both exports' },
  ];
}

/* ------------------------------------------------------------------ pipeline replay */

/**
 * The seven analysis steps, replayed over the published record. No model is called:
 * each step's output is a count computed from the records in this dossier.
 */
export function pipelineSteps(record: AbrahamMosesRecord, d: Dossier): Array<{ code: string; label: string; output: string; hold?: boolean }> {
  const revs = d.claims.map((c) => record.current(record.claim(c)!));
  const works = new Set(revs.flatMap((r) => r.primaryWitnesses.map((w) => w.work)));
  const witnesses = revs.reduce((n, r) => n + r.primaryWitnesses.length, 0);
  const phil = revs.filter((r) => r.classification === 'philological_claim').length;
  const hist = revs.filter((r) => r.classification === 'historical_claim').length;
  const variants = revs.reduce((n, r) => n + r.variants.length, 0);
  const trads = new Set(revs.flatMap((r) => r.acceptance.filter((a) => a.stance !== 'not_addressed').map((a) => a.tradition)));
  const quotations = revs.reduce((n, r) => n + r.quotations.length, 0);
  const verified = revs.filter((r) => isEditorVerified(r.status)).length;
  const disputed = revs.filter((r) => /^yes/i.test(r.disputed)).length;
  return [
    { code: 'SD', label: 'Source discovery', output: `${d.claims.length} records · ${works.size} works · ${witnesses} witness references` },
    { code: 'LX', label: 'Linguistic', output: `${phil} philological claims · ${variants} recorded variants` },
    { code: 'HX', label: 'Historical', output: `${d.covenants.length ? `${d.covenants.length} covenant-map relations · ` : ''}${hist} historical claims` },
    { code: 'CP', label: 'Comparative', output: `${trads.size} traditions with recorded stances · ${d.positions.length} positions` },
    { code: 'AR', label: 'Argument', output: `${d.derivations.length} derivations · ${d.axioms.length} declared assumptions` },
    { code: 'AV', label: 'Adversarial review', output: `${d.counterModels.length} counter-models · ${disputed} records marked disputed` },
    {
      code: 'PA',
      label: 'Provenance audit',
      output: `${quotations} quotations · ${verified} of ${revs.length} current revisions editor-verified → held as provisional`,
      hold: verified < revs.length,
    },
  ];
}

/* ------------------------------------------------------------------ permalinks, manifest, export */

export function dossierPath(d: Pick<Dossier, 'mode' | 'id' | 'question'>, extra: Record<string, string | undefined> = {}): string {
  const p = new URLSearchParams();
  if (d.mode === 'case') p.set('case', d.id);
  else if (d.mode === 'vision') p.set('dossier', d.id);
  else p.set('q', d.question);
  for (const [k, v] of Object.entries(extra)) if (v) p.set(k, v);
  return `/research?${p.toString()}`;
}

export function claimPermalink(record: AbrahamMosesRecord, code: string): string {
  const c = record.claim(code)!;
  return `/claims/${code}?rev=${record.current(c).rev}`;
}

export function manifest(record: AbrahamMosesRecord, d: Dossier, off: string[], filters: Filters) {
  return {
    record_version: record.version,
    question: d.question,
    dossier: d.mode === 'case' ? `case:${d.id}` : d.mode === 'vision' ? `dossier:${d.id}` : d.mode,
    claims: d.claims.map((c) => `${c}@rev${record.current(record.claim(c)!).rev}`),
    derivations: d.derivations,
    counter_models: d.counterModels,
    covenant_relations: d.covenants,
    assumptions_declared: d.axioms,
    assumptions_set_aside: off,
    simulation: off.length ? { endpoint: 'POST /api/v1/simulate', body: { reject_axioms: off } } : { baseline: true },
    filters: Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
    endpoints: ['GET /api/v1/claims/{code}?rev={n}', 'GET /api/v1/counter-models/{code}', 'GET /api/v1/covenants', ...(d.mode === 'case' ? [`GET /api/v1/cases/${d.id}`] : [])],
    generated_by: 'AbrahamMoses research workspace: retrieval and assembly only; no model call, no generated text.',
  };
}

function slim(record: AbrahamMosesRecord, code: string) {
  const claim = record.claim(code)!;
  const r = record.current(claim);
  return {
    code,
    revision: r.rev,
    statement: r.statement,
    classification: r.classification,
    classification_label: CLASSIFICATION_META[r.classification].label,
    witnesses: r.primaryWitnesses.map((w) => w.display),
    review_state: r.status,
    editor_verified: isEditorVerified(r.status),
    permalink: claimPermalink(record, code),
  };
}

export function exportDossier(record: AbrahamMosesRecord, d: Dossier, off: string[], filters: Filters) {
  const out = outcomes(record, off);
  const visible = d.claims.filter((c) => matchesFilters(record, record.claim(c)!, filters));
  const col = (k: Column) => visible.filter((c) => columnOf(record.current(record.claim(c)!).classification) === k).map((c) => slim(record, c));
  const derivs = d.derivations.map((code) => record.data.derivations.find((x) => x.code === code)!) as Derivation[];
  return {
    manifest: manifest(record, d, off, filters),
    question: d.question,
    title: d.title,
    coverage: d.coverage,
    scope: d.scope,
    review: { external_reviews: 0, named_reviewers: [], note: 'No reviewer is listed who has not reviewed.' },
    coverage_components: coverageItems(record, d).map(({ component, mark, detail }) => ({ component, status: mark, detail })),
    direct_evidence: col('direct'),
    interpretations: col('interpretation'),
    inferences: [
      ...col('inference'),
      ...derivs
        .filter((x) => visible.includes(x.claim))
        .map((x) => ({
          derivation: x.code,
          label: x.label,
          conclusion: x.claim,
          premises: x.premises.map((p) => `${p.claim} (${p.necessity})`),
          assumptions: x.axioms.map((a) => `${a.axiom} (${a.role})`),
          outcome_under_selected_assumptions: outcomeLabel(out.claim(x.claim)),
          valid_under_selected_assumptions: out.derivationValid(x.code),
        })),
    ],
    unresolved: {
      counter_models: d.counterModels.map((code) => {
        const m = record.counterModel(code)!;
        return { code, title: m.title, thesis: m.thesis, held_by: m.heldBy, targets: m.targets };
      }),
      gaps: d.gaps.map((g) => ({ text: g.text, basis: g.basis, source: 'computed from the record' })),
      limitations: d.limitations,
    },
  };
}

export function exportMarkdown(record: AbrahamMosesRecord, d: Dossier, off: string[], filters: Filters): string {
  const o = exportDossier(record, d, off, filters);
  const L: string[] = [];
  L.push(`# ${d.question}`, '');
  L.push(
    `> AbrahamMoses research dossier (${d.coverage} coverage). Record version ${record.version}. Every statement below is a published record statement, quoted verbatim; none has been externally reviewed.`,
    '',
  );
  if (d.scope) L.push(d.scope, '');
  const claims = (title: string, list: Array<ReturnType<typeof slim> | Record<string, unknown>>) => {
    L.push(`## ${title}`, '');
    if (!list.length) L.push('_None in the record for this view._');
    for (const c of list) {
      if ('code' in c && 'statement' in c) {
        const s = c as ReturnType<typeof slim>;
        L.push(`- **${s.code}** (${s.classification_label}; ${s.review_state}): ${s.statement} — ${s.witnesses.join('; ')} · ${s.permalink}`);
      } else {
        const x = c as { derivation: string; label: string; premises: string[]; assumptions: string[]; conclusion: string; outcome_under_selected_assumptions: string };
        L.push(`- **${x.derivation}** ${x.label}: ${[...x.premises, ...x.assumptions].join(' + ')} → ${x.conclusion} — ${x.outcome_under_selected_assumptions}`);
      }
    }
    L.push('');
  };
  claims('Direct evidence', o.direct_evidence);
  claims('Interpretations', o.interpretations);
  claims('Inferences', o.inferences);
  L.push('## Unresolved questions', '');
  for (const m of o.unresolved.counter_models) L.push(`- Counter-model **${m.code}** “${m.title}” (${m.held_by}): ${m.thesis}`);
  for (const g of o.unresolved.gaps) L.push(`- Gap: ${g.text} _(computed from the record: ${g.basis})_`);
  for (const l of o.unresolved.limitations) L.push(`- Limitation: ${l}`);
  L.push('', '## Coverage', '');
  for (const c of o.coverage_components) L.push(`- ${c.component}: ${c.status} (${c.detail})`);
  L.push('', '## Reproducibility manifest', '', '```json', JSON.stringify(o.manifest, null, 2), '```', '');
  return L.join('\n');
}

export const FAMILY_ORDER = (Object.keys(FAMILY_META) as TraditionFamily[]).sort((a, b) => FAMILY_META[a].ordinal - FAMILY_META[b].ordinal);

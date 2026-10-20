/**
 * Deterministic Decision Twin engine.
 *
 * Plain arithmetic on the synthetic case, over an explicit dependency graph.
 * There is no model, no randomness and no clock: the same inputs always give
 * the same outputs, and changing one input changes only the nodes that depend
 * on it (tests/decision-room.test.ts proves both). It produces no probability
 * of default and makes no decision; it reports which conditions are met on the
 * given inputs and which need human judgment.
 */
import { z } from 'zod';
import { canonicalJson } from '../../canonical';
import { DOCUMENTS, docValue } from './case';

/* ----------------------------------------------------------------- inputs */

export const PREMISES = [
  {
    id: 'P1',
    statement: 'Management’s 12% revenue growth for FY2026 is achievable.',
    sources: ['DOC-02'],
    ifRejected: 'Revenue growth falls back to FY2025 actual growth of 4.0% (DOC-01).',
  },
  {
    id: 'P2',
    statement: 'Management’s 17.5% EBITDA margin for FY2026 is achievable.',
    sources: ['DOC-02'],
    ifRejected: 'EBITDA margin falls back to the FY2025 reported margin of 16.0% (DOC-01).',
  },
  {
    id: 'P3',
    statement: 'The top customer renews on current terms in Q1 2027.',
    sources: ['DOC-02', 'DOC-07'],
    ifRejected: 'Revenue loses half of the top customer’s share (dual-sourcing, DOC-07).',
  },
] as const;
export type PremiseId = (typeof PREMISES)[number]['id'];
const PREMISE_IDS = PREMISES.map((p) => p.id) as [PremiseId, ...PremiseId[]];

export const HISTORICAL_GROWTH = Math.round((docValue('DOC-01', 'revenue_fy2025') / docValue('DOC-01', 'revenue_fy2024') - 1) * 1000) / 10; // 4.0
const BASE_REVENUE = docValue('DOC-01', 'revenue_fy2025');
const REPORTED_MARGIN = docValue('DOC-01', 'ebitda_margin_fy2025');
const CASH = docValue('DOC-03', 'cash_at_close');
const RCF_UNDRAWN = docValue('DOC-03', 'rcf_undrawn');
const MIN_COVER = docValue('DOC-05', 'min_interest_cover');
const CONCENTRATION_LIMIT = docValue('DOC-04', 'concentration_policy');
const STRESS = docValue('DOC-04', 'stress_ebitda_decline');
const SECTOR_GROWTH = docValue('DOC-09', 'sector_growth');
/** Documents the calculations rest on; the verification condition requires all three. */
export const KEY_DOCUMENTS = ['DOC-01', 'DOC-03', 'DOC-05'];

export interface Control {
  key: NumericKey;
  param: string;
  label: string;
  unit: '%' | '$M' | 'x';
  min: number;
  max: number;
  step: number;
  default: number;
  source: string;
}

export const CONTROLS = [
  { key: 'growth', param: 'g', label: 'Revenue growth FY2026', unit: '%', min: -20, max: 30, step: 0.5, default: docValue('DOC-02', 'revenue_growth_fy2026'), source: 'DOC-02' },
  { key: 'margin', param: 'm', label: 'EBITDA margin', unit: '%', min: 5, max: 30, step: 0.5, default: docValue('DOC-02', 'ebitda_margin_fy2026'), source: 'DOC-02' },
  { key: 'debt', param: 'd', label: 'Total debt at close', unit: '$M', min: 50, max: 200, step: 1, default: docValue('DOC-03', 'total_debt'), source: 'DOC-03' },
  { key: 'interest', param: 'i', label: 'Annual interest expense', unit: '$M', min: 2, max: 25, step: 0.1, default: docValue('DOC-03', 'interest_expense'), source: 'DOC-03' },
  { key: 'covMax', param: 'c', label: 'Leverage covenant ceiling', unit: 'x', min: 2, max: 6, step: 0.25, default: docValue('DOC-05', 'max_leverage'), source: 'DOC-05' },
  { key: 'minLiq', param: 'l', label: 'Minimum liquidity requirement', unit: '$M', min: 0, max: 40, step: 1, default: docValue('DOC-05', 'min_liquidity'), source: 'DOC-05' },
  { key: 'concentration', param: 'k', label: 'Top customer share of revenue', unit: '%', min: 0, max: 60, step: 1, default: docValue('DOC-07', 'top_customer_share'), source: 'DOC-07' },
] as const satisfies readonly Control[];

type NumericKey = 'growth' | 'margin' | 'debt' | 'interest' | 'covMax' | 'minLiq' | 'concentration';

export interface Assumptions {
  growth: number;
  margin: number;
  debt: number;
  interest: number;
  covMax: number;
  minLiq: number;
  concentration: number;
  /** Document IDs treated as verified. */
  verified: string[];
  /** Premises the user rejected. */
  rejected: PremiseId[];
}

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  ...(Object.fromEntries(CONTROLS.map((c) => [c.key, c.default])) as Record<NumericKey, number>),
  verified: DOCUMENTS.filter((d) => d.verification === 'verified').map((d) => d.id),
  rejected: [],
};

const DOC_IDS = DOCUMENTS.map((d) => d.id);

export const AssumptionsSchema = z
  .object({
    growth: z.number().min(-20).max(30),
    margin: z.number().min(5).max(30),
    debt: z.number().min(50).max(200),
    interest: z.number().min(2).max(25),
    covMax: z.number().min(2).max(6),
    minLiq: z.number().min(0).max(40),
    concentration: z.number().min(0).max(60),
    verified: z.array(z.enum(DOC_IDS as [string, ...string[]])).max(DOC_IDS.length),
    rejected: z.array(z.enum(PREMISE_IDS)).max(PREMISE_IDS.length),
  })
  .strict();

export function normalise(a: Assumptions): Assumptions {
  return {
    ...a,
    verified: [...new Set(a.verified)].sort(),
    rejected: [...new Set(a.rejected)].sort() as PremiseId[],
  };
}

/** Read assumptions from URL search params. Missing or invalid values fall back to the case defaults. */
export function parseAssumptions(params: Record<string, string | string[] | undefined>): Assumptions {
  const one = (k: string) => (Array.isArray(params[k]) ? params[k]![0] : params[k]) as string | undefined;
  const out: Assumptions = { ...DEFAULT_ASSUMPTIONS };
  for (const c of CONTROLS) {
    const raw = one(c.param);
    if (raw === undefined || raw === '') continue;
    const n = Number(raw);
    if (Number.isFinite(n) && n >= c.min && n <= c.max) out[c.key] = n;
  }
  // Lists arrive as "a,b" (links) or repeated keys (form checkboxes). A form also
  // sends vset=1, so "no document ticked" is distinguishable from "not given".
  const all = (k: string) => {
    const raw = params[k];
    return (Array.isArray(raw) ? raw : raw === undefined ? [] : [raw]).flatMap((x) => x.split(',')).filter(Boolean);
  };
  if (params.v !== undefined || one('vset') === '1') {
    out.verified = all('v').filter((x) => DOC_IDS.includes(x));
  }
  out.rejected = all('r').filter((x): x is PremiseId => (PREMISE_IDS as string[]).includes(x));
  return normalise(out);
}

/** The URL query for a set of assumptions (only what differs from the defaults). */
export function assumptionsQuery(a: Assumptions): string {
  const q = new URLSearchParams();
  const n = normalise(a);
  for (const c of CONTROLS) if (n[c.key] !== c.default) q.set(c.param, String(n[c.key]));
  const dv = normalise(DEFAULT_ASSUMPTIONS).verified;
  if (canonicalJson(n.verified) !== canonicalJson(dv)) q.set('v', n.verified.length ? n.verified.join(',') : 'none');
  if (n.rejected.length) q.set('r', n.rejected.join(','));
  return q.toString();
}

/* ------------------------------------------------------------------ graph */

export type NodeKind = 'input' | 'premise' | 'effective' | 'metric' | 'condition' | 'warning' | 'conclusion';
export type ConditionStatus = 'MET' | 'NOT_MET' | 'NEEDS_HUMAN_JUDGMENT' | 'EVIDENCE_MISSING';

export interface EvaluatedNode {
  id: string;
  kind: NodeKind;
  label: string;
  deps: string[];
  sources: string[];
  value: number | string | boolean | null;
  display: string;
  formula?: string;
  status?: ConditionStatus | 'ACTIVE' | 'CLEAR';
  note?: string;
}

const r4 = (n: number) => Math.round(n * 10000) / 10000;
const f1 = (n: number) => n.toFixed(1);
const f2 = (n: number) => n.toFixed(2);

interface Def {
  id: string;
  kind: NodeKind;
  label: string;
  deps: string[];
  sources: string[];
  formula?: string;
  compute: (a: Assumptions, v: (id: string) => number | string | boolean | null) => Omit<EvaluatedNode, 'id' | 'kind' | 'label' | 'deps' | 'sources' | 'formula'>;
}

const num = (v: (id: string) => unknown, id: string) => v(id) as number;

const DEFS: Def[] = [
  ...CONTROLS.map<Def>((c) => ({
    id: `in.${c.key}`,
    kind: 'input',
    label: c.label,
    deps: [],
    sources: [c.source],
    compute: (a) => ({ value: a[c.key], display: `${c.unit === '$M' ? '$' : ''}${a[c.key]}${c.unit === '$M' ? 'M' : c.unit}` }),
  })),
  {
    id: 'in.verified',
    kind: 'input',
    label: 'Documents treated as verified',
    deps: [],
    sources: [],
    compute: (a) => ({ value: a.verified.join(','), display: a.verified.length ? a.verified.join(', ') : 'none' }),
  },
  ...PREMISES.map<Def>((p) => ({
    id: `prem.${p.id}`,
    kind: 'premise',
    label: p.statement,
    deps: [],
    sources: [...p.sources],
    compute: (a) => {
      const rejected = a.rejected.includes(p.id);
      return { value: !rejected, display: rejected ? 'Rejected' : 'Accepted' };
    },
  })),
  {
    id: 'e.growth',
    kind: 'effective',
    label: 'Revenue growth used',
    deps: ['in.growth', 'prem.P1'],
    sources: ['DOC-01', 'DOC-02'],
    formula: 'P1 accepted ? growth input : FY2025 actual growth',
    compute: (a, v) => {
      const g = v('prem.P1') ? a.growth : HISTORICAL_GROWTH;
      return { value: g, display: `${f1(g)}%` };
    },
  },
  {
    id: 'e.margin',
    kind: 'effective',
    label: 'EBITDA margin used',
    deps: ['in.margin', 'prem.P2'],
    sources: ['DOC-01', 'DOC-02'],
    formula: 'P2 accepted ? margin input : FY2025 reported margin',
    compute: (a, v) => {
      const m = v('prem.P2') ? a.margin : REPORTED_MARGIN;
      return { value: m, display: `${f1(m)}%` };
    },
  },
  {
    id: 'm.revenue',
    kind: 'metric',
    label: 'FY2026 revenue',
    deps: ['e.growth', 'prem.P3', 'in.concentration'],
    sources: ['DOC-01', 'DOC-07'],
    formula: `FY2025 revenue ($${BASE_REVENUE}M) × (1 + growth) × (P3 accepted ? 1 : 1 − top customer share ÷ 2)`,
    compute: (a, v) => {
      const lost = v('prem.P3') ? 0 : a.concentration / 200;
      const rev = BASE_REVENUE * (1 + num(v, 'e.growth') / 100) * (1 - lost);
      return { value: r4(rev), display: `$${f1(rev)}M` };
    },
  },
  {
    id: 'm.ebitda',
    kind: 'metric',
    label: 'FY2026 EBITDA',
    deps: ['m.revenue', 'e.margin'],
    sources: [],
    formula: 'Revenue × EBITDA margin',
    compute: (_a, v) => {
      const e = (num(v, 'm.revenue') * num(v, 'e.margin')) / 100;
      return { value: r4(e), display: `$${f1(e)}M` };
    },
  },
  {
    id: 'm.leverage',
    kind: 'metric',
    label: 'Debt / EBITDA',
    deps: ['in.debt', 'm.ebitda'],
    sources: ['DOC-03'],
    formula: 'Total debt ÷ EBITDA',
    compute: (a, v) => {
      const x = a.debt / num(v, 'm.ebitda');
      return { value: r4(x), display: `${f2(x)}x` };
    },
  },
  {
    id: 'm.coverage',
    kind: 'metric',
    label: 'Interest coverage',
    deps: ['m.ebitda', 'in.interest'],
    sources: ['DOC-03'],
    formula: 'EBITDA ÷ annual interest expense',
    compute: (a, v) => {
      const x = num(v, 'm.ebitda') / a.interest;
      return { value: r4(x), display: `${f2(x)}x` };
    },
  },
  {
    id: 'm.liquidity',
    kind: 'metric',
    label: 'Liquidity at close',
    deps: [],
    sources: ['DOC-03'],
    formula: `Cash at close ($${CASH}M) + undrawn revolver ($${RCF_UNDRAWN}M)`,
    compute: () => ({ value: CASH + RCF_UNDRAWN, display: `$${f1(CASH + RCF_UNDRAWN)}M` }),
  },
  {
    id: 'm.liquidityHeadroom',
    kind: 'metric',
    label: 'Liquidity headroom',
    deps: ['m.liquidity', 'in.minLiq'],
    sources: ['DOC-05'],
    formula: 'Liquidity − minimum liquidity requirement',
    compute: (a, v) => {
      const h = num(v, 'm.liquidity') - a.minLiq;
      return { value: r4(h), display: `$${f1(h)}M` };
    },
  },
  {
    id: 'm.covenantHeadroom',
    kind: 'metric',
    label: 'Leverage covenant headroom',
    deps: ['m.leverage', 'in.covMax'],
    sources: ['DOC-05'],
    formula: '(Covenant ceiling − Debt/EBITDA) ÷ covenant ceiling = how far EBITDA can fall before a breach',
    compute: (a, v) => {
      const h = ((a.covMax - num(v, 'm.leverage')) / a.covMax) * 100;
      return { value: r4(h), display: `${f1(h)}% (${f2(a.covMax - num(v, 'm.leverage'))}x)` };
    },
  },
  {
    id: 'm.stressEbitda',
    kind: 'metric',
    label: `Stress case EBITDA (−${STRESS}%)`,
    deps: ['m.ebitda'],
    sources: ['DOC-04'],
    formula: `EBITDA × (1 − ${STRESS}%)`,
    compute: (_a, v) => {
      const e = num(v, 'm.ebitda') * (1 - STRESS / 100);
      return { value: r4(e), display: `$${f1(e)}M` };
    },
  },
  {
    id: 'm.stressLeverage',
    kind: 'metric',
    label: 'Stress case Debt / EBITDA',
    deps: ['in.debt', 'm.stressEbitda'],
    sources: ['DOC-03', 'DOC-04'],
    formula: 'Total debt ÷ stress case EBITDA',
    compute: (a, v) => {
      const x = a.debt / num(v, 'm.stressEbitda');
      return { value: r4(x), display: `${f2(x)}x` };
    },
  },
  {
    id: 'm.stressCoverage',
    kind: 'metric',
    label: 'Stress case interest coverage',
    deps: ['m.stressEbitda', 'in.interest'],
    sources: ['DOC-03', 'DOC-04'],
    formula: 'Stress case EBITDA ÷ annual interest expense',
    compute: (a, v) => {
      const x = num(v, 'm.stressEbitda') / a.interest;
      return { value: r4(x), display: `${f2(x)}x` };
    },
  },
  cond('k.leverage', 'Debt / EBITDA within the leverage covenant', ['m.leverage', 'in.covMax'], ['DOC-05'], (a, v) =>
    num(v, 'm.leverage') <= a.covMax ? ['MET', `${f2(num(v, 'm.leverage'))}x ≤ ${a.covMax}x`] : ['NOT_MET', `${f2(num(v, 'm.leverage'))}x > ${a.covMax}x`],
  ),
  cond('k.coverage', `Interest coverage at least ${MIN_COVER.toFixed(2)}x`, ['m.coverage'], ['DOC-05'], (_a, v) =>
    num(v, 'm.coverage') >= MIN_COVER ? ['MET', `${f2(num(v, 'm.coverage'))}x ≥ ${MIN_COVER}x`] : ['NOT_MET', `${f2(num(v, 'm.coverage'))}x < ${MIN_COVER}x`],
  ),
  cond('k.liquidity', 'Liquidity above the minimum requirement', ['m.liquidityHeadroom'], ['DOC-05'], (_a, v) =>
    num(v, 'm.liquidityHeadroom') >= 0 ? ['MET', `headroom $${f1(num(v, 'm.liquidityHeadroom'))}M`] : ['NOT_MET', `shortfall $${f1(-num(v, 'm.liquidityHeadroom'))}M`],
  ),
  cond('k.concentration', `Top customer at most ${CONCENTRATION_LIMIT}% of revenue (policy)`, ['in.concentration'], ['DOC-04', 'DOC-07'], (a) =>
    a.concentration <= CONCENTRATION_LIMIT ? ['MET', `${a.concentration}% ≤ ${CONCENTRATION_LIMIT}%`] : ['NOT_MET', `${a.concentration}% > ${CONCENTRATION_LIMIT}%: needs a policy exception`],
  ),
  cond('k.stress', 'Stress case leverage within the covenant', ['m.stressLeverage', 'in.covMax'], ['DOC-04', 'DOC-05'], (a, v) =>
    num(v, 'm.stressLeverage') <= a.covMax ? ['MET', `${f2(num(v, 'm.stressLeverage'))}x ≤ ${a.covMax}x`] : ['NOT_MET', `${f2(num(v, 'm.stressLeverage'))}x > ${a.covMax}x`],
  ),
  cond('k.verification', 'Key documents verified (financials, debt schedule, loan agreement)', ['in.verified'], KEY_DOCUMENTS, (a) => {
    const missing = KEY_DOCUMENTS.filter((d) => !a.verified.includes(d));
    return missing.length === 0 ? ['MET', 'DOC-01, DOC-03 and DOC-05 verified'] : ['NOT_MET', `unverified: ${missing.join(', ')}`];
  }),
  cond('k.debtReconciled', 'Total debt reconciled between memo and debt schedule', ['in.debt'], ['DOC-03', 'DOC-04'], (a) => [
    'NEEDS_HUMAN_JUDGMENT',
    `memo $118.0M vs schedule $124.0M; calculations use $${a.debt}M`,
  ]),
  cond('k.ebitdaDefinition', 'Covenant EBITDA definition agreed', [], ['DOC-05', 'DOC-06'], () => [
    'NEEDS_HUMAN_JUDGMENT',
    'draft agreement has no add-back cap; term sheet caps add-backs at 10%',
  ]),
  cond('k.collateral', 'Collateral value supported by the cited appraisal', [], ['DOC-08'], () => ['EVIDENCE_MISSING', 'appraisal A-2026-03 is not in the data room']),
  warn('w.forecastVsHistory', 'Forecast growth well above history and sector outlook', ['e.growth'], ['DOC-01', 'DOC-02', 'DOC-09'], (_a, v) => {
    const g = num(v, 'e.growth');
    return g > 2 * HISTORICAL_GROWTH ? `${f1(g)}% growth against ${f1(HISTORICAL_GROWTH)}% in FY2025 and a ${SECTOR_GROWTH}% sector outlook` : null;
  }),
  warn('w.thinCushion', 'Thin covenant headroom (under 25%)', ['m.covenantHeadroom'], ['DOC-05'], (_a, v) =>
    num(v, 'm.covenantHeadroom') < 25 ? `EBITDA can fall only ${f1(num(v, 'm.covenantHeadroom'))}% before a leverage breach` : null,
  ),
  warn('w.stressCoverage', `Stress case coverage below ${MIN_COVER}x`, ['m.stressCoverage'], ['DOC-04', 'DOC-05'], (_a, v) =>
    num(v, 'm.stressCoverage') < MIN_COVER ? `${f2(num(v, 'm.stressCoverage'))}x under stress` : null,
  ),
  warn('w.renewal', 'Forecast relies on the top customer renewing', ['prem.P3', 'in.concentration'], ['DOC-02', 'DOC-07'], (a, v) =>
    v('prem.P3') && a.concentration >= 15 ? `${a.concentration}% of revenue renews in Q1 2027; the customer has signalled dual-sourcing` : null,
  ),
  warn('w.unverified', 'Calculations rely on unverified documents', ['in.verified'], KEY_DOCUMENTS, (a) => {
    const missing = KEY_DOCUMENTS.filter((d) => !a.verified.includes(d));
    return missing.length ? `${missing.join(', ')} not verified` : null;
  }),
];

function cond(id: string, label: string, deps: string[], sources: string[], rule: (a: Assumptions, v: (id: string) => unknown) => [ConditionStatus, string]): Def {
  return {
    id,
    kind: 'condition',
    label,
    deps,
    sources,
    compute: (a, v) => {
      const [status, note] = rule(a, v);
      return { value: status, display: status, status, note };
    },
  };
}

function warn(id: string, label: string, deps: string[], sources: string[], rule: (a: Assumptions, v: (id: string) => unknown) => string | null): Def {
  return {
    id,
    kind: 'warning',
    label,
    deps,
    sources,
    compute: (a, v) => {
      const note = rule(a, v);
      return { value: note !== null, display: note ? 'Active' : 'Clear', status: note ? 'ACTIVE' : 'CLEAR', ...(note ? { note } : {}) };
    },
  };
}

const CONDITION_IDS = DEFS.filter((d) => d.kind === 'condition').map((d) => d.id);
DEFS.push({
  id: 'conclusion',
  kind: 'conclusion',
  label: 'What the evidence supports',
  deps: CONDITION_IDS,
  sources: [],
  compute: (_a, v) => {
    const s = CONDITION_IDS.map((id) => v(id) as ConditionStatus);
    const n = (x: ConditionStatus) => s.filter((y) => y === x).length;
    const text = `${n('MET')} of ${s.length} conditions met; ${n('NOT_MET')} not met; ${n('NEEDS_HUMAN_JUDGMENT')} need human judgment; ${n('EVIDENCE_MISSING')} missing evidence. No approval is made here.`;
    return { value: text, display: text };
  },
});

export const NODE_IDS = DEFS.map((d) => d.id);
export const GRAPH: Record<string, string[]> = Object.fromEntries(DEFS.map((d) => [d.id, d.deps]));

/** Every node that depends, directly or transitively, on any of the given nodes. */
export function dependentsOf(ids: string[]): string[] {
  const out = new Set<string>();
  let frontier = [...ids];
  while (frontier.length) {
    const next: string[] = [];
    for (const d of DEFS) if (!out.has(d.id) && d.deps.some((x) => frontier.includes(x))) {
      out.add(d.id);
      next.push(d.id);
    }
    frontier = next;
  }
  return NODE_IDS.filter((id) => out.has(id));
}

export type Evaluation = Record<string, EvaluatedNode>;

export function evaluate(input: Assumptions): Evaluation {
  const a = normalise(AssumptionsSchema.parse(input) as Assumptions);
  const out: Evaluation = {};
  const v = (id: string) => {
    const n = out[id];
    if (!n) throw new Error(`Node ${id} evaluated before its dependency`);
    return n.value;
  };
  for (const d of DEFS) {
    out[d.id] = { id: d.id, kind: d.kind, label: d.label, deps: d.deps, sources: d.sources, ...(d.formula ? { formula: d.formula } : {}), ...d.compute(a, v) };
  }
  return out;
}

/* ------------------------------------------------------------ audit trace */

export interface TraceEntry {
  input: string;
  label: string;
  from: string;
  to: string;
}

export interface Trace {
  changes: TraceEntry[];
  /** Nodes downstream of the changed inputs (the graph says they may change). */
  dependents: string[];
  /** Nodes whose value actually changed against the case defaults. */
  affected: string[];
}

/** What a node shows: value, display and note. Two evaluations agree on a node when these match. */
export function fingerprint(n: EvaluatedNode): string {
  return canonicalJson({ value: n.value, display: n.display, note: n.note ?? null });
}

/** What changed against the case defaults, and which conclusions it reached. */
export function traceFromDefaults(a: Assumptions): Trace {
  const base = evaluate(DEFAULT_ASSUMPTIONS);
  const cur = evaluate(a);
  const inputs = NODE_IDS.filter((id) => GRAPH[id].length === 0 && (base[id].kind === 'input' || base[id].kind === 'premise'));
  const changedInputs = inputs.filter((id) => canonicalJson(base[id].value) !== canonicalJson(cur[id].value));
  return {
    changes: changedInputs.map((id) => ({ input: id, label: cur[id].label, from: base[id].display, to: cur[id].display })),
    dependents: dependentsOf(changedInputs),
    affected: NODE_IDS.filter((id) => !changedInputs.includes(id) && fingerprint(base[id]) !== fingerprint(cur[id])),
  };
}

/* ---------------------------------------------------- selective recalculation */

/**
 * Re-evaluate only what a change can reach: the inputs and premises whose value differs from `prev`, and the nodes
 * downstream of them (`dependentsOf`). Every other node is carried over from `prev` unchanged. Gives the same result
 * as `evaluate(input)` for every node (tests/counterfactual.test.ts checks this against full evaluation).
 */
export function recalculate(prev: Evaluation, input: Assumptions): { evaluation: Evaluation; changedInputs: string[]; recomputed: string[] } {
  const a = normalise(AssumptionsSchema.parse(input) as Assumptions);
  const out: Evaluation = {};
  const v = (id: string) => {
    const n = out[id];
    if (!n) throw new Error(`Node ${id} evaluated before its dependency`);
    return n.value;
  };
  const roots = DEFS.filter((d) => d.deps.length === 0 && (d.kind === 'input' || d.kind === 'premise'));
  const changedInputs: string[] = [];
  for (const d of roots) {
    const next = d.compute(a, v);
    if (!prev[d.id] || canonicalJson(prev[d.id].value) !== canonicalJson(next.value)) changedInputs.push(d.id);
  }
  const dirty = new Set([...changedInputs, ...dependentsOf(changedInputs)]);
  const recomputed: string[] = [];
  for (const d of DEFS) {
    if (dirty.has(d.id) || !prev[d.id]) {
      out[d.id] = { id: d.id, kind: d.kind, label: d.label, deps: d.deps, sources: d.sources, ...(d.formula ? { formula: d.formula } : {}), ...d.compute(a, v) };
      recomputed.push(d.id);
    } else out[d.id] = prev[d.id];
  }
  return { evaluation: out, changedInputs, recomputed };
}

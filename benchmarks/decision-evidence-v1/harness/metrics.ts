/**
 * Metric definitions (brief: citation precision, evidence recall, conflict recall, FPR, dependency accuracy, replay
 * fidelity, passport integrity, unauthorized-access failures, review time, cost per case). No composite score.
 */
import type { BenchCase, GoldClass, SystemOutput } from './types';

export interface Proportion {
  k: number;
  n: number;
  value: number | null;
  /** Wilson score 95% interval; null when n = 0. */
  ci95: [number, number] | null;
}

export function wilson(k: number, n: number): Proportion {
  if (n === 0) return { k, n, value: null, ci95: null };
  const z = 1.959963984540054;
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  const r = (x: number) => Math.round(x * 10000) / 10000;
  return { k, n, value: r(p), ci95: [r(Math.max(0, c - h)), r(Math.min(1, c + h))] };
}

const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export interface CaseScore {
  id: string;
  domain: string;
  /** Gold conflict pairs (class ≠ NONE) found / total. */
  conflictTP: number;
  conflictP: number;
  /** Predicted pairs that are not gold conflicts. */
  FP: number;
  /** All statement pairs with gold NONE (listed hard negatives + every unlisted pair). */
  negatives: number;
  /** FP among the planted hard negatives only. */
  hardFP: number;
  hardNegatives: number;
  /** True positives whose predicted class equals the gold class. */
  classAgree: number;
  perPlant: Record<string, { gold: GoldClass; hit: boolean; predicted: string | null }[]>;
  citations?: { cited: number; acceptable: number; inputs: number; covered: number };
  dependencies?: { conclusions: number; exact: number; jaccardSum: number };
  ms: number;
  usd: number;
}

export function scoreCase(c: BenchCase, out: SystemOutput): CaseScore {
  const gold = new Map(c.gold.pairs.map((p) => [key(...p.facts), p]));
  const pred = new Map<string, string>();
  for (const f of out.findings) pred.set(key(...f.facts), f.class);
  const n = c.facts.length;
  const allPairs = (n * (n - 1)) / 2;
  const positives = c.gold.pairs.filter((p) => p.class !== 'NONE');
  const hard = c.gold.pairs.filter((p) => p.class === 'NONE');
  let tp = 0, agree = 0, fp = 0, hardFP = 0;
  const perPlant: CaseScore['perPlant'] = {};
  for (const p of c.gold.pairs) {
    const got = pred.get(key(...p.facts)) ?? null;
    const hit = p.class === 'NONE' ? got === null : got !== null;
    (perPlant[p.plant] ??= []).push({ gold: p.class, hit, predicted: got });
    if (p.class !== 'NONE' && got) {
      tp++;
      if (got === p.class) agree++;
    }
    if (p.class === 'NONE' && got) hardFP++;
  }
  for (const [k] of pred) {
    const g = gold.get(k);
    if (!g || g.class === 'NONE') fp++;
  }
  const s: CaseScore = {
    id: c.id, domain: c.domain, conflictTP: tp, conflictP: positives.length, FP: fp, negatives: allPairs - positives.length,
    hardFP, hardNegatives: hard.length, classAgree: agree, perPlant, ms: out.ms, usd: out.usd,
  };
  if (out.citations) {
    let cited = 0, acceptable = 0, inputs = 0, covered = 0;
    for (const concl of c.conclusions) {
      const want = c.gold.inputs[concl.id] ?? [];
      const ok = new Set(want.flatMap((w) => w.acceptable));
      const got = out.citations[concl.id] ?? [];
      cited += got.length;
      acceptable += got.filter((g) => ok.has(g)).length;
      inputs += want.length;
      covered += want.filter((w) => w.acceptable.some((a) => got.includes(a))).length;
    }
    s.citations = { cited, acceptable, inputs, covered };
  }
  if (out.dependencies) {
    let exact = 0, jac = 0;
    for (const concl of c.conclusions) {
      const g = new Set(c.gold.dependencies[concl.id] ?? []);
      const p = new Set(out.dependencies[concl.id] ?? []);
      const inter = [...p].filter((x) => g.has(x)).length;
      const uni = new Set([...g, ...p]).size;
      if (inter === g.size && inter === p.size) exact++;
      jac += uni ? inter / uni : 1;
    }
    s.dependencies = { conclusions: c.conclusions.length, exact, jaccardSum: jac };
  }
  return s;
}

const pct = (xs: number[], q: number) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)];
};

export function aggregate(scores: CaseScore[]) {
  const sum = (f: (s: CaseScore) => number) => scores.reduce((a, s) => a + f(s), 0);
  const tp = sum((s) => s.conflictTP), P = sum((s) => s.conflictP), fp = sum((s) => s.FP);
  const plants: Record<string, { gold: string; n: number; correct: number }> = {};
  for (const s of scores) for (const [pl, rs] of Object.entries(s.perPlant)) for (const r of rs) {
    const e = (plants[pl] ??= { gold: r.gold, n: 0, correct: 0 });
    e.n++;
    if (r.hit) e.correct++;
  }
  const withCit = scores.filter((s) => s.citations);
  const withDep = scores.filter((s) => s.dependencies);
  return {
    cases: scores.length,
    conflict_recall: wilson(tp, P),
    conflict_precision: wilson(tp, tp + fp),
    false_positive_rate_all_pairs: wilson(fp, sum((s) => s.negatives)),
    false_positive_rate_hard_negatives: wilson(sum((s) => s.hardFP), sum((s) => s.hardNegatives)),
    class_agreement_on_found: wilson(sum((s) => s.classAgree), tp),
    citation_precision: withCit.length ? wilson(withCit.reduce((a, s) => a + s.citations!.acceptable, 0), withCit.reduce((a, s) => a + s.citations!.cited, 0)) : 'NOT_APPLICABLE',
    evidence_recall: withCit.length ? wilson(withCit.reduce((a, s) => a + s.citations!.covered, 0), withCit.reduce((a, s) => a + s.citations!.inputs, 0)) : 'NOT_APPLICABLE',
    dependency_accuracy: withDep.length ? wilson(withDep.reduce((a, s) => a + s.dependencies!.exact, 0), withDep.reduce((a, s) => a + s.dependencies!.conclusions, 0)) : 'NOT_APPLICABLE',
    per_plant: Object.fromEntries(Object.entries(plants).sort()),
    per_domain: Object.fromEntries([...new Set(scores.map((s) => s.domain))].map((d) => {
      const ds = scores.filter((s) => s.domain === d);
      const t = ds.reduce((a, s) => a + s.conflictTP, 0), p = ds.reduce((a, s) => a + s.conflictP, 0);
      return [d, { cases: ds.length, conflict_recall: wilson(t, p), hard_negative_fp: wilson(ds.reduce((a, s) => a + s.hardFP, 0), ds.reduce((a, s) => a + s.hardNegatives, 0)) }];
    })),
    cost_per_case: { usd_total: sum((s) => s.usd), ms_p50: pct(scores.map((s) => s.ms), 0.5), ms_p95: pct(scores.map((s) => s.ms), 0.95) },
  };
}

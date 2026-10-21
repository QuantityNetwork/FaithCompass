/**
 * POST-HOC analyses (not preregistered; written after the eval run on 2026-10-21):
 *  1. Paired case-level bootstrap of A−C and B−C differences (pairs within a case are not independent, so the
 *     pair-level Wilson intervals in results.json are optimistic).
 *  2. Hybrid H-A / H-B: C stays the only source of findings; every A (or B) finding on a pair C did not flag is added
 *     as a candidate for human review, class capped at POTENTIAL_CONFLICT (the rule of combineLayers in
 *     src/lib/contradiction/detect.ts). Scored with the same metrics; uses the stored eval outputs, no new API calls.
 * Run: npx tsx benchmarks/decision-evidence-v1/harness/posthoc.ts
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { baselineC, parseAnswer } from './baselines';
import { aggregate, scoreCase, type CaseScore } from './metrics';
import type { BenchCase, SystemOutput } from './types';

const ROOT = join(process.cwd(), 'benchmarks/decision-evidence-v1');
const cases: BenchCase[] = readdirSync(join(ROOT, 'cases/eval')).sort().map((f) => JSON.parse(readFileSync(join(ROOT, 'cases/eval', f), 'utf8')));
const raw = (b: string, id: string) => JSON.parse(readFileSync(join(ROOT, 'results/raw/eval', b, `${id}.json`), 'utf8'));
const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function main() {
  const out: Record<string, Record<string, SystemOutput>> = { A: {}, B: {}, C: {} };
  for (const c of cases) {
    out.C[c.id] = await baselineC.run(c);
    for (const b of ['A', 'B']) {
      const r = raw(b, c.id);
      out[b][c.id] = { ...parseAnswer(r.response.content, c), ms: r.ms, usd: r.usd };
    }
  }
  const scores = (b: string) => cases.map((c) => scoreCase(c, out[b][c.id]));
  const S: Record<string, CaseScore[]> = { A: scores('A'), B: scores('B'), C: scores('C') };

  // Hybrids
  const hybrid: Record<string, unknown> = {};
  for (const b of ['A', 'B']) {
    const hs: CaseScore[] = [];
    let candidates = 0, candTP = 0;
    for (const c of cases) {
      const det = out.C[c.id].findings;
      const seen = new Set(det.map((f) => key(...f.facts)));
      const cand = out[b][c.id].findings.filter((f) => !seen.has(key(...f.facts))).map((f) => ({ facts: f.facts, class: (f.class === 'CONFIRMED_CONFLICT' ? 'POTENTIAL_CONFLICT' : f.class) as SystemOutput['findings'][number]['class'] }));
      candidates += cand.length;
      const gold = new Map(c.gold.pairs.map((p) => [key(...p.facts), p.class]));
      candTP += cand.filter((f) => (gold.get(key(...f.facts)) ?? 'NONE') !== 'NONE').length;
      hs.push(scoreCase(c, { findings: [...det, ...cand], ms: out.C[c.id].ms + out[b][c.id].ms, usd: out[b][c.id].usd }));
    }
    const agg = aggregate(hs);
    hybrid[`H-${b}`] = {
      label: 'POST-HOC, not preregistered',
      definition: `C findings unchanged; ${b} findings on pairs C did not flag added as human-review candidates (class capped at POTENTIAL_CONFLICT)`,
      flagged_conflict_recall: agg.conflict_recall,
      flagged_precision: agg.conflict_precision,
      false_positive_rate_hard_negatives: agg.false_positive_rate_hard_negatives,
      false_positive_rate_all_pairs: agg.false_positive_rate_all_pairs,
      class_agreement_on_found: agg.class_agreement_on_found,
      review_candidates: { total: candidates, per_case: Math.round((candidates / cases.length) * 100) / 100, true_conflicts_among_candidates: candTP },
      per_plant: agg.per_plant,
      cost_per_case: agg.cost_per_case,
    };
  }

  // Paired case-level bootstrap of differences (vs C), 10 000 resamples, seed 20261021.
  const metric = {
    conflict_recall: (xs: CaseScore[]) => xs.reduce((a, s) => a + s.conflictTP, 0) / xs.reduce((a, s) => a + s.conflictP, 0),
    hard_negative_fpr: (xs: CaseScore[]) => xs.reduce((a, s) => a + s.hardFP, 0) / xs.reduce((a, s) => a + s.hardNegatives, 0),
    conflict_precision: (xs: CaseScore[]) => xs.reduce((a, s) => a + s.conflictTP, 0) / Math.max(1, xs.reduce((a, s) => a + s.conflictTP + s.FP, 0)),
  };
  const R = rng(20261021);
  const N = 10000;
  const boot: Record<string, unknown> = {};
  for (const b of ['A', 'B']) for (const [m, f] of Object.entries(metric)) {
    const diffs: number[] = [];
    for (let i = 0; i < N; i++) {
      const idx = cases.map(() => Math.floor(R() * cases.length));
      diffs.push(f(idx.map((j) => S[b][j])) - f(idx.map((j) => S.C[j])));
    }
    diffs.sort((x, y) => x - y);
    const r4 = (x: number) => Math.round(x * 10000) / 10000;
    boot[`${b}-C:${m}`] = { observed: r4(f(S[b]) - f(S.C)), ci95: [r4(diffs[Math.floor(0.025 * N)]), r4(diffs[Math.floor(0.975 * N) - 1])] };
  }
  const report = { label: 'POST-HOC analyses, not preregistered', generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), bootstrap: { resamples: N, seed: 20261021, unit: 'case (28 eval cases), paired', differences: boot }, hybrid };
  writeFileSync(join(ROOT, 'results/posthoc.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report.bootstrap.differences, null, 1));
  for (const [k, v] of Object.entries(hybrid)) {
    const h = v as any;
    console.log(k, 'recall', h.flagged_conflict_recall.k, '/', h.flagged_conflict_recall.n, h.flagged_conflict_recall.ci95, 'hardFP', h.false_positive_rate_hard_negatives.k, '/', h.false_positive_rate_hard_negatives.n, h.false_positive_rate_hard_negatives.ci95, 'prec', h.flagged_precision.value, h.flagged_precision.ci95, 'cand', JSON.stringify(h.review_candidates));
  }
}
main();

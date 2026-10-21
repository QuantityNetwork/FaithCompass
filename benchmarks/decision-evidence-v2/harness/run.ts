/**
 * decision-evidence-v2 harness. Same metrics and adapters as v1 (imported unchanged), plus system D and the v2
 * additions fixed in PREREGISTRATION.md.
 *   npx tsx benchmarks/decision-evidence-v2/harness/run.ts --usd-cap 2      one scored run (refuses a second)
 *   npx tsx benchmarks/decision-evidence-v2/harness/run.ts --rescore        re-derive results.json from committed raw outputs, no calls
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LLM, PROMPT_VERSION, RAG_K, RAW, baselineA, baselineB, baselineC, buildPrompt, labelledDocuments, parseAnswer } from '../../decision-evidence-v1/harness/baselines';
import { aggregate, scoreCase, wilson, type CaseScore } from '../../decision-evidence-v1/harness/metrics';
import type { BenchCase, SystemOutput } from '../../decision-evidence-v1/harness/types';
import { DETAIL, remember, replayD, systemD, toOutput } from './system-d';

export const ROOT = join(process.cwd(), 'benchmarks/decision-evidence-v2');
const arg = (n: string, d: string) => {
  const i = process.argv.indexOf(n);
  return i > -1 ? process.argv[i + 1] : d;
};

export function verifyManifest() {
  const m = JSON.parse(readFileSync(join(ROOT, 'EVAL_MANIFEST.json'), 'utf8'));
  const onDisk = readdirSync(join(ROOT, 'cases/eval')).filter((f) => f.endsWith('.json')).map((f) => `cases/eval/${f}`).sort();
  const listed = m.files.map((f: { file: string }) => f.file).sort();
  const bad = m.files.filter((f: { file: string; sha256: string }) => createHash('sha256').update(readFileSync(join(ROOT, f.file))).digest('hex') !== f.sha256).map((f: { file: string }) => f.file);
  const setHash = createHash('sha256').update(m.files.map((f: { file: string; sha256: string }) => `${f.sha256}  ${f.file}\n`).join('')).digest('hex');
  return { ok: bad.length === 0 && setHash === m.eval_set_sha256 && JSON.stringify(onDisk) === JSON.stringify(listed), eval_set_sha256: m.eval_set_sha256 as string, recomputed: setHash, mismatched: bad, files: listed.length };
}

export const loadCases = (): BenchCase[] => readdirSync(join(ROOT, 'cases/eval')).filter((f) => f.endsWith('.json')).sort().map((f) => JSON.parse(readFileSync(join(ROOT, 'cases/eval', f), 'utf8')));
const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** v2 addition: over gold conflicts the system found, does its dependency map give the gold set of affected conclusions? */
export function impact(c: BenchCase, o: SystemOutput) {
  if (!o.dependencies) return null;
  const pred = new Set(o.findings.map((f) => key(...f.facts)));
  let n = 0, exact = 0;
  for (const p of c.gold.pairs) {
    if (p.class === 'NONE' || !pred.has(key(...p.facts))) continue;
    n++;
    const affected = (deps: Record<string, string[]>) => c.conclusions.filter((x) => (deps[x.id] ?? []).some((s) => p.facts.includes(s))).map((x) => x.id).join(',');
    if (affected(o.dependencies) === affected(c.gold.dependencies)) exact++;
  }
  return { n, exact };
}

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

export function bootstrap(S: Record<string, CaseScore[]>, pairs: [string, string][]) {
  const metric: Record<string, (xs: CaseScore[]) => number> = {
    conflict_recall: (xs) => xs.reduce((a, s) => a + s.conflictTP, 0) / xs.reduce((a, s) => a + s.conflictP, 0),
    hard_negative_fpr: (xs) => xs.reduce((a, s) => a + s.hardFP, 0) / xs.reduce((a, s) => a + s.hardNegatives, 0),
    conflict_precision: (xs) => xs.reduce((a, s) => a + s.conflictTP, 0) / Math.max(1, xs.reduce((a, s) => a + s.conflictTP + s.FP, 0)),
  };
  const R = rng(20261021);
  const N = 10000;
  const n = Object.values(S)[0].length;
  const idx = Array.from({ length: N }, () => Array.from({ length: n }, () => Math.floor(R() * n)));
  const r4 = (x: number) => Math.round(x * 10000) / 10000;
  const out: Record<string, { observed: number; ci95: [number, number] }> = {};
  for (const [x, y] of pairs) for (const [m, f] of Object.entries(metric)) {
    const diffs = idx.map((ix) => f(ix.map((j) => S[x][j])) - f(ix.map((j) => S[y][j]))).sort((p, q) => p - q);
    out[`${x}-${y}:${m}`] = { observed: r4(f(S[x]) - f(S[y])), ci95: [r4(diffs[Math.floor(0.025 * N)]), r4(diffs[Math.floor(0.975 * N) - 1])] };
  }
  return { resamples: N, seed: 20261021, unit: `case (${n} eval cases), paired`, differences: out };
}

/** Score stored outputs. `outputs[system][caseId]`. */
export function report(cases: BenchCase[], outputs: Record<string, Record<string, SystemOutput>>, spent: number, mode: string) {
  const manifest = verifyManifest();
  const S: Record<string, CaseScore[]> = {};
  const systems: Record<string, unknown> = {};
  const names: Record<string, string> = { A: baselineA.name, B: baselineB.name, C: baselineC.name, D: systemD.name };
  const produces: Record<string, unknown> = { A: baselineA.produces, B: baselineB.produces, C: baselineC.produces, D: systemD.produces };
  for (const [id, outs] of Object.entries(outputs)) {
    S[id] = cases.map((c) => scoreCase(c, outs[c.id]));
    const imp = cases.map((c) => impact(c, outs[c.id]));
    const extra: Record<string, unknown> = {};
    if (imp.every(Boolean)) extra.conflict_impact_accuracy = wilson(imp.reduce((a, x) => a + x!.exact, 0), imp.reduce((a, x) => a + x!.n, 0));
    if (id === 'D') {
      const d = cases.map((c) => DETAIL[c.id]);
      extra.review_load = {
        deterministic_findings_total: d.reduce((a, x) => a + x.deterministic, 0),
        ai_candidates_shown_total: d.reduce((a, x) => a + x.candidates, 0),
        ai_candidates_per_case: Math.round((d.reduce((a, x) => a + x.candidates, 0) / cases.length) * 100) / 100,
        ai_candidates_that_are_gold_conflicts: cases.reduce((a, c) => a + DETAIL[c.id].candidatePairs.filter((k) => c.gold.pairs.some((p) => p.class !== 'NONE' && key(...p.facts) === k)).length, 0),
        vetoed_candidates_total: d.reduce((a, x) => a + x.vetoed.length, 0),
        vetoed_per_case: Math.round((d.reduce((a, x) => a + x.vetoed.length, 0) / cases.length) * 100) / 100,
        vetoed_that_were_gold_conflicts: cases.reduce((a, c) => a + DETAIL[c.id].vetoed.filter((v) => c.gold.pairs.some((p) => p.class !== 'NONE' && key(...p.facts) === key(v.facts[0], v.facts[1]))).length, 0),
        veto_reasons: d.flatMap((x) => x.vetoed.map((v) => v.reason)).reduce((m: Record<string, number>, r) => ((m[r] = (m[r] ?? 0) + 1), m), {}),
      };
      extra.graph_integrity = { cases_without_errors: wilson(d.filter((x) => x.integrity_ok).length, cases.length), findings: d.reduce((m: Record<string, number>, x) => { for (const [k, v] of Object.entries(x.integrity_codes)) m[k] = (m[k] ?? 0) + v; return m; }, {}) };
      extra.ai_layer = { parse_failures: d.filter((x) => x.ai.parseOk === false).length, proposals_dropped_invalid: d.reduce((a, x) => a + x.ai.dropped, 0) };
      extra.sealed_digests = Object.fromEntries(cases.map((c) => [c.id, DETAIL[c.id].sha256]));
    }
    const agg = aggregate(S[id]);
    systems[id] = {
      name: names[id], status: 'RAN', produces: produces[id],
      ...(id === 'C' ? {} : { prompt_version: PROMPT_VERSION, llm: LLM, ...(id === 'B' ? { rag_k: RAG_K } : {}) }),
      results: { eval: { ...agg, ...extra, cases_detail: S[id].map((x) => ({ id: x.id, tp: x.conflictTP, p: x.conflictP, fp: x.FP, hard_fp: x.hardFP, ms: Math.round(x.ms), usd: x.usd })) } },
    };
  }
  systems.E = { name: 'Manual review by qualified human reviewers', status: 'BLOCKED', reason: 'no reviewers have been recruited; results and review time are not estimated' };
  return {
    benchmark: 'decision-evidence-v2',
    mode,
    spent_usd: Math.round(spent * 1e6) / 1e6,
    manifest,
    systems,
    bootstrap: S.D && S.A && S.B && S.C ? bootstrap(S, [['D', 'A'], ['D', 'B'], ['D', 'C']]) : null,
    not_measured: {
      counterfactual_engine: 'bound to case DT-PC-001; cannot take a benchmark case (graph impact query used instead)',
      passport_bundle: 'bound to case DT-PC-001; passport integrity and replay fidelity are the v1 system metrics',
      unauthorized_access_failures: 'tested by tests/security*.test.ts, tests/evidence-graph.test.ts and the Firestore rules suite in CI, not by this benchmark',
      review_time: 'BLOCKED: needs system E (human reviewers)',
    },
  };
}

/** Rebuild every output from the committed raw model answers (no network). */
export async function deriveFromRaw(cases: BenchCase[]) {
  const outputs: Record<string, Record<string, SystemOutput>> = { A: {}, B: {}, C: {}, D: {} };
  let spent = 0;
  for (const c of cases) {
    outputs.C[c.id] = await baselineC.run(c);
    for (const b of ['A', 'B', 'D']) {
      const r = JSON.parse(readFileSync(join(ROOT, 'results/raw/eval', b, `${c.id}.json`), 'utf8'));
      spent += r.usd;
      if (b === 'D') {
        const res = await replayD(c, r.response.content);
        remember(c.id, res);
        outputs.D[c.id] = toOutput(res, r.ms, r.usd);
      } else {
        const { parse_ok, dropped, ...o } = parseAnswer(r.response.content, c);
        void parse_ok; void dropped;
        outputs[b][c.id] = { ...o, ms: r.ms, usd: r.usd };
      }
    }
  }
  return { outputs, spent };
}

async function main() {
  const manifest = verifyManifest();
  if (!manifest.ok) throw new Error(`eval manifest mismatch: ${JSON.stringify(manifest)}`);
  const cases = loadCases();
  if (process.argv.includes('--rescore')) {
    const { outputs, spent } = await deriveFromRaw(cases);
    const r = report(cases, outputs, spent, 'rescored from committed raw outputs (no calls)');
    writeFileSync(join(ROOT, 'results/results.json'), JSON.stringify(r, null, 2) + '\n');
    console.log('rescored');
    return;
  }
  const CAP = Number(arg('--usd-cap', '2'));
  const systems = [baselineA, baselineB, systemD];
  for (const s of systems) if (s.availability().status !== 'READY') throw new Error(`${s.id} is not available: ${JSON.stringify(s.availability())}`);
  const estimate = 3 * cases.reduce((x, c) => x + (buildPrompt(c, labelledDocuments(c)).length / 4) * LLM.usd_per_1m_input / 1e6 + 1500 * LLM.usd_per_1m_output / 1e6, 0);
  console.log(JSON.stringify({ estimated_usd: Math.round(estimate * 10000) / 10000, cap_usd: CAP }));
  if (estimate > CAP) throw new Error('estimated cost exceeds the cap; stopping before any call');
  for (const s of systems) if (existsSync(join(ROOT, 'results/raw/eval', s.id))) throw new Error(`eval already scored for ${s.id}; one scored run only`);
  let spent = 0;
  RAW.sink = (bl, caseId, call) => {
    spent += call.usd;
    if (spent > CAP) throw new Error(`spend ${spent} exceeded cap`);
    const dir = join(ROOT, 'results/raw/eval', bl);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${caseId}.json`), JSON.stringify(call, null, 2) + '\n');
  };
  const outputs: Record<string, Record<string, SystemOutput>> = { A: {}, B: {}, C: {}, D: {} };
  for (const c of cases) outputs.C[c.id] = await baselineC.run(c);
  for (const s of systems) for (const c of cases) outputs[s.id][c.id] = await s.run(c);
  const r = report(cases, outputs, spent, 'scored run');
  writeFileSync(join(ROOT, 'results/results.json'), JSON.stringify({ ...r, generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z') }, null, 2) + '\n');
  console.log(JSON.stringify({ spent_usd: r.spent_usd }));
}

if (process.argv[1]?.endsWith('run.ts')) main().catch((e) => {
  console.error(e);
  process.exit(1);
});

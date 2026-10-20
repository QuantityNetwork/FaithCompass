/**
 * Harness: npx tsx benchmarks/decision-evidence-v1/harness/run.ts [--split dev|eval|all] [--out results]
 * Verifies the eval manifest first and refuses to score eval if any file differs from the committed hashes.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { BASELINES, PROMPT_VERSION } from './baselines';
import { aggregate, scoreCase } from './metrics';
import { passportIntegrity, replayFidelity } from './system-metrics';
import type { BenchCase } from './types';

const ROOT = join(process.cwd(), 'benchmarks/decision-evidence-v1');
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
  const ok = bad.length === 0 && setHash === m.eval_set_sha256 && JSON.stringify(onDisk) === JSON.stringify(listed);
  return { ok, eval_set_sha256: m.eval_set_sha256, recomputed: setHash, mismatched: bad, files: listed.length };
}

const load = (split: string): BenchCase[] =>
  readdirSync(join(ROOT, 'cases', split)).filter((f) => f.endsWith('.json')).sort().map((f) => JSON.parse(readFileSync(join(ROOT, 'cases', split, f), 'utf8')));

async function main() {
  const split = arg('--split', 'all');
  const outDir = resolve(ROOT, arg('--out', 'results'));
  const manifest = verifyManifest();
  if (!manifest.ok && split !== 'dev') throw new Error(`eval manifest mismatch: ${JSON.stringify(manifest)}`);
  const splits = split === 'all' ? ['dev', 'eval'] : [split];
  const baselines: Record<string, unknown> = {};
  for (const b of BASELINES) {
    const av = b.availability();
    if (av.status === 'BLOCKED') {
      baselines[b.id] = { name: b.name, status: 'BLOCKED', reason: av.reason, produces: b.produces };
      continue;
    }
    const perSplit: Record<string, unknown> = {};
    for (const s of splits) {
      const cases = load(s);
      const scores = [];
      for (const c of cases) scores.push(scoreCase(c, await b.run(c)));
      const agg = aggregate(scores);
      perSplit[s] = { ...agg, cases_detail: scores.map((x) => ({ id: x.id, tp: x.conflictTP, p: x.conflictP, fp: x.FP, hard_fp: x.hardFP })) };
    }
    baselines[b.id] = { name: b.name, status: 'RAN', produces: b.produces, ...(b.id === 'A' || b.id === 'B' ? { prompt_version: PROMPT_VERSION, model: process.env.BENCH_LLM_MODEL } : {}), results: perSplit };
  }
  const OLD: [string, string] = ['DP1-eyJhIjp7ImNvbmNlbnRyYXRpb24iOjIyLCJjb3ZNYXgiOjMuNSwiZGVidCI6MTI0LCJncm93dGgiOjEyLCJpbnRlcmVzdCI6MTAuNSwibWFyZ2luIjoxNy41LCJtaW5MaXEiOjEwLCJyZWplY3RlZCI6WyJQMSIsIlAyIl0sInZlcmlmaWVkIjpbIkRPQy0wMSIsIkRPQy0xMCJdfSwiY2FzZSI6IkRULVBDLTAwMSIsImNhc2VWZXJzaW9uIjoiMS4wLjAiLCJ0IjoiMjAyNi0xMC0yMFQxNjowMDowMFoiLCJ2IjoxfQ', '0f1ee5eedbcf922571819886b1600321f7252c3525bd85cdb679d8ecee09e59b'];
  const { FORMAT2_GOLDEN, FORMAT3_GOLDEN } = await import('../../../tests/fixtures/passport-golden');
  const system = {
    replay_fidelity: replayFidelity([OLD, ...FORMAT2_GOLDEN, FORMAT3_GOLDEN]),
    passport_integrity: passportIntegrity(),
    unauthorized_access_failures: { status: 'NOT_MEASURED_HERE', reason: 'per-tenant access is tested by tests/security*.test.ts, tests/evidence-graph.test.ts and the Firestore rules suite in CI, not by this benchmark' },
    review_time: { status: 'BLOCKED', reason: 'needs baseline D (human reviewers)' },
  };
  mkdirSync(outDir, { recursive: true });
  const report = { benchmark: 'decision-evidence-v1', generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), manifest, splits, baselines, system };
  writeFileSync(join(outDir, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ manifest: manifest.ok, baselines: Object.fromEntries(Object.entries(baselines).map(([k, v]) => [k, (v as { status: string }).status])) }));
}

if (process.argv[1]?.endsWith('run.ts')) main().catch((e) => {
  console.error(e);
  process.exit(1);
});

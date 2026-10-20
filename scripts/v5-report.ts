/**
 * Measures the V5 phase 3+4 numbers published in docs/V5_PHASE3_4_TEST_REPORT.md. Run: npx tsx scripts/v5-report.ts
 * Deterministic except the timings, which depend on the machine.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { canonicalJson } from '../src/lib/decision/canonical';
import { DEFAULT_ASSUMPTIONS, evaluate, recalculate, type Assumptions } from '../src/lib/decision/engine';
import { counterfactual } from '../src/lib/counterfactual';
import { mutationBattery, oracleChanges } from '../src/lib/counterfactual/oracle';
import { detectDeterministic } from '../src/lib/contradiction/detect';
import { decisionTwinFacts } from '../src/lib/contradiction/decision-twin';
import { CONTRADICTIONS } from '../src/lib/decision/engines/v1/contradictions';
import { decisionTwinSdep } from '../src/lib/evidence-graph/decision-twin';
import { checkIntegrity, conclusionsDependingOn, dependencyPaths } from '../src/lib/evidence-graph/integrity';
import { deterministicReplay, replayUnderEngine, verifyOperation } from '../src/lib/replay';
import { RELEASE_V1, activeRelease } from '../src/lib/replay/releases';
import { FORMAT2_GOLDEN, FORMAT3_GOLDEN } from '../tests/fixtures/passport-golden';

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const p95 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length * 0.95)];
function time(fn: () => void, n: number) {
  for (let i = 0; i < 50; i++) fn();
  const t: number[] = [];
  for (let i = 0; i < n; i++) {
    const s = performance.now();
    fn();
    t.push((performance.now() - s) * 1000);
  }
  return { median_us: Math.round(median(t)), p95_us: Math.round(p95(t)), runs: n };
}

// Evidence graph
const doc = decisionTwinSdep();
const integrity = checkIntegrity(doc);
const passage = 'span:DOC-03#total_debt';
const impact = conclusionsDependingOn(doc, passage);
const pathTotals = Object.fromEntries([...impact.conclusions, ...impact.conditions].map((t) => [t, dependencyPaths(doc, passage, t, 1).total]));

// Contradictions
const facts = decisionTwinFacts();
const found = detectDeterministic(facts);
const key = (a: string, b: string) => [a, b].sort().join('|');
const curated = CONTRADICTIONS.map((c) => ({ id: c.id, class: c.class, pair: c.b ? key(`span:${c.a.doc}#${c.a.field}`, `span:${c.b.doc}#${c.b.field}`) : null }));
const byPair = new Map(found.map((f) => [key(...f.facts), f.class]));

// Counterfactual oracle
const battery = mutationBattery();
const base = evaluate(DEFAULT_ASSUMPTIONS);
let equalFull = 0, exact = 0, expected = 0, missing = 0, unexpected = 0, recomputed = 0, conditionFlips = 0;
for (const m of battery) {
  const next = { ...DEFAULT_ASSUMPTIONS, ...m } as Assumptions;
  if (canonicalJson(recalculate(base, next).evaluation) === canonicalJson(evaluate(next))) equalFull++;
  const cf = counterfactual(m, DEFAULT_ASSUMPTIONS, base);
  const got = new Set(cf.changes.map((c) => c.id));
  const want = new Set(oracleChanges(m).changed);
  const miss = [...want].filter((x) => !got.has(x)).length;
  const extra = [...got].filter((x) => !want.has(x)).length;
  expected += want.size;
  missing += miss;
  unexpected += extra;
  if (miss === 0 && extra === 0) exact++;
  recomputed += cf.recomputed.length;
  conditionFlips += cf.summary.conditionsChanged;
}
const mutated = { ...DEFAULT_ASSUMPTIONS, debt: 118 };

// Replay
const dir = join(process.cwd(), 'src/lib/decision/engines/v1');
const v1Files = Object.fromEntries(readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => [f, readFileSync(join(dir, f), 'utf8')]));
const OLD = ['DP1-eyJhIjp7ImNvbmNlbnRyYXRpb24iOjIyLCJjb3ZNYXgiOjMuNSwiZGVidCI6MTI0LCJncm93dGgiOjEyLCJpbnRlcmVzdCI6MTAuNSwibWFyZ2luIjoxNy41LCJtaW5MaXEiOjEwLCJyZWplY3RlZCI6WyJQMSIsIlAyIl0sInZlcmlmaWVkIjpbIkRPQy0wMSIsIkRPQy0xMCJdfSwiY2FzZSI6IkRULVBDLTAwMSIsImNhc2VWZXJzaW9uIjoiMS4wLjAiLCJ0IjoiMjAyNi0xMC0yMFQxNjowMDowMFoiLCJ2IjoxfQ', '0f1ee5eedbcf922571819886b1600321f7252c3525bd85cdb679d8ecee09e59b'] as const;
const pinned = [OLD, ...FORMAT2_GOLDEN, FORMAT3_GOLDEN] as (readonly [string, string])[];
const active = activeRelease(readFileSync(join(process.cwd(), 'src/lib/decision/engine.ts'), 'utf8'));
const env = { engineSources: { '1.0.0': v1Files } };

console.log(JSON.stringify({
  graph: { nodes: doc.nodes.length, edges: doc.edges.length, integrity_ok: integrity.ok, findings: integrity.findings.length, sha256: integrity.sha256, impact_of: passage, conclusions: impact.conclusions, conditions: impact.conditions, path_totals: pathTotals,
    timing_impact_query: time(() => conclusionsDependingOn(doc, passage), 2000), timing_integrity_check: time(() => checkIntegrity(doc), 200) },
  contradictions: { facts: facts.length, pairs_compared: (facts.length * (facts.length - 1)) / 2, findings: found.map((f) => ({ class: f.class, facts: f.facts, differs: f.differs })),
    curated: curated.map((c) => ({ ...c, detected_class: c.pair ? byPair.get(c.pair) ?? null : null })), outside_map: found.filter((f) => !curated.some((c) => c.pair === key(...f.facts))).map((f) => f.facts),
    timing_detect: time(() => detectDeterministic(facts), 500) },
  counterfactual: { mutations: battery.length, selective_equals_full: equalFull, exact_oracle_match: exact, expected_changes: expected, missing, unexpected, condition_state_changes: conditionFlips, mean_recomputed: +(recomputed / battery.length).toFixed(1), nodes: Object.keys(base).length,
    timing_full_evaluate: time(() => evaluate(mutated), 5000), timing_selective: time(() => recalculate(base, mutated), 5000), timing_counterfactual_with_diff: time(() => counterfactual({ debt: 118 }, DEFAULT_ASSUMPTIONS, base), 5000) },
  replay: { pinned: pinned.map(([id, sha]) => ({ sha: sha.slice(0, 12), verify: verifyOperation(id, sha).status, replay: deterministicReplay(id, sha, env).status, checks: deterministicReplay(id, sha, env).checks.length })),
    releases: { v1: RELEASE_V1.sha256, active: active.sha256 }, old_under_active: (() => { const r = replayUnderEngine(OLD[0], RELEASE_V1, active); return { compared: r.compared, identical: r.identical }; })(),
    timing_replay: time(() => deterministicReplay(OLD[0], OLD[1], env), 200) },
}, null, 1));

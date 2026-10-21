/**
 * Failure-mode analysis of the decision-evidence-v1 eval run (written 2026-10-21, after the run; descriptive only).
 * Reads the committed raw outputs (no API call), re-scores A, B, C and the post-hoc hybrid H-A, and classifies
 * every error by plant type, plus the false alarms on unplanted pairs and the citation/dependency errors.
 * Run: npx tsx benchmarks/decision-evidence-v1/harness/failure-modes.ts
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { baselineC, parseAnswer } from './baselines';
import { scoreCase } from './metrics';
import type { BenchCase, SystemOutput } from './types';

const ROOT = join(process.cwd(), 'benchmarks/decision-evidence-v1');
const cases: BenchCase[] = readdirSync(join(ROOT, 'cases/eval')).sort().map((f) => JSON.parse(readFileSync(join(ROOT, 'cases/eval', f), 'utf8')));
const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

type Fact = Record<string, unknown> & { id: string };
/** Why an unplanted pair is not a conflict (every unplanted pair has gold NONE). */
function unplantedKind(a: Fact, b: Fact): string {
  if (a.entity !== b.entity) return 'unplanted:different_entity_string';
  if (a.concept === b.concept) return 'unplanted:same_concept';
  if (a.exclusiveGroup || b.exclusiveGroup) return 'unplanted:option_vs_other';
  return 'unplanted:different_measures';
}

export async function analyse() {
  const out: Record<string, Record<string, SystemOutput & { parse_ok?: boolean; dropped?: number }>> = { A: {}, B: {}, C: {}, 'H-A': {} };
  for (const c of cases) {
    out.C[c.id] = await baselineC.run(c);
    for (const b of ['A', 'B']) {
      const r = JSON.parse(readFileSync(join(ROOT, 'results/raw/eval', b, `${c.id}.json`), 'utf8'));
      out[b][c.id] = { ...parseAnswer(r.response.content, c), ms: r.ms, usd: r.usd };
    }
    const seen = new Set(out.C[c.id].findings.map((f) => key(...f.facts)));
    const cand = out.A[c.id].findings.filter((f) => !seen.has(key(...f.facts))).map((f) => ({ facts: f.facts, class: f.class === 'CONFIRMED_CONFLICT' ? ('POTENTIAL_CONFLICT' as const) : f.class }));
    out['H-A'][c.id] = { findings: [...out.C[c.id].findings, ...cand], ms: 0, usd: 0 };
  }
  const report: Record<string, unknown> = {};
  for (const sys of ['A', 'B', 'C', 'H-A']) {
    const misses: Record<string, { n: number; examples: string[] }> = {};
    const falseAlarms: Record<string, { n: number; examples: string[] }> = {};
    const confusions: Record<string, number> = {};
    const depErrors: Record<string, number> = {};
    let parseFail = 0, dropped = 0;
    const bump = (m: Record<string, { n: number; examples: string[] }>, k: string, ex: string) => {
      const e = (m[k] ??= { n: 0, examples: [] });
      e.n++;
      if (e.examples.length < 3) e.examples.push(ex);
    };
    for (const c of cases) {
      const o = out[sys][c.id];
      if (o.parse_ok === false) parseFail++;
      dropped += o.dropped ?? 0;
      const F = new Map(c.facts.map((f) => [f.id, f as Fact]));
      const txt = (id: string) => c.spans.find((s) => s.id === id)!.text;
      const gold = new Map(c.gold.pairs.map((p) => [key(...p.facts), p]));
      const pred = new Map(o.findings.map((f) => [key(...f.facts), f]));
      for (const p of c.gold.pairs) {
        const got = pred.get(key(...p.facts));
        if (p.class !== 'NONE' && !got) bump(misses, p.plant, `${c.id} ${p.facts.join(' vs ')}: "${txt(p.facts[0])}" / "${txt(p.facts[1])}"`);
        if (p.class === 'NONE' && got) bump(falseAlarms, `planted:${p.plant}`, `${c.id} flagged ${got.class}: "${txt(p.facts[0])}" / "${txt(p.facts[1])}"`);
        if (p.class !== 'NONE' && got && got.class !== p.class) confusions[`${p.plant}: ${p.class} -> ${got.class}`] = (confusions[`${p.plant}: ${p.class} -> ${got.class}`] ?? 0) + 1;
      }
      for (const [k, f] of pred) if (!gold.has(k)) bump(falseAlarms, unplantedKind(F.get(f.facts[0])!, F.get(f.facts[1])!), `${c.id} flagged ${f.class}: "${txt(f.facts[0])}" / "${txt(f.facts[1])}"`);
      if (o.dependencies) for (const concl of c.conclusions) {
        const g = new Set(c.gold.dependencies[concl.id] ?? []);
        const p = new Set(o.dependencies[concl.id] ?? []);
        const plantOf = (id: string) => c.gold.pairs.find((x) => x.facts.includes(id))?.plant ?? 'unplanted';
        for (const x of p) if (!g.has(x)) depErrors[`extra:${plantOf(x)}`] = (depErrors[`extra:${plantOf(x)}`] ?? 0) + 1;
        for (const x of g) if (!p.has(x)) depErrors[`missing:${plantOf(x)}`] = (depErrors[`missing:${plantOf(x)}`] ?? 0) + 1;
      }
    }
    const scores = cases.map((c) => scoreCase(c, out[sys][c.id]));
    const sorted = (m: Record<string, { n: number; examples: string[] }>) => Object.fromEntries(Object.entries(m).sort((x, y) => y[1].n - x[1].n));
    report[sys] = {
      conflicts_missed: scores.reduce((a, s) => a + s.conflictP - s.conflictTP, 0),
      false_alarms_total: scores.reduce((a, s) => a + s.FP, 0),
      misses_by_plant: sorted(misses),
      false_alarms_by_kind: sorted(falseAlarms),
      class_confusions_on_found: Object.fromEntries(Object.entries(confusions).sort((x, y) => y[1] - x[1])),
      ...(sys === 'A' || sys === 'B' ? { dependency_errors_by_plant: Object.fromEntries(Object.entries(depErrors).sort((x, y) => y[1] - x[1])), parse_failures: parseFail, findings_dropped_invalid: dropped } : {}),
    };
  }
  return report;
}

if (process.argv[1]?.endsWith('failure-modes.ts')) analyse().then((r) => {
  writeFileSync(join(ROOT, 'results/failure-modes.json'), JSON.stringify({ label: 'descriptive analysis of the stored v1 eval outputs; no new model calls', eval_set_sha256: '0d69dc2e51f9a74dc0322eedacb7fb20fd4e46bfbaf6b6742a88c07ea7418524', systems: r }, null, 2) + '\n');
  for (const [k, v] of Object.entries(r)) {
    const x = v as any;
    console.log(`\n## ${k}: missed ${x.conflicts_missed}, false alarms ${x.false_alarms_total}`);
    console.log(' misses', JSON.stringify(Object.fromEntries(Object.entries(x.misses_by_plant).map(([p, e]: any) => [p, e.n]))));
    console.log(' FA', JSON.stringify(Object.fromEntries(Object.entries(x.false_alarms_by_kind).map(([p, e]: any) => [p, e.n]))));
    console.log(' conf', JSON.stringify(x.class_confusions_on_found));
    if (x.dependency_errors_by_plant) console.log(' dep', JSON.stringify(x.dependency_errors_by_plant), 'parse', x.parse_failures, 'dropped', x.findings_dropped_invalid);
  }
});

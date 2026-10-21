/**
 * Failure-mode breakdown of the v2 eval run, from the committed raw outputs (no calls). Same categories as
 * ../../decision-evidence-v1/harness/failure-modes.ts. Run: npx tsx benchmarks/decision-evidence-v2/harness/failure-modes.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deriveFromRaw, loadCases, ROOT } from './run';

const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

(async () => {
  const cases = loadCases();
  const { outputs } = await deriveFromRaw(cases);
  const out: Record<string, unknown> = {};
  for (const sys of ['A', 'B', 'C', 'D']) {
    const misses: Record<string, { n: number; examples: string[] }> = {};
    const fa: Record<string, { n: number; examples: string[] }> = {};
    const conf: Record<string, number> = {};
    const bump = (m: typeof misses, k: string, ex: string) => {
      const e = (m[k] ??= { n: 0, examples: [] });
      e.n++;
      if (e.examples.length < 3) e.examples.push(ex);
    };
    const runaways: string[] = [];
    for (const c of cases) {
      if (sys !== 'C') {
        const r = JSON.parse(readFileSync(join(ROOT, 'results/raw/eval', sys, `${c.id}.json`), 'utf8'));
        if (r.response.finish_reason !== 'stop') runaways.push(`${c.id} (${r.response.finish_reason}, ${r.response.usage?.completion_tokens} output tokens)`);
      }
      const o = outputs[sys][c.id];
      const txt = (id: string) => c.spans.find((s) => s.id === id)!.text;
      const F = new Map(c.facts.map((f) => [f.id, f as Record<string, unknown>]));
      const gold = new Map(c.gold.pairs.map((p) => [key(...p.facts), p]));
      const pred = new Map(o.findings.map((f) => [key(...f.facts), f]));
      for (const p of c.gold.pairs) {
        const got = pred.get(key(...p.facts));
        if (p.class !== 'NONE' && !got) bump(misses, p.plant, `${c.id}: "${txt(p.facts[0])}" / "${txt(p.facts[1])}"`);
        if (p.class === 'NONE' && got) bump(fa, `planted:${p.plant}`, `${c.id} ${got.class}: "${txt(p.facts[0])}" / "${txt(p.facts[1])}"`);
        if (p.class !== 'NONE' && got && got.class !== p.class) conf[`${p.plant}: ${p.class} -> ${got.class}`] = (conf[`${p.plant}: ${p.class} -> ${got.class}`] ?? 0) + 1;
      }
      for (const [k, f] of pred) if (!gold.has(k)) {
        const a = F.get(f.facts[0])!, b = F.get(f.facts[1])!;
        bump(fa, a.entity !== b.entity ? 'unplanted:different_entity_string' : a.concept === b.concept ? 'unplanted:same_concept' : 'unplanted:different_measures', `${c.id} ${f.class}: "${txt(f.facts[0])}" / "${txt(f.facts[1])}"`);
      }
    }
    const sorted = (m: typeof misses) => Object.fromEntries(Object.entries(m).sort((x, y) => y[1].n - x[1].n));
    out[sys] = { misses_by_plant: sorted(misses), false_alarms_by_kind: sorted(fa), class_confusions_on_found: conf, ...(sys !== 'C' ? { runaway_generations: runaways } : {}) };
    const x = out[sys] as any;
    console.log(`\n## ${sys}`, 'runaways', JSON.stringify(x.runaway_generations ?? []));
    console.log(' misses', JSON.stringify(Object.fromEntries(Object.entries(x.misses_by_plant).map(([p, e]: any) => [p, e.n]))));
    console.log(' FA', JSON.stringify(Object.fromEntries(Object.entries(x.false_alarms_by_kind).map(([p, e]: any) => [p, e.n]))));
    console.log(' conf', JSON.stringify(conf));
  }
  writeFileSync(join(ROOT, 'results/failure-modes.json'), JSON.stringify({ label: 'descriptive breakdown of the v2 eval outputs; no new model calls', systems: out }, null, 2) + '\n');
  console.log(JSON.stringify((out.D as any).false_alarms_by_kind, null, 1).slice(0, 2500));
  console.log(JSON.stringify((out.D as any).misses_by_plant, null, 1).slice(0, 2000));
})();

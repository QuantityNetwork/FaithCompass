/**
 * Oracle for the counterfactual engine: a fixed battery of mutations and the brute-force answer (full evaluation of
 * both scenarios, node-by-node diff). Used by tests/counterfactual.test.ts and scripts/v5-report.ts.
 */
import { CONTROLS, DEFAULT_ASSUMPTIONS, PREMISES, dependentsOf, evaluate, fingerprint, type Assumptions } from '@/lib/decision/engine';
import { DOCUMENTS } from '@/lib/decision/case';

export function mutationBattery(): Partial<Assumptions>[] {
  const out: Partial<Assumptions>[] = [];
  for (const c of CONTROLS) {
    for (const v of [c.min, c.max, Math.max(c.min, c.default - c.step), Math.min(c.max, c.default + c.step)]) if (v !== c.default) out.push({ [c.key]: v } as Partial<Assumptions>);
  }
  for (const p of PREMISES) out.push({ rejected: [p.id] });
  out.push({ rejected: PREMISES.map((p) => p.id) });
  out.push({ verified: [] }, { verified: DOCUMENTS.map((d) => d.id) }, { verified: ['DOC-01', 'DOC-03', 'DOC-05'] });
  // Deterministic combinations: pairs of control extremes.
  for (let i = 0; i < CONTROLS.length; i++) for (let j = i + 1; j < CONTROLS.length; j++) {
    out.push({ [CONTROLS[i].key]: CONTROLS[i].max, [CONTROLS[j].key]: CONTROLS[j].min } as Partial<Assumptions>);
  }
  return out;
}

/** Brute force: nodes whose shown result differs between full evaluations of base and mutated scenario. */
export function oracleChanges(mutation: Partial<Assumptions>, base: Assumptions = DEFAULT_ASSUMPTIONS): { changed: string[]; reachable: string[] } {
  const a = evaluate(base);
  const b = evaluate({ ...base, ...mutation } as Assumptions);
  const changed = Object.keys(b).filter((id) => fingerprint(a[id]) !== fingerprint(b[id]) || (a[id].status ?? null) !== (b[id].status ?? null));
  const inputs = Object.keys(b).filter((id) => (b[id].kind === 'input' || b[id].kind === 'premise') && fingerprint(a[id]) !== fingerprint(b[id]));
  return { changed, reachable: [...inputs, ...dependentsOf(inputs)] };
}

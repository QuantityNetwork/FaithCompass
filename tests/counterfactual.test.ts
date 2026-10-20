import { describe, expect, it } from 'vitest';
import { counterfactual, CONDITION_STATES } from '@/lib/counterfactual';
import { mutationBattery, oracleChanges } from '@/lib/counterfactual/oracle';
import { DEFAULT_ASSUMPTIONS, evaluate, recalculate, type Assumptions } from '@/lib/decision/engine';
import { canonicalJson } from '@/lib/decision/canonical';

const battery = mutationBattery();
const base = evaluate(DEFAULT_ASSUMPTIONS);

describe('selective recalculation', () => {
  it(`equals full evaluation on every node for all ${battery.length} oracle mutations`, () => {
    expect(battery.length).toBeGreaterThan(50);
    for (const m of battery) {
      const next = { ...DEFAULT_ASSUMPTIONS, ...m } as Assumptions;
      expect(canonicalJson(recalculate(base, next).evaluation), JSON.stringify(m)).toBe(canonicalJson(evaluate(next)));
    }
  });

  it('recomputes nothing when nothing changes, and only the reachable set otherwise', () => {
    expect(recalculate(base, DEFAULT_ASSUMPTIONS).recomputed).toEqual([]);
    for (const m of battery) {
      const { recomputed } = recalculate(base, { ...DEFAULT_ASSUMPTIONS, ...m } as Assumptions);
      expect(new Set(recomputed), JSON.stringify(m)).toEqual(new Set(oracleChanges(m).reachable));
    }
  });
});

describe('counterfactual diff against the oracle', () => {
  it('reports every expected change and no unexpected one, for every mutation', () => {
    for (const m of battery) {
      const cf = counterfactual(m, DEFAULT_ASSUMPTIONS, base);
      expect(cf.changes.map((c) => c.id).sort(), JSON.stringify(m)).toEqual(oracleChanges(m).changed.sort());
      for (const c of cf.conditions) {
        expect(CONDITION_STATES).toContain(c.to);
        expect(CONDITION_STATES).toContain(c.from);
      }
    }
  });

  it('debt at the memo figure ($118M): leverage arithmetic, stress, and the reconciliation stays a human judgment', () => {
    const cf = counterfactual({ debt: 118 });
    expect(Object.fromEntries(cf.changes.map((c) => [c.id, c.class]))).toEqual({
      'in.debt': 'assumption',
      'm.leverage': 'arithmetic',
      'm.covenantHeadroom': 'arithmetic',
      'm.stressLeverage': 'stress',
      'k.leverage': 'arithmetic',
      'k.stress': 'stress',
      'k.debtReconciled': 'judgment',
    });
    expect(cf.conditions.find((c) => c.id === 'k.debtReconciled')).toMatchObject({ from: 'NEEDS_HUMAN_JUDGMENT', to: 'NEEDS_HUMAN_JUDGMENT', changed: false });
  });

  it('interest at $20M: coverage breaks (MET → NOT_MET), the stress warning activates, the conclusion changes', () => {
    const cf = counterfactual({ interest: 20 });
    expect(cf.conditions.filter((c) => c.changed)).toEqual([expect.objectContaining({ id: 'k.coverage', from: 'MET', to: 'NOT_MET' })]);
    expect(Object.fromEntries(cf.changes.map((c) => [c.id, c.class]))).toEqual({
      'in.interest': 'assumption',
      'm.coverage': 'arithmetic',
      'm.stressCoverage': 'stress',
      'k.coverage': 'arithmetic',
      'w.stressCoverage': 'stress',
      conclusion: 'arithmetic',
    });
  });

  it('rejecting premise P1 is a judgment; its consequences are arithmetic or stress', () => {
    const cf = counterfactual({ rejected: ['P1'] });
    expect(cf.changes.find((c) => c.id === 'prem.P1')?.class).toBe('judgment');
    expect(cf.summary).toMatchObject({ judgment: 1, stress: 4, arithmetic: 9 });
  });

  it('constant conditions (EVIDENCE_MISSING collateral, NEEDS_HUMAN_JUDGMENT definition) never change', () => {
    for (const m of battery) {
      const cf = counterfactual(m, DEFAULT_ASSUMPTIONS, base);
      expect(cf.conditions.find((c) => c.id === 'k.collateral')).toMatchObject({ from: 'EVIDENCE_MISSING', to: 'EVIDENCE_MISSING' });
      expect(cf.conditions.find((c) => c.id === 'k.ebitdaDefinition')).toMatchObject({ from: 'NEEDS_HUMAN_JUDGMENT', to: 'NEEDS_HUMAN_JUDGMENT' });
    }
  });
});

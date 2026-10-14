import { describe, expect, it } from 'vitest';
import {
  SimulationInputError,
  baselineDefects,
  downstreamOf,
  lensAxioms,
  simulate,
  upstreamOf,
  type DependencyGraph,
  type GraphClaim,
} from '@/lib/record/engine';
import type { Derivation } from '@/lib/record/schema';

/* Small synthetic graphs, so each rule of the semantics is tested in isolation. */

const C = (n: number) => `AM-CLAIM-${String(n).padStart(6, '0')}`;
const AX = (n: number) => `AM-AX-${String(n).padStart(3, '0')}`;
const DRV = (n: number) => `AM-DRV-${String(n).padStart(4, '0')}`;

function claim(n: number, grounded: boolean): GraphClaim {
  return { code: C(n), statement: `claim ${n}`, role: 'thesis', classification: grounded ? 'textual_proposition' : 'inference', topic: 't', grounded, cases: [] };
}

function drv(
  n: number,
  of: number,
  premises: Array<[number, 'necessary' | 'supporting', ('report' | 'warrant')?]>,
  axioms: Array<[number, 'requires' | 'strengthened_by']> = [],
): Derivation {
  return {
    code: DRV(n),
    claim: C(of),
    label: `derivation ${n}`,
    summary: 's',
    premises: premises.map(([p, necessity, use]) => ({ claim: C(p), necessity, type: 'premise', use: use ?? 'report', rationale: 'r' })),
    axioms: axioms.map(([a, role]) => ({ axiom: AX(a), role, note: null })),
    since: '2026-10-14',
  };
}

function graph(claims: GraphClaim[], derivations: Derivation[], extra: Partial<DependencyGraph> = {}): DependencyGraph {
  return {
    recordVersion: 'test',
    claims,
    derivations,
    axioms: [1, 2, 3].map((n) => ({ code: AX(n), label: `axiom ${n}`, heldBy: 'x', stances: [] })),
    mapLinks: [],
    counterModels: [],
    ...extra,
  };
}

describe('dependency engine — AND/OR semantics', () => {
  // C3 is derived two independent ways: from C1 (needs AX-1) or from C2 (needs AX-2).
  const twoProofs = graph(
    [claim(1, true), claim(2, true), claim(3, false)],
    [drv(1, 3, [[1, 'necessary']], [[1, 'requires']]), drv(2, 3, [[2, 'necessary']], [[2, 'requires']])],
  );

  it('keeps a conclusion standing while any independent derivation survives', () => {
    const r = simulate(twoProofs, { rejectAxioms: [AX(1)] });
    expect(r.statuses[C(3)]).toBe('weakened');
    const reasons = r.affected.find((a) => a.code === C(3))!.reasons.map((x) => x.kind);
    expect(reasons).toContain('derivation_failed');
    expect(reasons).toContain('derivation_holds');
  });

  it('breaks a conclusion only when no sufficient derivation remains', () => {
    expect(simulate(twoProofs, { rejectAxioms: [AX(1), AX(2)] }).statuses[C(3)]).toBe('broken');
    expect(simulate(twoProofs, { rejectClaims: [C(1)], rejectAxioms: [AX(2)] }).statuses[C(3)]).toBe('broken');
  });

  it('requires every necessary premise within a derivation (AND)', () => {
    const g = graph([claim(1, true), claim(2, true), claim(3, false)], [drv(1, 3, [[1, 'necessary'], [2, 'necessary']])]);
    expect(simulate(g, { rejectClaims: [C(2)] }).statuses[C(3)]).toBe('broken');
  });

  it('weakens, but never breaks, on a failed supporting premise or strengthening axiom', () => {
    const g = graph(
      [claim(1, true), claim(2, true), claim(3, false)],
      [drv(1, 3, [[1, 'necessary'], [2, 'supporting']], [[1, 'strengthened_by']])],
    );
    expect(simulate(g, { rejectClaims: [C(2)] }).statuses[C(3)]).toBe('weakened');
    expect(simulate(g, { rejectAxioms: [AX(1)] }).statuses[C(3)]).toBe('weakened');
  });

  it('propagates weakening transitively', () => {
    const g = graph(
      [claim(1, true), claim(2, false), claim(3, false)],
      [drv(1, 2, [[1, 'necessary']], [[1, 'strengthened_by']]), drv(2, 3, [[2, 'necessary']])],
    );
    const r = simulate(g, { rejectAxioms: [AX(1)] });
    expect(r.statuses[C(2)]).toBe('weakened');
    expect(r.statuses[C(3)]).toBe('weakened');
    expect(r.affected.find((a) => a.code === C(3))!.via).toEqual([AX(1), C(2), C(3)]);
  });
});

describe('dependency engine — reports and warrants', () => {
  // C2 is a report ("the text says X"), with an argument that rests on C1.
  // C3 needs C2 only as a report; C4 needs C2's warrant.
  const g = graph(
    [claim(1, true), claim(2, true), claim(3, false), claim(4, false)],
    [
      drv(1, 2, [[1, 'necessary']]),
      drv(2, 3, [[2, 'necessary', 'report']]),
      drv(3, 4, [[2, 'necessary', 'warrant']]),
    ],
  );

  it('keeps a textual report standing when the argument behind it fails', () => {
    const r = simulate(g, { rejectClaims: [C(1)] });
    expect(r.statuses[C(2)]).toBe('unwarranted');
    const reasons = r.affected.find((a) => a.code === C(2))!.reasons.map((x) => x.kind);
    expect(reasons).toContain('witness_stands');
  });

  it('lets a derivation that needs only the report survive, and one that needs the warrant fail', () => {
    const r = simulate(g, { rejectClaims: [C(1)] });
    expect(r.statuses[C(3)]).toBe('weakened');
    expect(r.statuses[C(4)]).toBe('broken');
    expect(r.derivations[DRV(3)].failures).toEqual([{ kind: 'premise_unwarranted', premise: C(2) }]);
  });

  it('only direct rejection defeats a report', () => {
    expect(simulate(g, { rejectClaims: [C(2)] }).statuses[C(2)]).toBe('rejected');
    expect(simulate(g, { rejectClaims: [C(2)] }).statuses[C(3)]).toBe('broken');
  });
});

describe('dependency engine — cycles', () => {
  it('does not let a circle of claims establish itself', () => {
    const g = graph([claim(1, false), claim(2, false)], [drv(1, 1, [[2, 'necessary']]), drv(2, 2, [[1, 'necessary']])]);
    expect(baselineDefects(g)).toEqual([C(1), C(2)]);
  });

  it('breaks a cycle when its only external support is rejected', () => {
    // C1 ⇐ C2 or ⇐ C3 (grounded); C2 ⇐ C1. Baseline: both hold through C3.
    const g = graph(
      [claim(1, false), claim(2, false), claim(3, true)],
      [drv(1, 1, [[2, 'necessary']]), drv(2, 1, [[3, 'necessary']]), drv(3, 2, [[1, 'necessary']])],
    );
    expect(baselineDefects(g)).toEqual([]);
    const r = simulate(g, { rejectClaims: [C(3)] });
    expect(r.statuses[C(1)]).toBe('broken');
    expect(r.statuses[C(2)]).toBe('broken');
  });
});

describe('dependency engine — maps, counter-models and lenses', () => {
  const g = graph([claim(1, true), claim(2, true), claim(3, false)], [drv(1, 3, [[1, 'necessary']], [[1, 'requires']])], {
    mapLinks: [
      { mapKind: 'doctrine', code: 'AM-DOC-0001', role: 'grounds', claim: C(1), note: 'n' },
      { mapKind: 'doctrine', code: 'AM-DOC-0001', role: 'grounds', claim: C(2), note: 'n' },
      { mapKind: 'doctrine', code: 'AM-DOC-0002', role: 'grounds', claim: C(3), note: 'n' },
    ],
    counterModels: [
      { code: 'AM-CM-001', title: 'rival', heldBy: 'x', targets: C(3), reliesOn: [AX(2)], rejects: [AX(1)], position: null, strength: 'strong' },
    ],
    axioms: [
      { code: AX(1), label: 'one', heldBy: 'x', stances: [{ tradition: 'a', stance: 'rejects' }, { tradition: 'b', stance: 'holds' }] },
      { code: AX(2), label: 'two', heldBy: 'x', stances: [{ tradition: 'a', stance: 'brackets' }, { tradition: 'b', stance: 'qualifies' }] },
      { code: AX(3), label: 'three', heldBy: 'x', stances: [] },
    ],
  });

  it('keeps a map edge grounded while any grounding claim holds (OR)', () => {
    const one = simulate(g, { rejectClaims: [C(1)] });
    expect(one.mapEdges.find((e) => e.code === 'AM-DOC-0001')!.status).toBe('weakened');
    const both = simulate(g, { rejectClaims: [C(1), C(2)] });
    expect(both.mapEdges.find((e) => e.code === 'AM-DOC-0001')!.status).toBe('ungrounded');
  });

  it('shows counter-models on both sides instead of resolving the dispute', () => {
    expect(simulate(g, { rejectAxioms: [AX(1)] }).counterModels[0]).toMatchObject({ status: 'aligned', alignedWith: [AX(1)] });
    expect(simulate(g, { rejectAxioms: [AX(2)] }).counterModels[0]).toMatchObject({ status: 'undermined', underminedBy: [AX(2)] });
  });

  it('applies a lens by removing the axioms a tradition rejects or sets aside, and nothing else', () => {
    expect(lensAxioms(g, 'a')).toEqual([AX(1), AX(2)]);
    expect(lensAxioms(g, 'b')).toEqual([]);
    const r = simulate(g, { lens: 'a' });
    expect(r.effectiveAxioms).toEqual([AX(1), AX(2)]);
    expect(r.statuses[C(3)]).toBe('broken');
    expect(r.input.lens).toBe('a');
  });

  it('refuses unknown codes rather than ignoring them', () => {
    expect(() => simulate(g, { rejectClaims: ['AM-CLAIM-999999'] })).toThrow(SimulationInputError);
    expect(() => simulate(g, { rejectAxioms: ['AM-AX-999'] })).toThrow(/AM-AX-999/);
  });

  it('reports what a claim rests on and what rests on it', () => {
    expect(upstreamOf(g, C(3))).toEqual({ claims: [C(1)], axioms: [AX(1)] });
    expect(downstreamOf(g, C(1))).toEqual([C(3)]);
    expect(downstreamOf(g, AX(1))).toEqual([C(3)]);
  });

  it('never mutates the graph it evaluates', () => {
    const before = JSON.stringify(g);
    simulate(g, { rejectClaims: [C(1), C(2)], rejectAxioms: [AX(1), AX(2)] });
    expect(JSON.stringify(g)).toBe(before);
  });
});

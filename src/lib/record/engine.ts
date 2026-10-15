/**
 * The Hermeneutical Dependency Model — rejection analysis.
 *
 * Given a set of rejected claims and rejected axioms, decide what still holds.
 * The published model propagated rejection edge by edge, so a conclusion with
 * two independent arguments was marked broken as soon as either failed, and a
 * map connection grounded by two claims collapsed when one of them did. This
 * engine evaluates the record instead of walking it:
 *
 *   Derivations are OR. A claim holds while at least one derivation holds.
 *   Within a derivation, every necessary premise and every required axiom
 *   must hold (AND). Supporting premises and strengthening axioms never
 *   break a derivation; when they fail, the claim is weakened.
 *
 *   Reports are not conclusions. A claim grounded in a witness ("Hebrews
 *   says X") has an implicit witness derivation that only direct rejection
 *   defeats. When the argument behind such a claim fails, the claim keeps
 *   its standing as a report and loses its warrant — and a derivation that
 *   needs the premise's warrant, not merely the report, fails with it.
 *
 *   Cycles are handled by computing the least fixed point: a claim that is
 *   supported only by a circle of claims supporting each other is never
 *   established, at baseline or after any rejection.
 *
 * The engine never edits the record. It returns a simulation, and every
 * consumer — site, REST API, MCP server — labels it as one.
 *
 * Pure TypeScript with no Node or browser dependencies, so the same code runs
 * on the server and in the explorer.
 */

import type { Derivation, MapLink } from './schema';
import { LENS_REMOVES, type AxiomStance, type MapKind, type PremiseUse } from './taxonomy';

/* ------------------------------------------------------------------ *
 * Graph
 * ------------------------------------------------------------------ */

export interface GraphClaim {
  code: string;
  statement: string;
  role: string;
  classification: string;
  topic: string;
  /** True when the claim is grounded in a witness or in evidence, not only in other claims. */
  grounded: boolean;
  cases: string[];
}

export interface GraphAxiom {
  code: string;
  label: string;
  heldBy: string;
  stances: Array<{ tradition: string; stance: AxiomStance }>;
}

export interface GraphCounterModel {
  code: string;
  title: string;
  heldBy: string;
  targets: string;
  reliesOn: string[];
  rejects: string[];
  position: string | null;
  strength: string;
}

export interface DependencyGraph {
  recordVersion: string;
  claims: GraphClaim[];
  axioms: GraphAxiom[];
  derivations: Derivation[];
  mapLinks: MapLink[];
  counterModels: GraphCounterModel[];
}

/* ------------------------------------------------------------------ *
 * Results
 * ------------------------------------------------------------------ */

export const CLAIM_STATUSES = ['stands', 'weakened', 'unwarranted', 'broken', 'rejected'] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const STATUS_LABELS: Record<ClaimStatus, string> = {
  stands: 'Stands',
  weakened: 'Weakened',
  unwarranted: 'Warrant lost',
  broken: 'Broken',
  rejected: 'Rejected',
};

export const STATUS_DESCRIPTIONS: Record<ClaimStatus, string> = {
  stands: 'Unaffected by the rejection.',
  weakened: 'Still holds, but on less support than before.',
  unwarranted: 'The text still says this; the argument that made it a warranted reading no longer holds.',
  broken: 'No derivation of this claim survives the rejection.',
  rejected: 'Rejected directly in this simulation.',
};

const SEVERITY: Record<ClaimStatus, number> = { stands: 0, weakened: 1, unwarranted: 2, broken: 3, rejected: 4 };

export type Failure =
  | { kind: 'axiom_rejected'; axiom: string }
  | { kind: 'premise_lost'; premise: string; use: PremiseUse }
  | { kind: 'premise_unwarranted'; premise: string };

export type Reason =
  | { kind: 'rejected' }
  | { kind: 'not_established_at_baseline' }
  | { kind: 'witness_stands' }
  | { kind: 'derivation_failed'; derivation: string; label: string; failures: Failure[] }
  | { kind: 'derivation_holds'; derivation: string; label: string }
  | { kind: 'supporting_premise_affected'; derivation: string; premise: string; premiseStatus: ClaimStatus }
  | { kind: 'necessary_premise_weakened'; derivation: string; premise: string; premiseStatus: ClaimStatus }
  | { kind: 'strengthening_axiom_rejected'; derivation: string; axiom: string };

export interface ClaimOutcome {
  code: string;
  status: ClaimStatus;
  /** Distance from the nearest rejected claim or axiom, following dependencies. */
  depth: number;
  /** One shortest path from a rejected node to this claim. */
  via: string[];
  reasons: Reason[];
}

export type EdgeStatus = 'stands' | 'weakened' | 'ungrounded';

export interface EdgeOutcome {
  mapKind: MapKind;
  code: string;
  status: EdgeStatus;
  /** Grounding claims that still hold. */
  groundedBy: string[];
  /** Grounding or illustrating claims affected by the rejection. */
  affectedLinks: Array<{ claim: string; role: MapLink['role']; status: ClaimStatus }>;
}

export type CounterStatus = 'unaffected' | 'aligned' | 'undermined';

export interface CounterOutcome {
  code: string;
  status: CounterStatus;
  /** Rejected axioms this counter-model also denies. */
  alignedWith: string[];
  /** Rejected axioms, or a broken position, that the counter-model needs. */
  underminedBy: string[];
}

export interface SimulationInput {
  rejectClaims?: string[];
  rejectAxioms?: string[];
  /** Apply a tradition's lens: remove the axioms it rejects or sets aside. */
  lens?: string | null;
}

export interface SimulationResult {
  recordVersion: string;
  input: { rejectClaims: string[]; rejectAxioms: string[]; lens: string | null };
  /** Axioms treated as rejected: those named, plus any removed by the lens. */
  effectiveAxioms: string[];
  statuses: Record<string, ClaimStatus>;
  /** Claims whose status is not "stands", nearest the rejection first. */
  affected: ClaimOutcome[];
  derivations: Record<string, { valid: boolean; validAtBaseline: boolean; failures: Failure[] }>;
  mapEdges: EdgeOutcome[];
  counterModels: CounterOutcome[];
  summary: Record<ClaimStatus, number> & { edgesUngrounded: number; edgesWeakened: number };
}

export class SimulationInputError extends Error {
  constructor(
    message: string,
    readonly unknown: string[],
  ) {
    super(message);
    this.name = 'SimulationInputError';
  }
}

/* ------------------------------------------------------------------ *
 * Indexes
 * ------------------------------------------------------------------ */

interface Index {
  graph: DependencyGraph;
  claims: Map<string, GraphClaim>;
  axioms: Map<string, GraphAxiom>;
  derivationsOf: Map<string, Derivation[]>;
  /** premise code → derivations that use it */
  usedBy: Map<string, Derivation[]>;
  /** axiom code → derivations that cite it */
  axiomUsedBy: Map<string, Derivation[]>;
  baseline: Evaluation;
}

const INDEX_CACHE = new WeakMap<DependencyGraph, Index>();

function index(graph: DependencyGraph): Index {
  const cached = INDEX_CACHE.get(graph);
  if (cached) return cached;

  const derivationsOf = new Map<string, Derivation[]>();
  const usedBy = new Map<string, Derivation[]>();
  const axiomUsedBy = new Map<string, Derivation[]>();
  const push = <K, V>(m: Map<K, V[]>, k: K, v: V) => {
    const list = m.get(k);
    if (list) list.push(v);
    else m.set(k, [v]);
  };
  for (const d of graph.derivations) {
    push(derivationsOf, d.claim, d);
    for (const p of d.premises) push(usedBy, p.claim, d);
    for (const a of d.axioms) push(axiomUsedBy, a.axiom, d);
  }

  const partial = {
    graph,
    claims: new Map(graph.claims.map((c) => [c.code, c])),
    axioms: new Map(graph.axioms.map((a) => [a.code, a])),
    derivationsOf,
    usedBy,
    axiomUsedBy,
  };
  const idx: Index = { ...partial, baseline: evaluate(partial, new Set(), new Set()) };
  INDEX_CACHE.set(graph, idx);
  return idx;
}

/* ------------------------------------------------------------------ *
 * Evaluation — least fixed point
 * ------------------------------------------------------------------ */

interface Evaluation {
  established: Set<string>;
  warranted: Set<string>;
  valid: Map<string, boolean>;
}

type IndexCore = Omit<Index, 'baseline'>;

function derivationValid(
  d: Derivation,
  rejectedAxioms: Set<string>,
  established: Set<string>,
  warranted: Set<string>,
): boolean {
  for (const a of d.axioms) {
    if (a.role === 'requires' && rejectedAxioms.has(a.axiom)) return false;
  }
  for (const p of d.premises) {
    if (p.necessity !== 'necessary') continue;
    if (p.use === 'report' ? !established.has(p.claim) : !warranted.has(p.claim)) return false;
  }
  return true;
}

function evaluate(idx: IndexCore, rejectedClaims: Set<string>, rejectedAxioms: Set<string>): Evaluation {
  const established = new Set<string>();
  const warranted = new Set<string>();

  // Monotone iteration from the empty set: each pass can only add claims, so
  // it terminates, and what it reaches is the least fixed point — the claims
  // with a non-circular derivation from the record's witnesses.
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of idx.graph.claims) {
      if (rejectedClaims.has(c.code)) continue;
      const derivations = idx.derivationsOf.get(c.code) ?? [];
      const anyValid = derivations.some((d) => derivationValid(d, rejectedAxioms, established, warranted));
      if (!established.has(c.code) && (c.grounded || anyValid)) {
        established.add(c.code);
        changed = true;
      }
      const warrantedNow = established.has(c.code) && (derivations.length === 0 ? c.grounded : anyValid);
      if (!warranted.has(c.code) && warrantedNow) {
        warranted.add(c.code);
        changed = true;
      }
    }
  }

  const valid = new Map<string, boolean>();
  for (const d of idx.graph.derivations) {
    valid.set(d.code, !rejectedClaims.has(d.claim) && derivationValid(d, rejectedAxioms, established, warranted));
  }
  return { established, warranted, valid };
}

function failuresOf(d: Derivation, rejectedAxioms: Set<string>, ev: Evaluation): Failure[] {
  const out: Failure[] = [];
  for (const a of d.axioms) {
    if (a.role === 'requires' && rejectedAxioms.has(a.axiom)) out.push({ kind: 'axiom_rejected', axiom: a.axiom });
  }
  for (const p of d.premises) {
    if (p.necessity !== 'necessary') continue;
    if (!ev.established.has(p.claim)) out.push({ kind: 'premise_lost', premise: p.claim, use: p.use });
    else if (p.use === 'warrant' && !ev.warranted.has(p.claim)) out.push({ kind: 'premise_unwarranted', premise: p.claim });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Lenses
 * ------------------------------------------------------------------ */

/** Axioms a tradition rejects or sets aside — what its lens removes. */
export function lensAxioms(graph: DependencyGraph, tradition: string): string[] {
  return graph.axioms
    .filter((a) => a.stances.some((s) => s.tradition === tradition && LENS_REMOVES.includes(s.stance)))
    .map((a) => a.code);
}

/* ------------------------------------------------------------------ *
 * Simulation
 * ------------------------------------------------------------------ */

export function simulate(graph: DependencyGraph, input: SimulationInput = {}): SimulationResult {
  const idx = index(graph);
  const rejectClaims = [...new Set(input.rejectClaims ?? [])];
  const rejectAxioms = [...new Set(input.rejectAxioms ?? [])];
  const lens = input.lens ?? null;

  const unknown = [
    ...rejectClaims.filter((c) => !idx.claims.has(c)),
    ...rejectAxioms.filter((a) => !idx.axioms.has(a)),
  ];
  if (unknown.length > 0) {
    throw new SimulationInputError(`Unknown claim or axiom code: ${unknown.join(', ')}`, unknown);
  }

  const effective = new Set(rejectAxioms);
  if (lens) for (const a of lensAxioms(graph, lens)) effective.add(a);

  const rejectedClaims = new Set(rejectClaims);
  const base = idx.baseline;
  const ev = evaluate(idx, rejectedClaims, effective);

  /* --- Primary status: rejected, broken, warrant lost --- */
  const statuses: Record<string, ClaimStatus> = {};
  for (const c of graph.claims) {
    if (rejectedClaims.has(c.code)) statuses[c.code] = 'rejected';
    else if (!ev.established.has(c.code)) statuses[c.code] = 'broken';
    else if (base.warranted.has(c.code) && !ev.warranted.has(c.code)) statuses[c.code] = 'unwarranted';
    else statuses[c.code] = 'stands';
  }

  /* --- Weakening: a second monotone pass over the claims still standing --- */
  const weakenReasons = new Map<string, Reason[]>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of graph.claims) {
      if (statuses[c.code] !== 'stands') continue;
      const reasons: Reason[] = [];
      for (const d of idx.derivationsOf.get(c.code) ?? []) {
        const nowValid = ev.valid.get(d.code)!;
        if (base.valid.get(d.code) && !nowValid) {
          reasons.push({ kind: 'derivation_failed', derivation: d.code, label: d.label, failures: failuresOf(d, effective, ev) });
          continue;
        }
        if (!nowValid) continue;
        for (const p of d.premises) {
          const ps = statuses[p.claim];
          if (ps === undefined || ps === 'stands') continue;
          if (p.necessity === 'supporting') {
            reasons.push({ kind: 'supporting_premise_affected', derivation: d.code, premise: p.claim, premiseStatus: ps });
          } else {
            reasons.push({ kind: 'necessary_premise_weakened', derivation: d.code, premise: p.claim, premiseStatus: ps });
          }
        }
        for (const a of d.axioms) {
          if (a.role === 'strengthened_by' && effective.has(a.axiom)) {
            reasons.push({ kind: 'strengthening_axiom_rejected', derivation: d.code, axiom: a.axiom });
          }
        }
      }
      if (reasons.length > 0) {
        statuses[c.code] = 'weakened';
        weakenReasons.set(c.code, reasons);
        changed = true;
      }
    }
  }

  /* --- Reasons for every affected claim --- */
  const reasonsFor = (code: string): Reason[] => {
    const status = statuses[code];
    if (status === 'rejected') return [{ kind: 'rejected' }];
    if (status === 'weakened') {
      const holds = (idx.derivationsOf.get(code) ?? [])
        .filter((d) => ev.valid.get(d.code))
        .map((d): Reason => ({ kind: 'derivation_holds', derivation: d.code, label: d.label }));
      const witness: Reason[] = idx.claims.get(code)!.grounded ? [{ kind: 'witness_stands' }] : [];
      return [...weakenReasons.get(code)!, ...holds, ...witness];
    }
    if (!base.established.has(code)) return [{ kind: 'not_established_at_baseline' }];
    const out: Reason[] = [];
    for (const d of idx.derivationsOf.get(code) ?? []) {
      if (ev.valid.get(d.code)) out.push({ kind: 'derivation_holds', derivation: d.code, label: d.label });
      else out.push({ kind: 'derivation_failed', derivation: d.code, label: d.label, failures: failuresOf(d, effective, ev) });
    }
    if (status === 'unwarranted') out.push({ kind: 'witness_stands' });
    return out;
  };

  /* --- Depth and path from the rejection, for ordering and display --- */
  const paths = new Map<string, string[]>();
  const queue: string[] = [];
  for (const code of rejectedClaims) {
    paths.set(code, [code]);
    queue.push(code);
  }
  for (const axiom of effective) {
    for (const d of idx.axiomUsedBy.get(axiom) ?? []) {
      if (statuses[d.claim] !== 'stands' && !paths.has(d.claim)) {
        paths.set(d.claim, [axiom, d.claim]);
        queue.push(d.claim);
      }
    }
  }
  while (queue.length > 0) {
    const code = queue.shift()!;
    for (const d of idx.usedBy.get(code) ?? []) {
      if (statuses[d.claim] !== 'stands' && !paths.has(d.claim)) {
        paths.set(d.claim, [...paths.get(code)!, d.claim]);
        queue.push(d.claim);
      }
    }
  }

  const affected: ClaimOutcome[] = graph.claims
    .filter((c) => statuses[c.code] !== 'stands')
    .map((c) => {
      const via = paths.get(c.code) ?? [c.code];
      return { code: c.code, status: statuses[c.code], depth: via.length - 1, via, reasons: reasonsFor(c.code) };
    })
    .sort((a, b) => a.depth - b.depth || SEVERITY[b.status] - SEVERITY[a.status] || a.code.localeCompare(b.code));

  /* --- Map edges: grounded while any grounding claim holds (OR) --- */
  const edges = new Map<string, MapLink[]>();
  for (const l of graph.mapLinks) {
    const key = `${l.mapKind}:${l.code}`;
    const list = edges.get(key);
    if (list) list.push(l);
    else edges.set(key, [l]);
  }
  const mapEdges: EdgeOutcome[] = [];
  for (const links of edges.values()) {
    const grounds = links.filter((l) => l.role === 'grounds');
    const groundedBy = grounds.filter((l) => ev.established.has(l.claim)).map((l) => l.claim);
    const affectedLinks = links
      .filter((l) => statuses[l.claim] !== 'stands')
      .map((l) => ({ claim: l.claim, role: l.role, status: statuses[l.claim] }));
    if (affectedLinks.length === 0) continue;
    const status: EdgeStatus = grounds.length > 0 && groundedBy.length === 0 ? 'ungrounded' : 'weakened';
    mapEdges.push({ mapKind: links[0].mapKind, code: links[0].code, status, groundedBy, affectedLinks });
  }
  mapEdges.sort((a, b) => (a.status === b.status ? a.code.localeCompare(b.code) : a.status === 'ungrounded' ? -1 : 1));

  /* --- Counter-models: shown on both sides, never resolved --- */
  const counterModels: CounterOutcome[] = graph.counterModels.map((m) => {
    const underminedBy = m.reliesOn.filter((a) => effective.has(a));
    if (m.position && ['broken', 'rejected', 'unwarranted'].includes(statuses[m.position])) underminedBy.push(m.position);
    const alignedWith = m.rejects.filter((a) => effective.has(a));
    const status: CounterStatus = underminedBy.length > 0 ? 'undermined' : alignedWith.length > 0 ? 'aligned' : 'unaffected';
    return { code: m.code, status, alignedWith, underminedBy };
  });

  /* --- Summary --- */
  const summary = {
    stands: 0,
    weakened: 0,
    unwarranted: 0,
    broken: 0,
    rejected: 0,
    edgesUngrounded: mapEdges.filter((e) => e.status === 'ungrounded').length,
    edgesWeakened: mapEdges.filter((e) => e.status === 'weakened').length,
  };
  for (const s of Object.values(statuses)) summary[s] += 1;

  const derivations: SimulationResult['derivations'] = {};
  for (const d of graph.derivations) {
    derivations[d.code] = {
      valid: ev.valid.get(d.code)!,
      validAtBaseline: base.valid.get(d.code)!,
      failures: ev.valid.get(d.code) ? [] : failuresOf(d, effective, ev),
    };
  }

  return {
    recordVersion: graph.recordVersion,
    input: { rejectClaims, rejectAxioms, lens },
    effectiveAxioms: [...effective].sort(),
    statuses,
    affected,
    derivations,
    mapEdges,
    counterModels,
    summary,
  };
}

/** Claims not established when nothing is rejected — record defects, such as unsupported cycles. */
export function baselineDefects(graph: DependencyGraph): string[] {
  const idx = index(graph);
  return graph.claims.filter((c) => !idx.baseline.established.has(c.code)).map((c) => c.code);
}

/** What a claim rests on, transitively: claims and axioms upstream of it. */
export function upstreamOf(graph: DependencyGraph, code: string): { claims: string[]; axioms: string[] } {
  const idx = index(graph);
  const claims = new Set<string>();
  const axioms = new Set<string>();
  const stack = [code];
  while (stack.length > 0) {
    const c = stack.pop()!;
    for (const d of idx.derivationsOf.get(c) ?? []) {
      for (const a of d.axioms) axioms.add(a.axiom);
      for (const p of d.premises) {
        if (!claims.has(p.claim) && p.claim !== code) {
          claims.add(p.claim);
          stack.push(p.claim);
        }
      }
    }
  }
  return { claims: [...claims].sort(), axioms: [...axioms].sort() };
}

/** Claims that rest on a claim or axiom, transitively. */
export function downstreamOf(graph: DependencyGraph, code: string): string[] {
  const idx = index(graph);
  const out = new Set<string>();
  const stack: string[] = [];
  for (const d of idx.axiomUsedBy.get(code) ?? []) stack.push(d.claim);
  for (const d of idx.usedBy.get(code) ?? []) stack.push(d.claim);
  while (stack.length > 0) {
    const c = stack.pop()!;
    if (out.has(c) || c === code) continue;
    out.add(c);
    for (const d of idx.usedBy.get(c) ?? []) stack.push(d.claim);
  }
  return [...out].sort();
}

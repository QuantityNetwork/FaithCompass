/**
 * Counterfactual engine for the Decision Twin: mutate assumptions, recalculate only what the mutation can reach,
 * read the condition states, and return a structured diff. Deterministic; no model.
 *
 * Every changed node is labelled with what kind of change it is:
 * - `assumption`: the mutated input or premise itself;
 * - `judgment`: a premise, the set of documents treated as verified, or a condition that needs human judgment
 *   before or after the change;
 * - `stress`: a node of the stress case (lower EBITDA scenario);
 * - `arithmetic`: any other calculation, condition or warning that follows from the change by formula.
 */
import { canonicalJson } from '@/lib/decision/canonical';
import { DEFAULT_ASSUMPTIONS, evaluate, fingerprint, recalculate, type Assumptions, type ConditionStatus, type EvaluatedNode, type Evaluation } from '@/lib/decision/engine';

export type ChangeClass = 'assumption' | 'judgment' | 'stress' | 'arithmetic';
export const CONDITION_STATES: readonly ConditionStatus[] = ['MET', 'NOT_MET', 'EVIDENCE_MISSING', 'NEEDS_HUMAN_JUDGMENT'];

export interface NodeChange {
  id: string;
  kind: EvaluatedNode['kind'];
  label: string;
  class: ChangeClass;
  from: { value: EvaluatedNode['value']; display: string; status: EvaluatedNode['status'] | null };
  to: { value: EvaluatedNode['value']; display: string; status: EvaluatedNode['status'] | null };
}

export interface Counterfactual {
  mutation: Partial<Assumptions>;
  changedInputs: string[];
  /** Nodes recalculated (the changed inputs and everything downstream of them); the rest were carried over. */
  recomputed: string[];
  changes: NodeChange[];
  conditions: { id: string; label: string; from: ConditionStatus; to: ConditionStatus; changed: boolean }[];
  summary: Record<ChangeClass, number> & { recomputed: number; total: number; conditionsChanged: number };
}

function classify(n: EvaluatedNode, before: EvaluatedNode, changedInputs: string[]): ChangeClass {
  if (changedInputs.includes(n.id)) return n.kind === 'premise' || n.id === 'in.verified' ? 'judgment' : 'assumption';
  if (n.status === 'NEEDS_HUMAN_JUDGMENT' || before.status === 'NEEDS_HUMAN_JUDGMENT') return 'judgment';
  if (n.id === 'k.verification' || n.id === 'w.unverified') return 'judgment';
  if (/stress/i.test(n.id)) return 'stress';
  return 'arithmetic';
}

const side = (n: EvaluatedNode) => ({ value: n.value, display: n.display, status: n.status ?? null });

/** Apply `mutation` to `base` and diff. `baseEvaluation` may be passed to avoid evaluating the base again. */
export function counterfactual(mutation: Partial<Assumptions>, base: Assumptions = DEFAULT_ASSUMPTIONS, baseEvaluation: Evaluation = evaluate(base)): Counterfactual {
  const next = { ...base, ...mutation } as Assumptions;
  const { evaluation, changedInputs, recomputed } = recalculate(baseEvaluation, next);
  const changes: NodeChange[] = [];
  for (const id of Object.keys(evaluation)) {
    const a = baseEvaluation[id];
    const b = evaluation[id];
    if (fingerprint(a) === fingerprint(b) && canonicalJson(a.status ?? null) === canonicalJson(b.status ?? null)) continue;
    changes.push({ id, kind: b.kind, label: b.label, class: classify(b, a, changedInputs), from: side(a), to: side(b) });
  }
  const conditions = Object.values(evaluation)
    .filter((n) => n.kind === 'condition')
    .map((n) => ({ id: n.id, label: n.label, from: baseEvaluation[n.id].status as ConditionStatus, to: n.status as ConditionStatus, changed: baseEvaluation[n.id].status !== n.status }));
  const count = (c: ChangeClass) => changes.filter((x) => x.class === c).length;
  return {
    mutation,
    changedInputs,
    recomputed,
    changes,
    conditions,
    summary: {
      assumption: count('assumption'),
      judgment: count('judgment'),
      stress: count('stress'),
      arithmetic: count('arithmetic'),
      recomputed: recomputed.length,
      total: Object.keys(evaluation).length,
      conditionsChanged: conditions.filter((c) => c.changed).length,
    },
  };
}

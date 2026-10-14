/**
 * Plain-language explanations of simulation results.
 *
 * Shared by the API (server) and the Dependency Explorer (browser), so a
 * reason reads the same wherever it is shown. Pure; no Node or DOM APIs.
 */

import { STATUS_LABELS, type DependencyGraph, type Failure, type Reason } from './engine';

export interface Lookup {
  claim(code: string): string;
  axiom(code: string): string;
}

export function lookupFor(graph: DependencyGraph): Lookup {
  const claims = new Map(graph.claims.map((c) => [c.code, c.statement]));
  const axioms = new Map(graph.axioms.map((a) => [a.code, a.label]));
  return {
    claim: (code) => claims.get(code) ?? code,
    axiom: (code) => axioms.get(code) ?? code,
  };
}

function failure(f: Failure, l: Lookup): string {
  switch (f.kind) {
    case 'axiom_rejected':
      return `it requires ${f.axiom} (${l.axiom(f.axiom)}), which is rejected`;
    case 'premise_unwarranted':
      return `it needs ${f.premise} to hold as a conclusion, and that claim has lost its warrant`;
    case 'premise_lost':
      return `its necessary premise ${f.premise} no longer holds`;
  }
}

export function explain(reason: Reason, l: Lookup): string {
  switch (reason.kind) {
    case 'rejected':
      return 'Rejected directly in this simulation.';
    case 'not_established_at_baseline':
      return 'Not established even when nothing is rejected — a record defect.';
    case 'witness_stands':
      return 'The cited text still says this; its standing as a report is unaffected.';
    case 'derivation_holds':
      return `${reason.derivation} “${reason.label}” still holds.`;
    case 'derivation_failed':
      return `${reason.derivation} “${reason.label}” fails: ${reason.failures.map((f) => failure(f, l)).join('; ')}.`;
    case 'supporting_premise_affected':
      return `Supporting premise ${reason.premise} is ${STATUS_LABELS[reason.premiseStatus].toLowerCase()}.`;
    case 'necessary_premise_weakened':
      return `Necessary premise ${reason.premise} still holds but is ${STATUS_LABELS[reason.premiseStatus].toLowerCase()}.`;
    case 'strengthening_axiom_rejected':
      return `${reason.axiom} (${l.axiom(reason.axiom)}) strengthened ${reason.derivation} and is rejected.`;
  }
}

/**
 * Contradiction Map for the synthetic case.
 *
 * Five classes. Only CONFIRMED_CONFLICT and POTENTIAL_CONFLICT are conflicts.
 * A difference of period, scope, definition or version is classed
 * DIFFERENT_REPORTING_BASIS and is explicitly NOT a contradiction.
 */
import { getDocument } from './case';

export const CONTRADICTION_CLASSES = [
  'CONFIRMED_CONFLICT',
  'POTENTIAL_CONFLICT',
  'DIFFERENT_REPORTING_BASIS',
  'MISSING_EVIDENCE',
  'UNRESOLVED_INTERPRETATION',
] as const;
export type ContradictionClass = (typeof CONTRADICTION_CLASSES)[number];

export const CLASS_LABEL: Record<ContradictionClass, string> = {
  CONFIRMED_CONFLICT: 'Confirmed conflict',
  POTENTIAL_CONFLICT: 'Potential conflict',
  DIFFERENT_REPORTING_BASIS: 'Different reporting basis (not a conflict)',
  MISSING_EVIDENCE: 'Missing evidence',
  UNRESOLVED_INTERPRETATION: 'Unresolved interpretation',
};

export function isConflict(c: ContradictionClass): boolean {
  return c === 'CONFIRMED_CONFLICT' || c === 'POTENTIAL_CONFLICT';
}

interface Ref {
  doc: string;
  field: string;
}

export interface Contradiction {
  id: string;
  class: ContradictionClass;
  title: string;
  a: Ref;
  b: Ref | null;
  /** Why it is classed this way: what matches and what differs. */
  reasoning: string;
  /** Nodes in the Decision Twin graph it bears on. */
  affects: string[];
  /** What a person has to do; nothing is resolved automatically. */
  humanAction: string;
}

export const CONTRADICTIONS: Contradiction[] = [
  {
    id: 'X-01',
    class: 'CONFIRMED_CONFLICT',
    title: 'Total debt at close',
    a: { doc: 'DOC-03', field: 'total_debt' },
    b: { doc: 'DOC-04', field: 'total_debt' },
    reasoning: 'Same measure, same date (at close), same stated basis (including leases and seller note), different amounts ($124.0M vs $118.0M). The $6.0M gap is unexplained.',
    affects: ['in.debt', 'm.leverage', 'm.stressLeverage', 'k.leverage', 'k.stress', 'k.debtReconciled'],
    humanAction: 'Reconcile the two figures before the committee relies on either. The calculations default to the higher, itemised figure.',
  },
  {
    id: 'X-02',
    class: 'POTENTIAL_CONFLICT',
    title: 'Top customer volumes',
    a: { doc: 'DOC-02', field: 'top_customer_volume_growth' },
    b: { doc: 'DOC-07', field: 'renewal_risk' },
    reasoning: 'The forecast assumes 15% volume growth from the top customer; the concentration report says that customer is considering dual-sourcing at its Q1 2027 renewal. Both can be true for FY2026, so this is a potential, not a confirmed, conflict.',
    affects: ['prem.P3', 'm.revenue', 'w.renewal'],
    humanAction: 'Ask management for evidence of the customer’s FY2026 orders; test the case with premise P3 rejected.',
  },
  {
    id: 'X-03',
    class: 'DIFFERENT_REPORTING_BASIS',
    title: 'EBITDA: $41.6M vs $46.8M',
    a: { doc: 'DOC-01', field: 'ebitda_fy2025' },
    b: { doc: 'DOC-04', field: 'adj_ebitda_ltm' },
    reasoning: 'Different period (FY2025 vs LTM to 30 June 2026) and different definition (reported vs adjusted with $3.2M add-backs). The figures measure different things, so the difference is not a contradiction. The independent note (DOC-09) agrees with the reported $41.6M.',
    affects: [],
    humanAction: 'None required for consistency. Which definition the covenant uses is a separate question (X-05).',
  },
  {
    id: 'X-04',
    class: 'MISSING_EVIDENCE',
    title: 'PP&E appraisal not provided',
    a: { doc: 'DOC-08', field: 'ppe_olv' },
    b: null,
    reasoning: 'The collateral summary cites appraisal A-2026-03 for the $52.0M orderly liquidation value, but the appraisal is not in the data room.',
    affects: ['k.collateral'],
    humanAction: 'Obtain the appraisal (committee question Q3).',
  },
  {
    id: 'X-05',
    class: 'UNRESOLVED_INTERPRETATION',
    title: 'Which EBITDA the leverage covenant uses',
    a: { doc: 'DOC-05', field: 'addback_cap' },
    b: { doc: 'DOC-06', field: 'addback_cap' },
    reasoning: 'Both documents set the same 3.50x ceiling, but the draft agreement adds back non-recurring charges without a cap while the term sheet caps them at 10% of EBITDA. Whether restructuring costs qualify is a drafting and legal question, not an arithmetic one.',
    affects: ['k.ebitdaDefinition'],
    humanAction: 'Counsel and the deal team agree the definition; the draft is conformed to the term sheet or the difference is approved.',
  },
];

/** A side of a comparison, with the field's value, period and basis, for side-by-side display. */
export function resolveRef(ref: Ref) {
  const doc = getDocument(ref.doc);
  const field = doc?.fields.find((f) => f.key === ref.field);
  if (!doc || !field) throw new Error(`Unknown reference ${ref.doc}.${ref.field}`);
  return { doc: doc.id, docTitle: doc.title, field: field.key, label: field.label, value: field.value, unit: field.unit ?? null, period: field.period ?? null, basis: field.basis ?? null };
}

export function contradictionsView() {
  return CONTRADICTIONS.map((c) => ({ ...c, conflict: isConflict(c.class), a: resolveRef(c.a), b: c.b ? resolveRef(c.b) : null }));
}

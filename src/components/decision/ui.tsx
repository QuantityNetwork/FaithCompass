import type { ReactNode } from 'react';
import type { ConditionStatus } from '@/lib/decision/engine';
import { CLASS_LABEL, type ContradictionClass } from '@/lib/decision/contradictions';

const CONDITION_STYLE: Record<ConditionStatus, string> = {
  MET: 'supported',
  NOT_MET: 'not_established',
  NEEDS_HUMAN_JUDGMENT: 'disputed_interpretation',
  EVIDENCE_MISSING: 'insufficient_evidence',
};
const CONDITION_LABEL: Record<ConditionStatus, string> = {
  MET: 'Met',
  NOT_MET: 'Not met',
  NEEDS_HUMAN_JUDGMENT: 'Needs human judgment',
  EVIDENCE_MISSING: 'Evidence missing',
};

export function ConditionChip({ status }: { status: ConditionStatus }) {
  return <span className={`am-out am-out--${CONDITION_STYLE[status]}`}>{CONDITION_LABEL[status]}</span>;
}

const CLASS_STYLE: Record<ContradictionClass, string> = {
  CONFIRMED_CONFLICT: 'not_established',
  POTENTIAL_CONFLICT: 'support_weakened',
  DIFFERENT_REPORTING_BASIS: 'partially_supported',
  MISSING_EVIDENCE: 'insufficient_evidence',
  UNRESOLVED_INTERPRETATION: 'disputed_interpretation',
};

export function ClassChip({ cls }: { cls: ContradictionClass }) {
  return <span className={`am-out am-out--${CLASS_STYLE[cls]}`}>{CLASS_LABEL[cls]}</span>;
}

export function SyntheticNotice({ children }: { children?: ReactNode }) {
  return (
    <div className="am-example dr-notice" role="note">
      <p>
        <span className="am-chip am-chip--example">Synthetic demonstration</span>{' '}
        The borrower, lender, documents and figures are fictional. No bank, fund or institution has reviewed, validated or
        used this. The calculations are deterministic rules, not AI, and not a credit model: no probability of default is
        estimated and nothing here is credit advice or an approval.
      </p>
      {children}
    </div>
  );
}

export function fmtValue(value: number | string, unit: string | null | undefined): string {
  if (typeof value === 'string') return value;
  if (unit === '$M') return `$${value.toFixed(1)}M`;
  if (unit === '%') return `${value}%`;
  if (unit === 'x') return `${value.toFixed(2)}x`;
  return String(value);
}

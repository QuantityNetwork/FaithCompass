/**
 * Status indicators of the v2 design system.
 *
 * Two vocabularies, never mixed:
 * - review / publication state of a record (master prompt §7.2), from the revision status;
 * - epistemic outcome of an argument under selected assumptions (§6.4), from src/lib/epistemic.ts.
 *
 * Every indicator carries a symbol and a text label, so state is never conveyed by colour alone.
 */
import { EPISTEMIC_META, type EpistemicStatus } from '@/lib/epistemic';
import { STATUS_META, type RevisionStatus } from '@/lib/record/taxonomy';

const REVIEW_CHIP: Record<RevisionStatus, { symbol: string; label: string }> = {
  draft: { symbol: '○', label: 'Draft' },
  provisional: { symbol: '◐', label: 'Provisional · awaiting editorial review' },
  published: { symbol: '●', label: 'Editor-verified' },
  externally_reviewed: { symbol: '◆', label: 'Externally reviewed' },
  withdrawn: { symbol: '✕', label: 'Withdrawn' },
};

export function reviewChipLabel(status: RevisionStatus): string {
  return REVIEW_CHIP[status].label;
}

/** The review state of one revision, as a chip. */
export function ReviewChip({ status, short = false }: { status: RevisionStatus; short?: boolean }) {
  const chip = REVIEW_CHIP[status];
  const label = short && status === 'provisional' ? 'Provisional' : chip.label;
  return (
    <span className={`am-chip am-chip--${status}`} title={STATUS_META[status].definition}>
      <i aria-hidden="true">{chip.symbol}</i>
      {label}
    </span>
  );
}

export const REVIEW_SEQUENCE = ['Draft', 'Source-validated', 'Editorially reviewed', 'Externally reviewed', 'Published'] as const;

/**
 * Where a revision stands in the §7.2 sequence. The record has no "source-validated" state yet,
 * so that step is shown as not recorded rather than assumed; a provisional revision is public
 * (and says so) without having passed editorial review.
 */
export function ReviewTrack({ status }: { status: RevisionStatus }) {
  const steps: Array<{ label: string; state: 'done' | 'current' | 'pending'; note: string }> = (() => {
    switch (status) {
      case 'published':
        return [
          { label: 'Draft', state: 'done', note: 'done' },
          { label: 'Source-validated', state: 'pending', note: 'not recorded' },
          { label: 'Editorially reviewed', state: 'done', note: 'done' },
          { label: 'Externally reviewed', state: 'pending', note: 'pending' },
          { label: 'Published', state: 'done', note: 'done' },
        ];
      case 'externally_reviewed':
        return [
          { label: 'Draft', state: 'done', note: 'done' },
          { label: 'Source-validated', state: 'pending', note: 'not recorded' },
          { label: 'Editorially reviewed', state: 'done', note: 'done' },
          { label: 'Externally reviewed', state: 'done', note: 'done' },
          { label: 'Published', state: 'done', note: 'done' },
        ];
      case 'provisional':
        return [
          { label: 'Draft', state: 'done', note: 'done' },
          { label: 'Source-validated', state: 'pending', note: 'not recorded' },
          { label: 'Editorially reviewed', state: 'pending', note: 'pending' },
          { label: 'Externally reviewed', state: 'pending', note: 'pending' },
          { label: 'Published', state: 'current', note: 'public as provisional' },
        ];
      default:
        return REVIEW_SEQUENCE.map((label, i) => ({
          label,
          state: i === 0 ? 'current' : 'pending',
          note: i === 0 ? (status === 'withdrawn' ? 'withdrawn' : 'current') : 'pending',
        }));
    }
  })();
  return (
    <ol className="am-track" aria-label="Publication state">
      {steps.map((s) => (
        <li key={s.label} className={s.state === 'done' ? 'is-done' : s.state === 'current' ? 'is-current' : undefined}>
          {s.label}
          {s.state === 'done' ? ' ✓' : ` · ${s.note}`}
        </li>
      ))}
    </ol>
  );
}

export type RecordFlag = 'disputed' | 'superseded' | 'withdrawn' | 'awaiting_correction';

const FLAG_META: Record<RecordFlag, { symbol: string; label: string; title: string }> = {
  disputed: { symbol: '⚑', label: 'Disputed', title: 'A tradition or reviewer records a dispute; the substance is shown with the record.' },
  superseded: { symbol: '↻', label: 'Superseded', title: 'A later revision replaces this one; it stays readable at its own address.' },
  withdrawn: { symbol: '✕', label: 'Withdrawn', title: 'Withdrawn from the record; kept readable with the reason.' },
  awaiting_correction: { symbol: '!', label: 'Awaiting correction', title: 'A documented objection or error report awaits an editorial disposition.' },
};

export function FlagChip({ flag }: { flag: RecordFlag }) {
  const f = FLAG_META[flag];
  return (
    <span className="am-chip am-chip--flag" title={f.title}>
      <i aria-hidden="true">{f.symbol}</i>
      {f.label}
    </span>
  );
}

const OUTCOME_SYMBOL: Record<EpistemicStatus, string> = {
  supported: '●',
  partially_supported: '◑',
  support_weakened: '◐',
  not_established: '○',
  insufficient_evidence: '?',
  disputed_interpretation: '⇄',
};

/** A §6.4 outcome, with its exact wording. */
export function OutcomeChip({ status, label }: { status: EpistemicStatus; label?: string }) {
  return (
    <span className={`am-out am-out--${status}`} title={EPISTEMIC_META[status].definition}>
      <i aria-hidden="true">{OUTCOME_SYMBOL[status]}</i>
      {label ?? EPISTEMIC_META[status].label}
    </span>
  );
}

/** Marks anything illustrative that is not from the record. */
export function ExampleChip() {
  return (
    <span className="am-chip am-chip--example" title="Illustrative only; not from the record">
      Example data
    </span>
  );
}

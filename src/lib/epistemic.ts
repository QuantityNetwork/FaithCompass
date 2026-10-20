/**
 * Epistemic status: the one public vocabulary for how well something is supported.
 *
 * Used by the dependency engine's display, by Evidence Intelligence for interpretive and
 * theological claims, and by the REST API and MCP server (`epistemic_status`). The wording is
 * fixed by the product language rules (master prompt §6.4), adopted 2026-10-20 with the owner's
 * sign-off:
 *
 *   - every status is relative to declared assumptions and the evidence on record, never a verdict
 *     on whether a tradition or a faith is true;
 *   - no tradition, position or conclusion is ever described as "broken";
 *   - no number is attached to an interpretive or theological judgement.
 *
 * Pure and dependency-free, so the browser bundle (Dependency Explorer) can import it.
 */

export const EPISTEMIC_STATUSES = [
  'supported',
  'partially_supported',
  'support_weakened',
  'not_established',
  'insufficient_evidence',
  'disputed_interpretation',
] as const;

export type EpistemicStatus = (typeof EPISTEMIC_STATUSES)[number];

export const EPISTEMIC_META: Record<EpistemicStatus, { label: string; definition: string }> = {
  supported: {
    label: 'Supported under selected assumptions',
    definition:
      'Given the assumptions in force and the evidence on record, the claim is supported. Change the assumptions and the result may change.',
  },
  partially_supported: {
    label: 'Partially supported',
    definition:
      'Some of what the claim needs is supported and some is not: for example, the text says it, but the argument that makes it a supported reading does not hold.',
  },
  support_weakened: {
    label: 'Support weakened',
    definition: 'The claim is still supported, but on fewer independent arguments or weaker evidence than before.',
  },
  not_established: {
    label: 'Not established under selected assumptions',
    definition:
      'Under the assumptions in force, no recorded argument establishes the claim. This is a statement about this argument as recorded, not about whether a tradition is right.',
  },
  insufficient_evidence: {
    label: 'Insufficient evidence',
    definition: 'The evidence on record is too thin to support or weaken the claim. Missing evidence is not evidence against it.',
  },
  disputed_interpretation: {
    label: 'Disputed interpretation',
    definition: 'Qualified scholars read the evidence in materially different ways, and the record does not settle between them.',
  },
};

export function epistemicLabel(s: EpistemicStatus): string {
  return EPISTEMIC_META[s].label;
}

import { PRIMARY_DIMENSION_META } from '@/lib/evidence/taxonomy';
import { epistemicFromScore } from '@/lib/evidence/format';
import { EPISTEMIC_META } from '@/lib/epistemic';
import type { PrimaryProfile } from '@/lib/evidence/schema';
import { ConfidenceFigure } from './primitives';

/**
 * The three headline dimensions.
 *
 * Always all three, always separately. A passage can be textually secure and
 * historically uncorroborated at once, and collapsing that into one figure
 * would hide the only thing worth knowing about it.
 */
export function EvidenceProfileGrid({
  profile,
  scope = 'claim',
  interpretiveClaim = false,
}: {
  profile: PrimaryProfile[];
  /** Whether this profile describes one claim or a whole analysis. */
  scope?: 'claim' | 'analysis';
  /** The claim is interpretive or theological: show no figures at all, only words. */
  interpretiveClaim?: boolean;
}) {
  return (
    <div className="profile">
      {profile.map((p) => {
        const meta = PRIMARY_DIMENSION_META[p.dimension];
        const scored = p.applicable && p.score !== null;
        // The interpretive dimension is always shown in words (§3.3, §6.4); on an interpretive claim,
        // the other dimensions keep their evidence-quality band but lose the figure.
        const status = scored && p.dimension === 'interpretive' ? epistemicFromScore(p.score) : null;
        const qualitative = status
          ? { label: EPISTEMIC_META[status].label }
          : scored && interpretiveClaim
            ? { label: p.confidenceLabel }
            : undefined;
        return (
          <div className="profile__cell" key={p.dimension}>
            <ConfidenceFigure
              qualitative={qualitative}
              score={p.applicable ? p.score : null}
              label={
                p.applicable && p.score !== null ? p.confidenceLabel : notApplicableLabel(p, scope)
              }
              caption={meta.label}
            />
            <p className="profile__note">{p.reasoningSummary}</p>
          </div>
        );
      })}
    </div>
  );
}

function notApplicableLabel(p: PrimaryProfile, scope: 'claim' | 'analysis'): string {
  if (!p.applicable) {
    return scope === 'analysis' ? 'Not applicable to this analysis' : 'Not applicable to this claim';
  }
  return 'Not separately assessed';
}

import { PRIMARY_DIMENSION_META } from '@/lib/evidence/taxonomy';
import type { PrimaryProfile } from '@/lib/evidence/schema';
import { ConfidenceFigure } from './primitives';

/**
 * The three headline dimensions.
 *
 * Always all three, always separately. A passage can be textually secure and
 * historically uncorroborated at once, and collapsing that into one figure
 * would hide the only thing worth knowing about it.
 */
export function EvidenceProfileGrid({ profile }: { profile: PrimaryProfile[] }) {
  return (
    <div className="profile">
      {profile.map((p) => {
        const meta = PRIMARY_DIMENSION_META[p.dimension];
        return (
          <div className="profile__cell" key={p.dimension}>
            <ConfidenceFigure
              score={p.applicable ? p.score : null}
              label={p.applicable && p.score !== null ? p.confidenceLabel : notApplicableLabel(p)}
              caption={meta.label}
            />
            <p className="profile__note">{p.reasoningSummary}</p>
          </div>
        );
      })}
    </div>
  );
}

function notApplicableLabel(p: PrimaryProfile): string {
  if (!p.applicable) return 'Not applicable to this claim';
  return 'Not separately assessed';
}

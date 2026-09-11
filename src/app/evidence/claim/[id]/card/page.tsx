import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ensureSeeded } from '@/lib/evidence/bootstrap';
import { getStore } from '@/lib/evidence/store';
import { Page } from '@/components/evidence/primitives';
import { certaintyLabel } from '@/lib/evidence/format';

export const dynamic = 'force-dynamic';

/**
 * Shareable Evidence Card.
 *
 * Deliberately austere. The card carries the claim, one figure, the reason and
 * the count of alternatives considered — enough to be worth sharing, not enough
 * to be mistaken for the assessment itself. It always links back to the
 * evidence, because a confidence figure travelling without its ledger is the
 * thing this product is trying to replace.
 */
export default async function CardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureSeeded();

  const found = await getStore().findClaim(id);
  if (!found) notFound();

  const { analysis, claimIndex } = found;
  const claim = analysis.claims[claimIndex];
  const alternatives =
    claim.interpretations.length || claim.whyThisScore.alternativeInterpretations.length;

  return (
    <Page narrow>
      <div className="share-card">
        <div className="wordmark" style={{ fontSize: 17 }}>
          AbrahamMoses
        </div>
        <div className="wordmark__rule">Evidence Intelligence</div>

        <div className="share-card__rule" />

        <p className="eyebrow eyebrow--muted" style={{ marginBottom: 8 }}>
          {analysis.title}
        </p>

        <p className="profile__label">Claim</p>
        <p style={{ fontSize: 21, lineHeight: 1.45, color: 'var(--ink-strong)', marginTop: 8 }}>
          “{claim.statement}”
        </p>

        <div className="share-card__rule" />

        {claim.overallConfidence === null ? (
          <>
            <p className="profile__label">Assessment</p>
            <p className="profile__band profile__band--na" style={{ marginTop: 12 }}>
              Not directly scorable under historical method
            </p>
            <p className="small muted" style={{ marginTop: 14 }}>
              This claim is not the kind of proposition historical or textual method can
              adjudicate. No numerical evidence confidence is issued.
            </p>
          </>
        ) : (
          <>
            <p className="profile__label">Evidence confidence</p>
            <p className="profile__band" style={{ marginTop: 12 }}>
              {claim.confidenceLabel} · {claim.overallConfidence}
            </p>
            <div className="meter" style={{ maxWidth: 240 }}>
              <div className="meter__fill" style={{ width: `${claim.overallConfidence}%` }} />
            </div>
            <p className="small faint" style={{ marginTop: 10 }}>
              {certaintyLabel(claim.certainty)}. An assessment of evidential support, not a
              probability that the claim is true.
            </p>
          </>
        )}

        <p className="profile__label" style={{ marginTop: 26 }}>
          Why
        </p>
        <p className="small" style={{ marginTop: 8 }}>
          {claim.whyThisScore.conclusion}
        </p>

        {alternatives > 0 ? (
          <p className="small faint" style={{ marginTop: 18 }}>
            {alternatives} alternative{alternatives === 1 ? '' : 's'} considered.
          </p>
        ) : null}

        <div className="share-card__rule" />

        <Link className="button" href={`/evidence/claim/${claim.id}`}>
          View evidence →
        </Link>
      </div>
    </Page>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ensureSeeded } from '@/lib/evidence/bootstrap';
import { getStore } from '@/lib/evidence/store';
import { Page, SectionTitle, Tag } from '@/components/evidence/primitives';
import { ClaimDetail } from '@/components/evidence/claim-detail';
import { ChallengePanel } from '@/components/evidence/challenge-panel';
import { claimTypeLabel, ordinal } from '@/lib/evidence/format';

export const dynamic = 'force-dynamic';

export default async function ClaimPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureSeeded();

  const store = getStore();
  const found = await store.findClaim(id);
  if (!found) notFound();

  const { analysis, claimIndex } = found;
  const claim = analysis.claims[claimIndex];
  const challenges = await store.listChallenges(id);

  return (
    <Page>
      <p className="eyebrow">
        <Link href={`/evidence/${analysis.resourceId}`}>{analysis.title}</Link> · Claim{' '}
        {ordinal(claim.ordinal)}
      </p>
      <h1 className="display" style={{ fontSize: 'clamp(28px, 4vw, 42px)' }}>
        {claim.statement}
      </h1>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 22 }}>
        <Tag variant="tag--type">{claimTypeLabel(claim.claimType)}</Tag>
        <Tag>{claim.scope}</Tag>
        {claim.positionNote ? <Tag variant="tag--minority">{claim.positionNote}</Tag> : null}
      </div>

      <p className="prose" style={{ marginTop: 28 }}>
        {claim.summary}
      </p>

      <div style={{ marginTop: 48 }}>
        <ClaimDetail analysis={analysis} claim={claim} />
      </div>

      <div style={{ marginTop: 40 }}>
        <SectionTitle>Challenge</SectionTitle>
        <ChallengePanel claimId={claim.id} history={challenges} />
      </div>

      <div style={{ marginTop: 32, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link className="button button--quiet" href={`/evidence/claim/${claim.id}/card`}>
          Evidence Card
        </Link>
        <Link
          className="button button--quiet"
          href={`/evidence/analysis/${analysis.id}/sources`}
        >
          Source Ledger
        </Link>
        <Link className="button button--quiet" href={`/evidence/${analysis.resourceId}`}>
          Back to {analysis.title}
        </Link>
      </div>
    </Page>
  );
}

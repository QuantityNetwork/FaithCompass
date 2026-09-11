import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ensureSeeded } from '@/lib/evidence/bootstrap';
import { getStore } from '@/lib/evidence/store';
import { Page, SectionTitle } from '@/components/evidence/primitives';
import { SourceLedgerTable } from '@/components/evidence/evidence-ledger';
import { SOURCE_TIERS, SOURCE_TIER_META } from '@/lib/evidence/taxonomy';

export const dynamic = 'force-dynamic';

export default async function SourcesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureSeeded();

  const analysis = await getStore().getAnalysis(id);
  if (!analysis) notFound();

  const unverified = analysis.sources.filter((s) => s.verified === 'UNVERIFIED');

  return (
    <Page>
      <p className="eyebrow">
        <Link href={`/evidence/${analysis.resourceId}`}>{analysis.title}</Link>
      </p>
      <h1 className="display" style={{ fontSize: 'clamp(30px, 4.5vw, 46px)' }}>
        Source Ledger
      </h1>
      <p className="standfirst">
        Every source cited in this analysis, with its class, standpoint, reliability assessment and
        verification state.
      </p>

      {unverified.length > 0 ? (
        <div className="notice notice--caution">
          <div className="tiny" style={{ color: 'var(--ink-muted)', marginBottom: 10 }}>
            Verification
          </div>
          <p className="small" style={{ margin: 0 }}>
            {unverified.length} source{unverified.length === 1 ? '' : 's'} in this analysis could
            not be independently verified and {unverified.length === 1 ? 'is' : 'are'} marked as
            such below. Unverified sources are never displayed as authoritative citations.
          </p>
        </div>
      ) : null}

      {SOURCE_TIERS.map((tier) => {
        const tierSources = analysis.sources.filter((s) => s.qualityTier === tier);
        if (tierSources.length === 0) return null;
        return (
          <section key={tier} style={{ marginTop: 52 }}>
            <SectionTitle>{SOURCE_TIER_META[tier].label}</SectionTitle>
            <p className="small muted" style={{ maxWidth: '68ch', marginTop: -8 }}>
              {SOURCE_TIER_META[tier].description}
            </p>
            <div style={{ marginTop: 20 }}>
              <SourceLedgerTable sources={tierSources} />
            </div>
          </section>
        );
      })}

      <div className="notice" style={{ marginTop: 56 }}>
        <p className="small" style={{ margin: 0, maxWidth: '70ch' }}>
          Source class affects weighting; standpoint does not. A Latter-day Saint, Evangelical,
          Jewish or Catholic source is weighted by its class like any other. Perspective is
          recorded so a reader can see the shape of the evidence base, not so the engine can
          discount a tradition.
        </p>
      </div>

      <div style={{ marginTop: 32 }}>
        <Link className="button button--quiet" href={`/evidence/${analysis.resourceId}`}>
          Back to {analysis.title}
        </Link>
      </div>
    </Page>
  );
}

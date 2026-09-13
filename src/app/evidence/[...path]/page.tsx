import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ensureSeeded } from '@/lib/evidence/bootstrap';
import { getStore } from '@/lib/evidence/store';
import { Page, SectionTitle } from '@/components/evidence/primitives';
import { EvidenceProfileGrid } from '@/components/evidence/evidence-profile';
import { ClaimRow } from '@/components/evidence/claim-detail';
import { AskPanel } from '@/components/evidence/ask-panel';
import type { PrimaryProfile } from '@/lib/evidence/schema';
import { PRIMARY_DIMENSIONS, PRIMARY_DIMENSION_META, confidenceLabelFor } from '@/lib/evidence/taxonomy';

export const dynamic = 'force-dynamic';

/**
 * Passage view — /evidence/daniel/12/1.
 *
 * Static sibling segments (claim, analysis, method) take routing priority over
 * this catch-all, so those paths never reach here.
 */
export default async function PassageView({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path } = await params;
  await ensureSeeded();

  const slug = path.join('/');
  const analysis = await getStore().getAnalysisBySlug(slug);
  if (!analysis) notFound();

  const profile = passageProfile(analysis.claims.flatMap((c) => c.primaryProfile));

  return (
    <Page>
      <p className="eyebrow">Evidence Intelligence</p>
      <h1 className="display">{analysis.title}</h1>
      {analysis.subtitle ? <p className="standfirst">“{analysis.subtitle}”</p> : null}

      {analysis.passageText ? (
        <blockquote className="passage">
          {analysis.passageText}
          {analysis.passageAttribution ? (
            <cite className="passage__attribution">{analysis.passageAttribution}</cite>
          ) : null}
        </blockquote>
      ) : null}

      <p className="prose muted" style={{ marginTop: 32 }}>
        {analysis.summary}
      </p>

      <div style={{ marginTop: 52 }}>
        <SectionTitle>Evidence Profile</SectionTitle>
        <EvidenceProfileGrid profile={profile} scope="analysis" />
        <p className="small faint" style={{ marginTop: 14, maxWidth: '68ch' }}>
          Each figure is the strongest evidenced assessment across the claims below. They are shown
          separately and never combined: a passage can be textually secure and historically
          uncorroborated at the same time, and a single number would hide exactly that.
        </p>
      </div>

      <div style={{ marginTop: 56 }}>
        <SectionTitle>Key claims</SectionTitle>
        <div className="claim-list">
          {analysis.claims.map((claim) => (
            <ClaimRow key={claim.id} analysis={analysis} claim={claim} />
          ))}
        </div>
      </div>

      <div style={{ marginTop: 40, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link className="button" href={`/evidence/analysis/${analysis.id}/sources`}>
          Source Ledger · {analysis.sources.length}
        </Link>
      </div>

      <div style={{ marginTop: 64 }}>
        <SectionTitle>Ask</SectionTitle>
        <AskPanel defaultQuery={`Which part of the ${analysis.title} assessment is weakest?`} />
      </div>
    </Page>
  );
}

/**
 * Roll the claims' primary dimensions up to the passage.
 *
 * The best *evidenced* assessment on each axis, not an average. A passage's
 * textual confidence is established by the claim that actually examined the
 * manuscripts; averaging it against claims that cited no textual evidence would
 * understate what the manuscript record shows.
 */
function passageProfile(all: PrimaryProfile[]): PrimaryProfile[] {
  return PRIMARY_DIMENSIONS.map((dimension) => {
    const candidates = all.filter(
      (p) => p.dimension === dimension && p.applicable && p.score !== null,
    );
    if (candidates.length === 0) {
      const anyApplicable = all.some((p) => p.dimension === dimension && p.applicable);
      return {
        dimension,
        score: null,
        confidenceLabel: anyApplicable ? 'NOT ASSESSED' : 'NOT DIRECTLY SCORABLE',
        applicable: anyApplicable,
        reasoningSummary: anyApplicable
          ? `No claim in this analysis cited evidence bearing on ${PRIMARY_DIMENSION_META[dimension].label.toLowerCase()}.`
          : `${PRIMARY_DIMENSION_META[dimension].label} cannot bear on the claims in this analysis.`,
      };
    }
    const best = candidates.reduce((a, b) => ((b.score ?? 0) > (a.score ?? 0) ? b : a));
    return {
      ...best,
      confidenceLabel: confidenceLabelFor(best.score!),
    };
  });
}

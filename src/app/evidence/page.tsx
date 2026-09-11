import Link from 'next/link';
import { ensureSeeded } from '@/lib/evidence/bootstrap';
import { getStore } from '@/lib/evidence/store';
import { Page, SectionTitle, Tag } from '@/components/evidence/primitives';
import { AskPanel } from '@/components/evidence/ask-panel';
import { claimTypeLabel } from '@/lib/evidence/format';

export const dynamic = 'force-dynamic';

export default async function EvidenceHome() {
  await ensureSeeded();
  const analyses = await getStore().listAnalyses();

  return (
    <Page>
      <p className="eyebrow">Evidence Intelligence</p>
      <h1 className="display">How do we know this?</h1>
      <p className="standfirst">
        And how certain should we actually be? AbrahamMoses assesses specific claims against
        specific evidence — manuscripts, inscriptions, excavation, language, reception — and shows
        the working.
      </p>

      <div className="notice" style={{ marginTop: 44 }}>
        <p className="small" style={{ margin: 0, maxWidth: '70ch' }}>
          AbrahamMoses does not score religions. A tradition is not the kind of object evidence
          bears on; it contains thousands of distinct textual, historical, archaeological,
          interpretive and metaphysical claims, supported to very different degrees. Those claims
          are assessed one at a time, and claims that historical method cannot reach are marked as
          such rather than given a number.
        </p>
      </div>

      <div style={{ marginTop: 64 }}>
        <SectionTitle>Analyses</SectionTitle>
        <div className="index-grid">
          {analyses.map((a) => {
            const scored = a.claims.filter((c) => c.overallConfidence !== null);
            const unscorable = a.claims.length - scored.length;
            const types = [...new Set(a.claims.map((c) => c.claimType))];
            return (
              <Link className="index-card" key={a.id} href={`/evidence/${a.resourceId}`}>
                <span className="eyebrow eyebrow--muted">
                  {a.resourceType.replace(/_/g, ' ')}
                </span>
                <h3 className="index-card__title">{a.title}</h3>
                {a.subtitle ? <p className="index-card__sub">{a.subtitle}</p> : null}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 18 }}>
                  {types.slice(0, 4).map((t) => (
                    <Tag key={t}>{claimTypeLabel(t)}</Tag>
                  ))}
                </div>
                <div className="index-card__stats">
                  <span>{a.claims.length} claims</span>
                  <span>{a.sources.length} sources</span>
                  {unscorable > 0 ? <span>{unscorable} not scorable</span> : null}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 64 }}>
        <SectionTitle>Ask</SectionTitle>
        <AskPanel />
      </div>
    </Page>
  );
}

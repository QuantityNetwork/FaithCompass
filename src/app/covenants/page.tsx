import type { Metadata } from 'next';
import Link from 'next/link';
import { CodeLink, PageIntro, Refs, Section, StatusPill } from '@/components/record/ui';
import { covenantView } from '@/lib/api/views';
import { getRecord } from '@/lib/record/record';
import { FAMILY_META, TRADITION_FAMILIES, type TraditionFamily } from '@/lib/record/taxonomy';
import { param, type SearchParams } from '@/lib/site/explorer';

export const metadata: Metadata = {
  title: 'Covenant Map',
  description:
    'Where a passage sits in the larger story — read four ways. Covenant relationships attributed to Jewish, Christian, Islamic and Latter-day Saint readings, with evidence and grounding claims.',
  alternates: { canonical: '/covenants' },
};

type Props = { searchParams: Promise<SearchParams> };
const READINGS = TRADITION_FAMILIES.filter((f) => f !== 'scholarly') as TraditionFamily[];

export default async function CovenantMap({ searchParams }: Props) {
  const sp = await searchParams;
  const record = getRecord();
  const selected = READINGS.find((f) => f === param(sp, 'reading')) ?? null;
  const nodeLabel = (id: string) => record.data.covenantNodes.find((n) => n.id === id)!.label;
  const order = (id: string) => record.data.covenantNodes.find((n) => n.id === id)!.order;
  const shared = (id: string) => record.data.covenantNodes.find((n) => n.id === id)!.families.length > 1;
  const lanes = (selected ? [selected] : READINGS).map((family) => ({
    family,
    edges: record.data.covenants
      .filter((e) => e.readings.includes(family))
      .sort((a, b) => order(a.source) - order(b.source) || order(a.target) - order(b.target)),
  }));
  const edges = record.data.covenants.filter((e) => !selected || e.readings.includes(selected)).map((e) => covenantView(record, e.code));

  return (
    <main id="main" className="shell page">
      <PageIntro
        eyebrow="Covenant Map"
        title="Where a passage sits in the larger story"
        lede="Each tradition tells covenantal history differently. The map keeps the readings side by side, sharing the covenants they share, and attributes every relationship to the readings it belongs to."
      />

      <nav className="lane-legend" aria-label="Choose a reading">
        <Link className="filter-link" href="/covenants" aria-current={!selected ? 'true' : undefined}>
          All readings
        </Link>
        {READINGS.map((f) => (
          <Link key={f} className="filter-link" href={`/covenants?reading=${f}`} aria-current={selected === f ? 'true' : undefined}>
            {FAMILY_META[f].label}
          </Link>
        ))}
      </nav>

      <div className="grid-2" style={{ marginTop: 18 }}>
        {lanes.map(({ family, edges }) => (
          <section key={family} className="card" aria-labelledby={`lane-${family}`}>
            <h2 id={`lane-${family}`} className="subheading">
              {FAMILY_META[family].label} reading
            </h2>
            <ol className="chain">
              {edges.map((e) => (
                <li key={e.code}>
                  <div className="chain__label">
                    {nodeLabel(e.source)} → {nodeLabel(e.target)}
                    {shared(e.target) ? ' · shared covenant' : ''}
                  </div>
                  <div className="chain__detail">
                    <a className="link" href={`#${e.code}`}>
                      {e.relationshipType}
                    </a>
                    : {e.description}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>

      <Section id="relationships" title="Relationships" eyebrow={`${edges.length} recorded`}>
        <div className="stack">
          {edges.map((e) => (
            <article key={e.code} id={e.code} className="card">
              <div className="claim-card__head">
                <span className="code-inline">{e.code}</span>
                <span>{e.confidence}</span>
                <span>{e.readings.map((r) => FAMILY_META[r as TraditionFamily].label).join(', ')}</span>
                <StatusPill status={e.status} />
              </div>
              <h3 className="card__title">
                {e.source_label} → {e.target_label} <span className="faint small">· {e.relationship_type}</span>
              </h3>
              <p style={{ margin: '4px 0' }}>{e.description}</p>
              <p className="small faint" style={{ margin: 0 }}>
                Evidence: <Refs refs={e.evidence} />
              </p>
              <p className="small" style={{ margin: '6px 0 0' }}>
                {e.grounded_by.length ? (
                  <>
                    Grounded by{' '}
                    {e.grounded_by.map((c, i) => (
                      <span key={c}>
                        {i ? ', ' : ''}
                        <CodeLink code={c} />
                      </span>
                    ))}
                  </>
                ) : (
                  <span className="faint">No grounding claim recorded yet.</span>
                )}
                {e.illustrated_by.length ? (
                  <>
                    {' '}
                    · illustrated by{' '}
                    {e.illustrated_by.map((c, i) => (
                      <span key={c}>
                        {i ? ', ' : ''}
                        <CodeLink code={c} />
                      </span>
                    ))}
                  </>
                ) : null}
              </p>
            </article>
          ))}
        </div>
      </Section>
      <p className="small faint">
        The map does not force contested theology into one storyline: where readings diverge, each is shown and attributed.{' '}
        <a className="link" href="/api/v1/covenants">
          JSON
        </a>
      </p>
    </main>
  );
}

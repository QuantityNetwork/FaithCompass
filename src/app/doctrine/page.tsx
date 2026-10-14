import type { Metadata } from 'next';
import Link from 'next/link';
import { CodeLink, PageIntro, Refs, Section, StatusPill } from '@/components/record/ui';
import { doctrineView } from '@/lib/api/views';
import { DOCTRINE_START_NODE } from '@/lib/record/data/maps';
import { getRecord } from '@/lib/record/record';
import { FAMILY_META, type TraditionFamily } from '@/lib/record/taxonomy';
import { param, type SearchParams } from '@/lib/site/explorer';

export const metadata: Metadata = {
  title: 'Doctrine Graph',
  description:
    'Doctrine is a network, not a list. Start from Abraham — the figure every tradition in the record shares — and follow connections with evidence on every edge.',
  alternates: { canonical: '/doctrine' },
};

type Props = { searchParams: Promise<SearchParams> };

const SIZE = 640;
const C = SIZE / 2;

export default async function DoctrineGraph({ searchParams }: Props) {
  const sp = await searchParams;
  const record = getRecord();
  const nodes = record.data.doctrineNodes;
  const focus = nodes.find((n) => n.id === param(sp, 'node')) ?? nodes.find((n) => n.id === DOCTRINE_START_NODE)!;
  const edges = record.data.doctrine.filter((e) => e.source === focus.id || e.target === focus.id);
  const neighbours = edges.map((e) => {
    const other = e.source === focus.id ? e.target : e.source;
    return { edge: e, node: nodes.find((n) => n.id === other)!, outgoing: e.source === focus.id };
  });
  const R = SIZE / 2 - 92;
  const placed = neighbours.map((n, i) => {
    const angle = (2 * Math.PI * i) / Math.max(neighbours.length, 1) - Math.PI / 2;
    return { ...n, x: C + R * Math.cos(angle), y: C + R * Math.sin(angle) };
  });
  const degree = (id: string) => record.data.doctrine.filter((e) => e.source === id || e.target === id).length;

  return (
    <main id="main" className="shell page">
      <PageIntro
        eyebrow="Doctrine Graph"
        title="Doctrine is a network, not a list"
        lede={
          <>
            The graph has no fixed centre. It opens on Abraham — the one figure every tradition in the record shares — and you
            can start from any node. Every edge carries its evidence, its classification and how each tradition stands on it.
          </>
        }
      />

      <div className="grid-2 section--tight" style={{ alignItems: 'start' }}>
        <div className="graph-wrap">
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="group" aria-label={`Connections of ${focus.label}`} style={{ display: 'block', width: '100%', height: 'auto' }}>
            {placed.map((p) => (
              <line key={p.edge.code} x1={C} y1={C} x2={p.x} y2={p.y} strokeWidth={1.2} strokeDasharray={p.edge.classification === 'Interpretive connection' ? '5 4' : undefined} style={{ stroke: 'var(--gold-dim)' }} />
            ))}
            <circle cx={C} cy={C} r={64} strokeWidth={2} style={{ fill: 'var(--ground-raised)', stroke: 'var(--gold)' }} />
            <text x={C} y={C - 4} textAnchor="middle" fontSize="17" style={{ fill: 'var(--ink-strong)', fontFamily: 'var(--serif)' }}>
              {focus.label}
            </text>
            {focus.aka.length ? (
              <text x={C} y={C + 16} textAnchor="middle" fontSize="11.5" style={{ fill: 'var(--ink-muted)', fontFamily: 'var(--sans)' }}>
                {focus.aka.join(' · ')}
              </text>
            ) : null}
            {placed.map((p) => (
              <a key={p.node.id} href={`/doctrine?node=${p.node.id}`} aria-label={`${p.node.label}: ${p.edge.relationshipType}. Open its connections`}>
                <circle cx={p.x} cy={p.y} r={44} strokeWidth={1.2} style={{ fill: 'var(--ground-raised)', stroke: 'var(--rule-strong)' }} />
                <text x={p.x} y={p.y - 2} textAnchor="middle" fontSize="12.5" style={{ fill: 'var(--ink)', fontFamily: 'var(--serif)' }}>
                  {p.node.label.length > 18 ? `${p.node.label.slice(0, 17)}…` : p.node.label}
                </text>
                <text x={p.x} y={p.y + 14} textAnchor="middle" fontSize="9.5" style={{ fill: 'var(--gold)', fontFamily: 'var(--sans)' }}>
                  {p.edge.relationshipType.length > 20 ? `${p.edge.relationshipType.slice(0, 19)}…` : p.edge.relationshipType}
                </text>
              </a>
            ))}
          </svg>
        </div>
        <div>
          <h2 className="subheading">Start anywhere</h2>
          <p className="small muted" style={{ marginTop: 0 }}>
            Nodes, with the traditions whose texts speak of them and their number of connections.
          </p>
          <div className="node-index">
            {nodes
              .filter((n) => degree(n.id) > 0)
              .map((n) => (
                <Link
                  key={n.id}
                  className="filter-link"
                  href={`/doctrine?node=${n.id}`}
                  aria-current={n.id === focus.id ? 'true' : undefined}
                  title={n.families.map((f) => FAMILY_META[f as TraditionFamily].label).join(', ')}
                >
                  {n.label} · {degree(n.id)}
                </Link>
              ))}
          </div>
        </div>
      </div>

      <Section id="edges" title={`Connections of ${focus.label}`} eyebrow={`${edges.length} edges`}>
        <div className="stack">
          {edges
            .map((e) => doctrineView(record, e.code))
            .map((e) => (
              <article key={e.code} id={e.code} className="card">
                <div className="claim-card__head">
                  <span className="code-inline">{e.code}</span>
                  <span>{e.classification}</span>
                  <span>{e.confidence}</span>
                  <span>{e.topic}</span>
                  <StatusPill status={e.status} />
                </div>
                <h3 className="card__title">
                  {e.source_label} ↔ {e.target_label} <span className="faint small">· {e.relationship_type}</span>
                </h3>
                <p style={{ margin: '4px 0' }}>{e.description}</p>
                <p className="small muted" style={{ margin: '4px 0' }}>
                  Tradition status: {e.tradition_status}
                </p>
                <p className="small faint" style={{ margin: 0 }}>
                  Evidence: <Refs refs={e.evidence} />
                  {e.grounded_by.length ? (
                    <>
                      {' '}
                      · grounded by{' '}
                      {e.grounded_by.map((c, i) => (
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
        Every edge has evidence; affirmation and dispute are attributed separately.{' '}
        <a className="link" href={`/api/v1/doctrine?node=${focus.id}`}>
          JSON
        </a>
      </p>
    </main>
  );
}

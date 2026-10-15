import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CodeLink, PageIntro, Section } from '@/components/record/ui';
import { traditionView } from '@/lib/api/views';
import { STATUS_LABELS, lensAxioms, simulate } from '@/lib/record/engine';
import { getRecord } from '@/lib/record/record';
import { AXIOM_STANCE_META, CASE_RESPONSE_META, FAMILY_META, type AxiomStance } from '@/lib/record/taxonomy';

type Props = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return getRecord().data.traditions.map((t) => ({ id: t.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const t = getRecord().tradition(id);
  if (!t) return {};
  return { title: t.name, description: t.description, alternates: { canonical: `/traditions/${t.id}` } };
}

export default async function TraditionPage({ params }: Props) {
  const { id } = await params;
  const record = getRecord();
  const t = record.tradition(id);
  if (!t) notFound();
  const view = traditionView(record, id);
  const graph = record.graph();
  const removed = lensAxioms(graph, id);
  const result = simulate(graph, { lens: id });
  const positions = record.data.cases.flatMap((rc) => rc.positions.map((p) => ({ rc, p })));
  const responses = record.data.cases.flatMap((rc) => rc.responses.filter((r) => r.tradition === id).map((r) => ({ rc, r })));

  return (
    <main id="main" className="shell page">
      <PageIntro eyebrow={`Tradition Layer · ${FAMILY_META[t.family].label}`} title={t.name} lede={t.description} />

      <div className="grid-2 section--tight">
        <div className="card">
          <div className="card__meta">Authorities</div>
          <p style={{ margin: '6px 0 0' }}>{t.authorities}</p>
        </div>
        <div className="card">
          <div className="card__meta">Its own categories</div>
          <p style={{ margin: '6px 0 0' }}>{t.nativeCategories.join(' · ')}</p>
        </div>
      </div>

      <Section id="stances" title="Reading principles" eyebrow="Recorded stances">
        {view.axiom_stances.length === 0 ? (
          <p className="muted">No stance recorded.</p>
        ) : (
          <div className="table-wrap">
            <table className="table table--stack">
              <thead>
                <tr>
                  <th scope="col">Principle</th>
                  <th scope="col">Stance</th>
                  <th scope="col">Note</th>
                </tr>
              </thead>
              <tbody>
                {view.axiom_stances.map((s) => (
                  <tr key={s.axiom}>
                    <td data-label="Principle">
                      <CodeLink code={s.axiom} /> {s.label}
                    </td>
                    <td data-label="Stance">{AXIOM_STANCE_META[s.stance as AxiomStance].label}</td>
                    <td data-label="Note">{s.note ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section id="lens" title="Reading the record through this lens" eyebrow="Simulation">
        <p className="lede" style={{ marginTop: 0 }}>
          The lens removes the {removed.length} principle{removed.length === 1 ? '' : 's'} this tradition rejects or sets aside
          {removed.length ? ` (${removed.join(', ')})` : ''}. Principles it does not address stay in place. Of the record’s
          positions:
        </p>
        <div className="table-wrap">
          <table className="table table--stack">
            <thead>
              <tr>
                <th scope="col">Case</th>
                <th scope="col">Position</th>
                <th scope="col">Under this lens</th>
              </tr>
            </thead>
            <tbody>
              {positions.map(({ rc, p }) => (
                <tr key={`${rc.slug}-${p.claim}`}>
                  <td data-label="Case">{rc.title}</td>
                  <td data-label="Position">
                    <CodeLink code={p.claim} /> {p.label}
                  </td>
                  <td data-label="Under this lens">
                    <span className={`status status--${result.statuses[p.claim]}`}>{STATUS_LABELS[result.statuses[p.claim]]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small faint">
          A lens is a simulation, not a statement of what the tradition believes about every claim; its recorded answers are
          below.{' '}
          <Link className="link" href={`/hermeneutics?lens=${id}#explorer`}>
            Open in the explorer
          </Link>
        </p>
      </Section>

      <Section id="responses" title="Its answers to the research cases">
        <div className="stack">
          {responses.length === 0 ? (
            <p className="muted">No response recorded yet.</p>
          ) : (
            responses.map(({ rc, r }) => (
              <article className="card" key={rc.slug}>
                <div className="claim-card__head">
                  <span>{rc.title}</span>
                  <span className="pill">{CASE_RESPONSE_META[r.response].label}</span>
                </div>
                <p style={{ margin: '8px 0 0' }}>{r.summary}</p>
                <p className="small faint" style={{ margin: '6px 0 0' }}>
                  <Link className="link" href={`/research/${rc.slug}`}>
                    Open the case
                  </Link>
                </p>
              </article>
            ))
          )}
        </div>
      </Section>
    </main>
  );
}

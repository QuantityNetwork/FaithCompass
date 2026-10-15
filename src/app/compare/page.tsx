import type { Metadata } from 'next';
import Link from 'next/link';
import { CodeLink, PageIntro } from '@/components/record/ui';
import { compareTraditions } from '@/lib/api/operations';
import { STATUS_LABELS, type ClaimStatus } from '@/lib/record/engine';
import { getRecord } from '@/lib/record/record';
import { CASE_RESPONSE_META, type CaseResponse } from '@/lib/record/taxonomy';
import { param, type SearchParams } from '@/lib/site/explorer';

export const metadata: Metadata = {
  title: 'Tradition Comparator',
  description:
    'Side-by-side answers of each tradition to a research question, the reading principles each rests on, and explicit non-comparability where traditions ask different questions.',
  alternates: { canonical: '/compare' },
};

type Props = { searchParams: Promise<SearchParams> };

export default async function ComparePage({ searchParams }: Props) {
  const sp = await searchParams;
  const record = getRecord();
  const rc = record.researchCase(param(sp, 'case') ?? '') ?? record.data.cases[0];
  const cmp = compareTraditions(record, rc.slug);

  return (
    <main id="main" className="shell page">
      <PageIntro
        eyebrow="Tradition Comparator"
        title={cmp.question}
        lede="Each row is one tradition: its answer in its own categories, the reading principles its lens removes, and which of the case’s positions still stand when the record is read through that lens."
      />
      <nav className="lane-legend" aria-label="Choose a research case">
        {record.data.cases.map((c) => (
          <Link key={c.slug} className="filter-link" href={`/compare?case=${c.slug}`} aria-current={c.slug === rc.slug ? 'true' : undefined}>
            {c.title}
          </Link>
        ))}
      </nav>
      <p className="status-notice" role="note">
        <strong>Not every row answers the same question.</strong> {cmp.notice}
      </p>

      <div className="table-wrap" style={{ marginTop: 18 }}>
        <table className="table table--stack">
          <thead>
            <tr>
              <th scope="col">Tradition</th>
              <th scope="col">Answer</th>
              <th scope="col">Lens removes</th>
              {rc.positions.map((p) => (
                <th scope="col" key={p.claim}>
                  {p.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cmp.rows.map((row) => (
              <tr key={row.tradition}>
                <td data-label="Tradition">
                  <Link className="link" href={`/traditions/${row.tradition}`}>
                    {row.tradition_name}
                  </Link>
                </td>
                <td data-label="Answer">
                  <span className="pill">{CASE_RESPONSE_META[row.response as CaseResponse].label}</span>
                  <p style={{ margin: '8px 0 4px' }}>{row.summary}</p>
                  <p className="faint" style={{ margin: 0 }}>
                    {row.categories.join(' · ')}
                  </p>
                  {row.position ? (
                    <p style={{ margin: '6px 0 0' }}>
                      Position: <CodeLink code={row.position} />
                    </p>
                  ) : null}
                </td>
                <td data-label="Lens removes">{row.lens_rejects.length ? row.lens_rejects.join(', ') : '—'}</td>
                {row.positions_under_lens.map((p) => (
                  <td key={p.claim} data-label={rc.positions.find((x) => x.claim === p.claim)!.label}>
                    <span className={`status status--${p.status}`}>{STATUS_LABELS[p.status as ClaimStatus]}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small faint" style={{ marginTop: 16 }}>
        <Link className="link" href={`/research/${rc.slug}`}>
          Open the case
        </Link>{' '}
        ·{' '}
        <a className="link" href={`/api/v1/cases/${rc.slug}/compare`}>
          JSON
        </a>{' '}
        · MCP tool <code className="code-inline">compare_traditions</code>
      </p>
    </main>
  );
}

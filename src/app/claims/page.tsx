import type { Metadata } from 'next';
import { ClaimCard, JsonLd, PageIntro } from '@/components/record/ui';
import { ClaimFilters, listClaims } from '@/lib/api/operations';
import { getRecord } from '@/lib/record/record';
import { CLAIM_CLASSIFICATIONS, CLASSIFICATION_META, REVIEW_STATE_LABELS, STATUS_META, type RevisionStatus } from '@/lib/record/taxonomy';
import { absoluteUrl } from '@/lib/site/config';
import { param, type SearchParams } from '@/lib/site/explorer';

export const metadata: Metadata = {
  title: 'Claim Ledger',
  description:
    'Every claim in the AbrahamMoses record: what the text says, what is disputed, how the finding was derived, with stable codes and revision histories.',
  alternates: { canonical: '/claims' },
};

type Props = { searchParams: Promise<SearchParams> };

export default async function ClaimLedger({ searchParams }: Props) {
  const sp = await searchParams;
  const record = getRecord();
  const filters = ClaimFilters.safeParse({
    topic: param(sp, 'topic') || undefined,
    classification: param(sp, 'classification') || undefined,
    case: param(sp, 'case') || undefined,
    tradition: param(sp, 'tradition') || undefined,
    status: param(sp, 'status') || undefined,
    limit: 200,
  });
  const f = filters.success ? filters.data : ClaimFilters.parse({ limit: 200 });
  const result = listClaims(record, f);
  const topics = [...new Set(record.data.claims.map((c) => c.topic))].sort();
  const active = Boolean(f.topic || f.classification || f.case || f.tradition || f.status);

  return (
    <main id="main" className="shell page">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Dataset',
          name: 'AbrahamMoses Claim Ledger',
          description: 'Revisioned theological claims with sources, editions, confidence axes, attribution and provenance.',
          url: absoluteUrl('/claims'),
          version: record.version,
          distribution: [{ '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: absoluteUrl('/api/v1/export') }],
        }}
      />
      <PageIntro
        eyebrow="Public record"
        title="Claim Ledger"
        lede="Each entry states what a text says or what a tradition holds, what is disputed, and how the finding was derived. Open a claim for its witnesses, editions, confidence axes, revisions and provenance."
      />

      <form className="filters" method="get" action="/claims" aria-label="Filter claims">
        <div>
          <label htmlFor="f-topic">Topic</label>
          <select id="f-topic" name="topic" defaultValue={f.topic ?? ''}>
            <option value="">All topics</option>
            {topics.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-class">Classification</label>
          <select id="f-class" name="classification" defaultValue={f.classification ?? ''}>
            <option value="">All classifications</option>
            {CLAIM_CLASSIFICATIONS.map((c) => (
              <option key={c} value={c}>
                {CLASSIFICATION_META[c].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-case">Research case</label>
          <select id="f-case" name="case" defaultValue={f.case ?? ''}>
            <option value="">All cases</option>
            {record.data.cases.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-tradition">Tradition</label>
          <select id="f-tradition" name="tradition" defaultValue={f.tradition ?? ''}>
            <option value="">All traditions</option>
            {record.data.traditions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-status">Status</label>
          <select id="f-status" name="status" defaultValue={f.status ?? ''}>
            <option value="">Any status</option>
            {(['published', 'provisional', 'externally_reviewed', 'withdrawn'] as const).map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <button className="button" type="submit">
            Filter
          </button>
        </div>
      </form>

      <p className="small faint">
        {result.total} claim{result.total === 1 ? '' : 's'}
        {active ? ' match' : ' in the record'} · record version <span className="mono">{record.version}</span> ·{' '}
        <a className="link" href="/api/v1/claims">
          JSON
        </a>
      </p>

      <div className="stack" style={{ marginTop: 18 }}>
        {result.data.map((c) => (
          <ClaimCard key={c.code} claim={c}>
            <p className="small faint" style={{ margin: '4px 0 0' }}>
              Disputed: {c.disputed} · Review: {REVIEW_STATE_LABELS[c.status as RevisionStatus] ?? c.status}
            </p>
          </ClaimCard>
        ))}
      </div>
    </main>
  );
}

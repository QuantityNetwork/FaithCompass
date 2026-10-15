import type { Metadata } from 'next';
import Link from 'next/link';
import { ClaimCard, CodeLink, PageIntro, Section } from '@/components/record/ui';
import { SaveTraceButton, SavedTraces } from '@/components/research/saved-traces';
import { claimSummary } from '@/lib/api/views';
import { seededByQuery } from '@/lib/evidence/seed';
import { getRecord } from '@/lib/record/record';
import { search } from '@/lib/record/search';
import { param, type SearchParams } from '@/lib/site/explorer';

export const metadata: Metadata = {
  title: 'Research',
  description:
    'Ask a theological question and see the published record behind the answer: sources, claims, attributed traditions and provenance. No sign-in, no generated text.',
  alternates: { canonical: '/research' },
};

type Props = { searchParams: Promise<SearchParams> };

export default async function ResearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = (param(sp, 'q') ?? '').trim().slice(0, 500);
  const record = getRecord();
  const result = q ? search(record, q) : null;
  const evidence = q ? seededByQuery(q) : undefined;

  const otherHits = result ? result.hits.filter((h) => h.kind !== 'claim' && h.kind !== 'case').slice(0, 8) : [];
  const traditionsMentioned = result
    ? [
        ...new Set(
          result.claims.flatMap(({ claim }) => {
            const r = record.current(claim);
            return [...r.attribution.traditions, ...r.acceptance.map((a) => a.tradition)];
          }),
        ),
      ]
    : [];

  return (
    <main id="main" className="shell page">
      <PageIntro
        eyebrow="Research workspace"
        title="Begin with a question."
        lede="Search the published record by question, scripture reference or topic. Every result is a record you can open, attributed and with its provenance — nothing here is generated."
      />

      <form className="ask" action="/research" method="get" role="search">
        <label htmlFor="q" className="visually-hidden">
          Research question
        </label>
        <input
          id="q"
          name="q"
          className="field"
          defaultValue={q}
          placeholder="e.g. What changed concerning priesthood under the New Covenant?"
          maxLength={500}
          autoComplete="off"
        />
        <button className="button button--solid" type="submit">
          Search the record
        </button>
      </form>

      {!result ? (
        <Section title="Research cases" eyebrow="Or start from a case">
          <div className="grid-2">
            {record.data.cases.map((rc) => (
              <Link key={rc.slug} href={`/research/${rc.slug}`} className="card card--link">
                <span className="card__meta">{rc.field.replace(/-/g, ' ')}</span>
                <span className="card__title" style={{ display: 'block' }}>
                  {rc.question}
                </span>
                <span className="small muted">{rc.title}</span>
              </Link>
            ))}
          </div>
        </Section>
      ) : (
        <>
          <p className="small faint" style={{ marginTop: 18 }}>
            Assembled by retrieval from {record.data.claims.length} published claims (record version{' '}
            <span className="mono">{record.version}</span>). No text was generated.
          </p>

          {result.guardrail ? (
            <div className="notice" role="note">
              <p style={{ marginTop: 0 }}>{result.guardrail.message}</p>
              <ul>
                {result.guardrail.suggestedClaims.map((s) => (
                  <li key={s}>
                    <Link className="link" href={`/research?q=${encodeURIComponent(s)}`}>
                      {s}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.bestCase ? (
            <Section title={result.bestCase.question} eyebrow="This question has a research case">
              <p className="lede" style={{ marginTop: 0 }}>
                {result.bestCase.summary}
              </p>
              <div className="button-row">
                <Link className="button button--solid" href={`/research/${result.bestCase.slug}`}>
                  Open the case: sources, positions, explorer
                </Link>
                <Link className="button button--quiet" href={`/compare?case=${result.bestCase.slug}`}>
                  Compare traditions
                </Link>
              </div>
            </Section>
          ) : null}

          <Section title="Claims" eyebrow="Sources · Claims">
            {result.claims.length === 0 ? (
              <div className="notice">
                <p style={{ margin: 0 }}>
                  The record does not yet hold claims matching “{q}”. Coverage is listed on the{' '}
                  <Link className="link" href="/corpus">
                    corpus page
                  </Link>
                  ; the research cases are a good place to start.
                </p>
              </div>
            ) : (
              <div className="stack">
                {result.claims.map(({ claim, matched }) => (
                  <ClaimCard key={claim.code} claim={claimSummary(record, claim)}>
                    <p className="small faint" style={{ margin: '4px 0 0' }}>
                      Matched: {matched.join(', ')} · Provenance:{' '}
                      <Link className="link" href={`/claims/${claim.code}#provenance`}>
                        eight steps
                      </Link>
                    </p>
                  </ClaimCard>
                ))}
              </div>
            )}
          </Section>

          {traditionsMentioned.length ? (
            <Section title="Traditions" eyebrow="Attributed readings">
              <p className="small muted" style={{ marginTop: 0 }}>
                Traditions whose readings are attributed in the claims above. Open a claim to see each stance and its note.
              </p>
              <div className="node-index">
                {traditionsMentioned.map((t) => (
                  <Link key={t} className="filter-link" href={`/traditions/${t}`}>
                    {record.tradition(t)?.name ?? t}
                  </Link>
                ))}
              </div>
            </Section>
          ) : null}

          {otherHits.length ? (
            <Section title="Also in the record" eyebrow="Provenance">
              <ul className="affected-list">
                {otherHits.map((h) => (
                  <li key={h.id}>
                    <CodeLink code={h.id} />{' '}
                    <span className="small muted">
                      {h.kind === 'axiom'
                        ? record.axiom(h.id)?.label
                        : h.kind === 'counter_model'
                          ? record.counterModel(h.id)?.title
                          : h.kind === 'covenant'
                            ? record.covenantEdge(h.id)?.description
                            : record.doctrineEdge(h.id)?.description}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {evidence ? (
            <Section title="Evidence assessment" eyebrow="Evidence Intelligence">
              <Link className="card card--link" href={`/evidence/${evidence.slug}`}>
                <span className="card__title" style={{ display: 'block' }}>
                  {evidence.title}
                </span>
                <span className="small muted">Claim-level assessment of historical and textual evidence for this subject.</span>
              </Link>
            </Section>
          ) : null}

          <div className="button-row no-print">
            <SaveTraceButton title={q} />
            <a className="button button--quiet" href={`/api/v1/search?q=${encodeURIComponent(q)}`}>
              As JSON
            </a>
          </div>
        </>
      )}

      <SavedTraces />
    </main>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DependencyExplorer } from '@/components/record/dependency-explorer';
import { ClaimCard, CodeLink, JsonLd, PageIntro, ProvisionalNotice, Refs, Section, StatusPill } from '@/components/record/ui';
import { caseView, claimSummary } from '@/lib/api/views';
import { simulate } from '@/lib/record/engine';
import { caseScope } from '@/lib/record/layout';
import { getRecord } from '@/lib/record/record';
import { CASE_RESPONSE_META, CLASSIFICATION_META, ROLE_META } from '@/lib/record/taxonomy';
import { absoluteUrl } from '@/lib/site/config';
import { explorerProps, type SearchParams } from '@/lib/site/explorer';

type Props = { params: Promise<{ case: string }>; searchParams: Promise<SearchParams> };

const FIELD_LABEL: Record<string, string> = {
  'jewish-studies': 'Jewish studies',
  'christian-studies': 'Christian studies',
  'islamic-studies': 'Islamic studies',
  'latter-day-saint-studies': 'Latter-day Saint studies',
};

export function generateStaticParams() {
  return getRecord().data.cases.map((c) => ({ case: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { case: slug } = await params;
  const rc = getRecord().researchCase(slug);
  if (!rc) return {};
  return {
    title: rc.title,
    description: `${rc.question} ${rc.summary}`.slice(0, 300),
    alternates: { canonical: `/research/${rc.slug}` },
    openGraph: { title: rc.question, description: rc.summary.slice(0, 300) },
  };
}

export default async function ResearchCasePage({ params, searchParams }: Props) {
  const { case: slug } = await params;
  const sp = await searchParams;
  const record = getRecord();
  const rc = record.researchCase(slug);
  if (!rc) notFound();

  const view = caseView(record, slug);
  const graph = record.graph();
  const claims = record.claimsInCase(slug);
  const scope = caseScope(graph, claims.map((c) => c.code));
  const [a, b] = rc.featured;
  const preview = simulate(graph, { rejectAxioms: [rc.suggestedRejection] });
  const suggested = record.axiom(rc.suggestedRejection)!;
  const counterModels = record.data.counterModels.filter((m) => claims.some((c) => c.code === m.targets));

  const byRole = (['position', 'parent', 'lemma', 'thesis'] as const).map((role) => ({
    role,
    claims: claims.filter((c) => c.role === role),
  }));

  return (
    <main id="main" className="shell page">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Question',
          name: rc.question,
          text: rc.summary,
          url: absoluteUrl(`/research/${rc.slug}`),
          suggestedAnswer: rc.positions.map((p) => ({
            '@type': 'Answer',
            text: record.current(record.claim(p.claim)!).statement,
            url: absoluteUrl(`/claims/${p.claim}`),
          })),
        }}
      />
      <PageIntro eyebrow={`Research case · ${FIELD_LABEL[rc.field]}`} title={rc.question} lede={rc.summary}>
        <div className="stat-row">
          <span>
            <StatusPill status={rc.status} />
          </span>
          <span>
            <strong>{claims.length}</strong> claims
          </span>
          <span>
            <strong>{rc.positions.length}</strong> positions
          </span>
          <span>
            <strong>{counterModels.length}</strong> counter-models
          </span>
          <span>
            <strong>{rc.responses.length}</strong> tradition responses
          </span>
        </div>
      </PageIntro>
      <ProvisionalNotice subject="This research case" status={rc.status} />

      <Section id="framing" title="How the question is asked" eyebrow="Framing">
        <p className="prose-block" style={{ margin: 0 }}>
          {rc.framing}
        </p>
      </Section>

      <Section id="opposing" title="Two opposing interpretations" eyebrow="Start here">
        <div className="positions">
          {[a, b].map((code) => {
            const p = rc.positions.find((x) => x.claim === code)!;
            const statusAfter = preview.statuses[code];
            return (
              <div key={code} className="position">
                <div className="claim-card__head">
                  <CodeLink code={code} />
                  <span>{p.heldBy.map((t) => record.tradition(t)?.name ?? t).join(', ')}</span>
                </div>
                <h3 className="subheading" style={{ marginTop: 10 }}>
                  {p.label}
                </h3>
                <p>{record.current(record.claim(code)!).statement}</p>
                <ul className="reasons-plain">
                  {record.derivationsOf(code).map((d) => (
                    <li key={d.code}>
                      <strong>{d.label}</strong> — rests on {d.premises.filter((x) => x.necessity === 'necessary').map((x) => x.claim).join(', ') || 'no claims'}
                      {d.axioms.filter((x) => x.role === 'requires').length
                        ? `; requires ${d.axioms.filter((x) => x.role === 'requires').map((x) => x.axiom).join(', ')}`
                        : ''}
                    </li>
                  ))}
                </ul>
                <p className="small faint" style={{ marginBottom: 0 }}>
                  If {suggested.code} is rejected: <span className={`status status--${statusAfter}`}>{statusAfter}</span>
                </p>
              </div>
            );
          })}
        </div>
        <p className="small muted" style={{ marginTop: 16, maxWidth: '72ch' }}>
          Suggested first step: reject <strong>{suggested.code}</strong> — {suggested.label} ({suggested.heldBy}) — in the
          explorer below, and watch which position loses its support. The sources stay exactly as published, and the rival
          position remains on screen.
        </p>
        <div className="button-row">
          <a className="button button--solid" href={`/research/${rc.slug}?reject=${rc.suggestedRejection}#explorer`}>
            Reject {suggested.code}
          </a>
          <Link className="button button--quiet" href={`/compare?case=${rc.slug}`}>
            Compare every tradition
          </Link>
        </div>
      </Section>

      <Section id="explore" title="Challenge an assumption" eyebrow="Dependency Explorer">
        <DependencyExplorer
          {...explorerProps(record, {
            scope,
            basePath: `/research/${rc.slug}`,
            searchParams: sp,
            positions: rc.positions,
            featured: rc.featured,
            suggested: rc.suggestedRejection,
          })}
        />
      </Section>

      <Section id="traditions" title="How each tradition responds" eyebrow="Tradition Layer">
        <div className="table-wrap">
          <table className="table table--stack">
            <thead>
              <tr>
                <th scope="col">Tradition</th>
                <th scope="col">Response</th>
                <th scope="col">Its own categories</th>
                <th scope="col">Position</th>
              </tr>
            </thead>
            <tbody>
              {view.responses.map((r) => (
                <tr key={r.tradition}>
                  <td data-label="Tradition">
                    <Link className="link" href={`/traditions/${r.tradition}`}>
                      {r.tradition_name}
                    </Link>
                  </td>
                  <td data-label="Response">
                    <span className="pill" title={CASE_RESPONSE_META[r.response as keyof typeof CASE_RESPONSE_META].definition}>
                      {r.response_label}
                    </span>
                    <p style={{ margin: '8px 0 0' }}>{r.summary}</p>
                    {r.references.length ? (
                      <p className="faint" style={{ margin: '4px 0 0' }}>
                        <Refs refs={r.references} />
                      </p>
                    ) : null}
                  </td>
                  <td data-label="Its own categories">{r.categories.join(' · ')}</td>
                  <td data-label="Position">{r.position ? <CodeLink code={r.position} /> : <span className="faint">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="claims" title="The record behind this case">
        {byRole
          .filter((g) => g.claims.length)
          .map((g) => (
            <div key={g.role} className="section--tight">
              <h3 className="subheading">
                {ROLE_META[g.role].label}s <span className="faint small">· {ROLE_META[g.role].definition}</span>
              </h3>
              <div className="stack">
                {g.claims.map((c) => (
                  <ClaimCard key={c.code} claim={claimSummary(record, c)} headingLevel={4}>
                    <p className="small faint" style={{ margin: '4px 0 0' }}>
                      {CLASSIFICATION_META[record.current(c).classification].label} · {record.current(c).interpretiveDivergence}
                    </p>
                  </ClaimCard>
                ))}
              </div>
            </div>
          ))}
      </Section>

      <Section id="counter-models" title="Counter-models">
        <div className="grid-2">
          {counterModels.map((m) => (
            <article key={m.code} className="card" id={m.code}>
              <div className="claim-card__head">
                <span className="code-inline">{m.code}</span>
                <span>{m.strength}</span>
                <span>contests {m.targets}</span>
              </div>
              <h3 className="card__title">{m.title}</h3>
              <p className="small muted">{m.heldBy}</p>
              <p>{m.thesis}</p>
              <p className="small muted">{m.alternativeReading}</p>
              <p className="small faint">
                Evidence: {m.evidence.map((e) => e.display).join('; ')}
                {m.reliesOn.length ? ` · relies on ${m.reliesOn.join(', ')}` : ''}
                {m.rejects.length ? ` · denies ${m.rejects.join(', ')}` : ''}
              </p>
            </article>
          ))}
        </div>
      </Section>

      <Section id="limitations" title="Known limitations">
        <ul className="prose-block">
          {rc.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <p className="small faint">
          Machine access: <a className="link" href={`/api/v1/cases/${rc.slug}`}>/api/v1/cases/{rc.slug}</a> ·{' '}
          <a className="link" href={`/api/v1/cases/${rc.slug}/compare`}>comparison</a> · MCP tool <code className="code-inline">get_research_case</code>
        </p>
      </Section>
    </main>
  );
}

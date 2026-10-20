import type { Metadata } from 'next';
import Link from 'next/link';
import { EmblemIntro, type EmblemNode, type EmblemPosition } from '@/components/brand/emblem-intro';
import { CodeLink, Refs, StatusPill } from '@/components/record/ui';
import { claimSummary } from '@/lib/api/views';
import { STATUS_LABELS, simulate } from '@/lib/record/engine';
import { getRecord } from '@/lib/record/record';
import { AXIS_META, CONFIDENCE_AXES } from '@/lib/record/taxonomy';
import { absoluteUrl } from '@/lib/site/config';
import { param, type SearchParams } from '@/lib/site/explorer';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

const FIELD_LABEL: Record<string, string> = {
  'jewish-studies': 'Jewish studies',
  'christian-studies': 'Christian studies',
  'islamic-studies': 'Islamic studies',
  'latter-day-saint-studies': 'Latter-day Saint studies',
};

const SHORT_LABEL: Record<string, string> = {
  'jewish-studies': 'Jewish',
  'christian-studies': 'Christian',
  'islamic-studies': 'Islamic',
  'latter-day-saint-studies': 'Latter-day Saint',
};

/** Clockwise from the top, in the order the cases are listed: the historical order of their traditions. */
const POSITIONS: EmblemPosition[] = ['top', 'right', 'bottom', 'left'];

const LAYERS = [
  ['01', 'Corpus', 'The sources, cited by edition and classified by provenance.'],
  ['02', 'Claim Ledger', 'What the evidence establishes, one revisioned claim at a time.'],
  ['03', 'Covenant Map', 'Where a passage sits in each tradition’s covenantal history.'],
  ['04', 'Doctrine Graph', 'How ideas connect, with evidence on every edge.'],
  ['05', 'Tradition Layer', 'How communities read the texts, in their own categories.'],
  ['06', 'Research Engine', 'Retrieval, comparison and the dependency model.'],
] as const;

type Props = { searchParams: Promise<SearchParams> };

export default async function Home({ searchParams }: Props) {
  const sp = await searchParams;
  const record = getRecord();
  const cases = record.data.cases;
  const selectedSlug = param(sp, 'case');
  const rc = cases.find((c) => c.slug === selectedSlug) ?? cases[0];

  const claims = record.claimsInCase(rc.slug);
  const texts = claims
    .filter((c) => c.role === 'thesis' && ['textual_proposition', 'quotation'].includes(record.current(c).classification))
    .slice(0, 3);
  const [a, b] = rc.featured;
  const suggested = record.axiom(rc.suggestedRejection)!;
  const after = simulate(record.graph(), { rejectAxioms: [rc.suggestedRejection] });
  const counts = {
    claims: record.data.claims.length,
    covenants: record.data.covenants.length,
    doctrine: record.data.doctrine.length,
    traditions: record.data.traditions.length,
    axioms: record.data.axioms.length,
    derivations: record.data.derivations.length,
    works: record.data.works.length,
  };

  const emblemNodes: EmblemNode[] = cases.slice(0, POSITIONS.length).map((c, i) => ({
    slug: c.slug,
    position: POSITIONS[i],
    short: SHORT_LABEL[c.field] ?? FIELD_LABEL[c.field],
    field: FIELD_LABEL[c.field],
    question: c.question,
    href: `/?case=${c.slug}#worked`,
  }));

  return (
    <main id="main">
      <section className="shell hero" aria-labelledby="hero-title">
        <div className="hero__grid">
          <div>
            <p className="eyebrow">Structured theological research</p>
            <h1 className="hero__title" id="hero-title">
              Begin with a <em>question.</em>
            </h1>
            <p className="lede">
              AbrahamMoses keeps what a text says apart from how each tradition reads it, records what every conclusion rests
              on, and lets you reject an assumption to see what follows — without altering a single source.
            </p>
            <form className="ask" action="/research" method="get" role="search">
              <label htmlFor="home-q" className="visually-hidden">
                Research question
              </label>
              <div className="ask__field">
                <input
                  id="home-q"
                  name="q"
                  className="field"
                  placeholder=" "
                  aria-describedby="home-q-hint"
                  maxLength={500}
                />
                <span className="ask__hint ask__hint--long" id="home-q-hint" aria-hidden="true">
                  Ask a question, or cite a passage (e.g. Hebrews 7, Q 3:67)
                </span>
                <span className="ask__hint ask__hint--short" aria-hidden="true">
                  Ask a question or cite a passage
                </span>
              </div>
              <button className="button button--solid" type="submit">
                Research
              </button>
            </form>
          </div>
          <EmblemIntro
            nodes={emblemNodes}
            selected={selectedSlug ? rc.slug : undefined}
            intro="Four traditions, one set of sources that is never altered. Choose a question and trace it to them."
            centre={{
              href: '/research',
              title: 'The shared record',
              detail: `${counts.claims} claims on ${counts.works} cited works, every revision pinned. Search it.`,
            }}
          />
        </div>
        <nav className="examples" aria-label="Example research questions">
          {cases.map((c) => (
            <Link
              key={c.slug}
              href={`/?case=${c.slug}#worked`}
              className="example"
              data-case={c.slug}
              aria-current={c.slug === rc.slug ? 'true' : undefined}
              scroll={false}
            >
              <span className="example__field">{FIELD_LABEL[c.field]}</span>
              <span className="example__q">{c.question}</span>
            </Link>
          ))}
        </nav>
        <p className="small faint" style={{ marginTop: 10 }}>
          Listed in the historical order of the traditions whose questions they are.
        </p>
      </section>

      {/* 1 — Research: a real worked answer, from published records */}
      <section className="shell section" id="worked" aria-labelledby="worked-title">
        <p className="chapter-number">01 · Research</p>
        <h2 className="section-heading" id="worked-title">
          A worked answer, from the record
        </h2>
        <div className="worked">
          <div className="worked__head">
            <div className="claim-card__head">
              <span>{FIELD_LABEL[rc.field]}</span>
              <StatusPill status={rc.status} />
            </div>
            <h3 className="subheading" style={{ fontSize: 26, marginTop: 8 }}>
              {rc.question}
            </h3>
            <p className="muted" style={{ marginBottom: 0 }}>
              {rc.summary}
            </p>
          </div>
          <div className="worked__body">
            <div className="worked__panel">
              <p className="chapter-number">What the texts say</p>
              {texts.map((c) => {
                const s = claimSummary(record, c);
                return (
                  <div key={c.code} style={{ marginBottom: 16 }}>
                    <CodeLink code={c.code} />
                    <p style={{ margin: '4px 0' }}>{s.statement}</p>
                    <p className="small faint" style={{ margin: 0 }}>
                      <Refs refs={s.witnesses} /> · textual certainty: {record.current(c).confidence?.textual.level ? AXIS_META.textual.levels[record.current(c).confidence!.textual.level!].label : '—'}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="worked__panel">
              <p className="chapter-number">Where interpretation begins</p>
              {[a, b].map((code) => {
                const p = rc.positions.find((x) => x.claim === code)!;
                return (
                  <div key={code} style={{ marginBottom: 16 }}>
                    <CodeLink code={code} /> <span className="small faint">{p.heldBy.map((t) => record.tradition(t)?.name ?? t).join(', ')}</span>
                    <p style={{ margin: '4px 0' }}>{record.current(record.claim(code)!).statement}</p>
                    <p className="small faint" style={{ margin: 0 }}>
                      Rests on {record.derivationsOf(code).length} derivation(s); requires{' '}
                      {[...new Set(record.derivationsOf(code).flatMap((d) => d.axioms.filter((x) => x.role === 'requires').map((x) => x.axiom)))].join(', ') || 'no reading principle'}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="worked__panel">
              <p className="chapter-number">Challenge an assumption</p>
              <p style={{ marginTop: 4 }}>
                Reject <strong>{suggested.code}</strong> — {suggested.label} ({suggested.heldBy}):
              </p>
              <ul className="reasons-plain" style={{ fontSize: 14 }}>
                {[a, b].map((code) => (
                  <li key={code}>
                    {code}: <span className={`status status--${after.statuses[code]}`}>{STATUS_LABELS[after.statuses[code]]}</span>
                  </li>
                ))}
                <li>
                  {after.summary.broken} broken, {after.summary.weakened + after.summary.unwarranted} weakened across the record. No source changed.
                </li>
              </ul>
              <div className="button-row" style={{ marginTop: 16 }}>
                <Link className="button button--solid" href={`/research/${rc.slug}?reject=${rc.suggestedRejection}#explorer`}>
                  Try it in the explorer
                </Link>
                <Link className="button button--quiet" href={`/research/${rc.slug}`}>
                  Full case
                </Link>
              </div>
            </div>
          </div>
        </div>
        <p className="small faint">
          Every line above is a published record with a code; nothing on this page is generated. Records marked provisional
          await editorial verification.
        </p>
      </section>

      {/* 2 — The method */}
      <section className="shell section" aria-labelledby="method-title">
        <p className="chapter-number">02 · The method</p>
        <h2 className="section-heading" id="method-title">
          Certainty decreases exactly where interpretation begins
        </h2>
        <p className="lede" style={{ marginTop: 0 }}>
          Six connected layers hold the evidence. Confidence is recorded on separate axes that are never combined, and every
          conclusion records the derivations it rests on — so rejecting one assumption breaks only what genuinely needs it.
        </p>
        <div className="layers">
          {LAYERS.map(([n, name, desc]) => (
            <div className="layer" key={n}>
              <div className="layer__n">{n}</div>
              <div className="layer__name">{name}</div>
              <p className="small muted" style={{ margin: 0 }}>
                {desc}
              </p>
            </div>
          ))}
        </div>
        <div className="grid-2 section--tight">
          <div className="card">
            <h3 className="card__title">Five measures, never one score</h3>
            <ul className="reasons-plain" style={{ fontSize: 14 }}>
              {CONFIDENCE_AXES.map((k) => (
                <li key={k}>
                  <strong>{AXIS_META[k].label}</strong> — {AXIS_META[k].question}
                </li>
              ))}
              <li>
                <strong>Traditional acceptance</strong> — recorded per tradition, as affirms, qualifies, disputes, rejects or
                does not address.
              </li>
            </ul>
          </div>
          <div className="card">
            <h3 className="card__title">Exact dependency logic</h3>
            <ul className="reasons-plain" style={{ fontSize: 14 }}>
              <li>A conclusion with two independent arguments survives the loss of one.</li>
              <li>A report of what a text says keeps its standing when a reading of it is rejected.</li>
              <li>Circular support never establishes anything.</li>
              <li>Rival readings are shown on both sides; the dispute is never declared settled.</li>
            </ul>
          </div>
        </div>
        <div className="button-row">
          <Link className="button button--quiet" href="/methodology">
            Methodology
          </Link>
          <Link className="button button--quiet" href="/system">
            The AbrahamMoses System, in twelve chapters
          </Link>
        </div>
      </section>

      {/* 3 — Explore the record */}
      <section className="shell section" aria-labelledby="record-title">
        <p className="chapter-number">03 · Explore the record</p>
        <h2 className="section-heading" id="record-title">
          The public record
        </h2>
        <div className="grid-3">
          {[
            ['/claims', 'Claim Ledger', `${counts.claims} claims, each with its revisions, witnesses and editions.`],
            ['/covenants', 'Covenant Map', `${counts.covenants} relationships, attributed to Jewish, Christian, Islamic and Latter-day Saint readings.`],
            ['/doctrine', 'Doctrine Graph', `${counts.doctrine} connections, starting from Abraham — the figure every tradition shares.`],
            ['/traditions', 'Traditions', `${counts.traditions} traditions and standpoints, each in its own categories.`],
            ['/hermeneutics', 'Hermeneutics', `${counts.axioms} reading principles and ${counts.derivations} derivations.`],
            ['/corpus', 'Corpus', `${counts.works} works, cited by edition, with coverage and gaps.`],
            ['/evidence', 'Evidence assessments', 'Claim-level assessments of historical and textual evidence.'],
            ['/compare', 'Tradition comparator', 'Each tradition’s answer side by side, including where it asks a different question.'],
            ['/changelog', 'Changelog', 'Every revision, newest first. Published revisions never change.'],
          ].map(([href, title, desc]) => (
            <Link key={href} href={href} className="card card--link">
              <span className="card__title" style={{ display: 'block' }}>
                {title}
              </span>
              <span className="small muted">{desc}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* 4 — Institutions and developers */}
      <section className="shell section" aria-labelledby="dev-title">
        <p className="chapter-number">04 · For institutions and developers</p>
        <h2 className="section-heading" id="dev-title">
          One host, two interfaces, tested end to end
        </h2>
        <div className="grid-2">
          <div className="card">
            <h3 className="card__title">MCP server</h3>
            <p className="small muted">For AI agents and research tools. Streamable HTTP; tools, resources and prompts; read-only.</p>
            <pre className="code" tabIndex={0} aria-label="MCP endpoint">{absoluteUrl('/mcp')}</pre>
          </div>
          <div className="card">
            <h3 className="card__title">REST API v1</h3>
            <p className="small muted">For applications. JSON with published schemas, an OpenAPI document and stable error codes.</p>
            <pre className="code" tabIndex={0} aria-label="REST API base URL">{absoluteUrl('/api/v1')}</pre>
          </div>
        </div>
        <div className="button-row">
          <Link className="button button--quiet" href="/developers">
            Developer documentation
          </Link>
          <Link className="button button--quiet" href="/status">
            Live status and self-tests
          </Link>
        </div>
      </section>

      {/* 5 — About */}
      <section className="shell section" aria-labelledby="about-title">
        <p className="chapter-number">05 · About AbrahamMoses</p>
        <h2 className="section-heading" id="about-title">
          Who stands behind the record
        </h2>
        <p className="lede" style={{ marginTop: 0 }}>
          AbrahamMoses is a research product written, built and owned by Sagolik. It is not an accredited institution. Every
          record names its author, its review state and whether machine assistance was involved; corrections are appended as
          new revisions, never made silently.
        </p>
        <div className="button-row">
          <Link className="button button--quiet" href="/about">
            About and governance
          </Link>
          <Link className="button button--quiet" href="/methodology#editorial">
            Editorial standards
          </Link>
          <Link className="button button--quiet" href="/privacy">
            Privacy
          </Link>
        </div>
      </section>
    </main>
  );
}

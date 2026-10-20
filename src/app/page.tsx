import type { Metadata } from 'next';
import Link from 'next/link';
import { ReviewChip } from '@/components/ds/status';
import { Cite, Footnotes } from '@/components/ds/footnotes';
import { IntroClip } from '@/components/home/intro-clip';
import { LiveChecks, type LiveCheck } from '@/components/home/live-record';
import { ModKey, PaletteButton } from '@/components/shell/palette-button';
import { SearchIcon } from '@/components/shell/icons';
import { checkRecord } from '@/lib/record/integrity';
import { getRecord } from '@/lib/record/record';
import { CLASSIFICATION_META, isEditorVerified } from '@/lib/record/taxonomy';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

const FIELD_LABEL: Record<string, string> = {
  'jewish-studies': 'Jewish studies',
  'christian-studies': 'Christian studies',
  'islamic-studies': 'Islamic studies',
  'latter-day-saint-studies': 'Latter-day Saint studies',
};

const JOURNEY_Q = 'What is the relationship between the Abrahamic and Mosaic covenants?';

/** The covenant journey: each step opens the page of the current site that does that work today. */
const JOURNEY: Array<{ step: string; text: string; href: string; where: string }> = [
  { step: 'Question', text: 'The relationship between the Abrahamic and Mosaic covenants.', href: `/research?q=${encodeURIComponent(JOURNEY_Q)}`, where: 'Research' },
  { step: 'Source discovery', text: 'The works and editions the record cites, by provenance.', href: '/corpus', where: 'Corpus' },
  { step: 'Historical context', text: 'Where each covenant sits in each tradition’s history.', href: '/covenants', where: 'Covenant map' },
  { step: 'Comparative analysis', text: 'Positions side by side, with the disagreement inside each tradition.', href: '/compare', where: 'Compare' },
  { step: 'Evidence graph', text: 'Premises, assumptions and conclusions, with evidence on every edge.', href: '/doctrine', where: 'Doctrine graph' },
  { step: 'Assumption testing', text: 'Set aside an interpretive assumption and see which conclusions still follow.', href: '/research/torah-permanence#explore', where: 'Dependency explorer' },
  { step: 'Research dossier', text: 'A printable report for one claim, with every citation. Full dossier export is planned.', href: '/claims/AM-CLAIM-000187/report', where: 'Claim report' },
  { step: 'Accountability', text: 'Who is responsible, what is still provisional, and every status correction.', href: '/changelog#status-corrections', where: 'Changelog' },
];

const WAYS_IN = [
  { who: 'Readers', text: 'Open a claim and see the passage, the edition, the kind of claim it is and who disputes it.', href: '/claims', chips: ['Evidence'] },
  { who: 'Researchers', text: 'Take a question through the record, compare positions and challenge the assumptions behind them.', href: '/research', chips: ['Research', 'Compare'] },
  { who: 'Institutions', text: 'See who is responsible for the record, how it is governed and what review has and has not happened.', href: '/institutional', chips: ['Institutional', 'Methodology'] },
  { who: 'Developers', text: 'The same claims and review states through a REST API and an MCP server.', href: '/developers', chips: ['REST', 'MCP'] },
];

function short(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 2).trimEnd()}…` : s;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Stockholm' });
}

export default function Home() {
  const record = getRecord();
  const { claims, cases, derivations, counterModels } = record.data;

  const publicRevisions = claims.flatMap((c) => c.revisions).filter((r) => r.status !== 'draft');
  const editorVerified = publicRevisions.filter((r) => isEditorVerified(r.status)).length;
  const externallyReviewed = publicRevisions.filter((r) => r.status === 'externally_reviewed').length;

  const errors = checkRecord(record.data, record.graph()).filter((f) => f.level === 'error');
  const initialChecks: LiveCheck[] = [
    {
      id: 'record_integrity',
      label: 'Record integrity',
      result: errors.length ? 'fail' : 'pass',
      detail: errors.length ? `${errors.length} integrity error(s).` : `${claims.length} claims, ${derivations.length} derivations, every claim established at baseline.`,
    },
  ];
  const builtAt = formatDate(new Date().toISOString());

  const claim = (code: string) => {
    const c = claims.find((x) => x.code === code);
    return c ? { code, rev: record.current(c) } : null;
  };
  const direct = claim('AM-CLAIM-000187');
  const reading = claim('AM-CLAIM-000228');
  const drv = derivations.find((d) => d.code === 'AM-DRV-0014');
  const cm = counterModels.find((m) => m.code === 'AM-CM-005');

  const feed = record.history().slice(0, 5);

  return (
    <main id="main">
      <section className="am-hero" aria-labelledby="hero-title">
        <div className="am-wrap am-hero__in">
          <IntroClip />
          <p className="am-eyebrow">Structured Theological Intelligence</p>
          <h1 id="hero-title">Ask a question. Trace every answer to its source.</h1>
          <p className="am-lede">
            A research record of the Abrahamic traditions, built claim by claim. Every statement names its passage and
            edition, says what kind of claim it is, and shows who holds it, who disputes it and what it depends on.
          </p>
          <form className="am-cmdbar" action="/research" method="get" role="search" aria-label="Research the record">
            <SearchIcon />
            <label className="am-sr" htmlFor="home-q">
              Research question
            </label>
            <input id="home-q" name="q" type="search" autoComplete="off" placeholder="Ask a research question…" required />
            <kbd aria-hidden="true">
              <ModKey /> K
            </kbd>
            <button className="am-btn am-btn--gold" type="submit">
              Research
            </button>
          </form>
          <p className="am-hint">
            Try{' '}
            {cases.slice(0, 3).map((c) => (
              <span key={c.slug}>
                <Link href={`/research?q=${encodeURIComponent(c.question)}`}>{c.title}</Link>
                {' · '}
              </span>
            ))}
            <PaletteButton>search everything</PaletteButton>
          </p>
        </div>
      </section>

      <section className="am-section am-wrap" aria-labelledby="coverage-title">
        <div className="am-section__head">
          <p className="am-eyebrow">Start from real coverage</p>
          <h2 className="am-h2" id="coverage-title">
            Questions the record can already answer, and how far
          </h2>
        </div>
        <ul className="am-qlist">
          {cases.map((c) => (
            <li key={c.slug}>
              <Link className="am-qc" href={`/research/${c.slug}`}>
                <span className="am-eyebrow">{FIELD_LABEL[c.field] ?? c.title}</span>
                <span className="am-qc__t am-serif">{c.question}</span>
                <span className="am-qc__m">
                  <span className="am-chip">
                    {record.claimsInCase(c.slug).length} claims · {c.positions.length} positions
                  </span>
                  <ReviewChip status={c.status} short />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="am-section am-wrap" aria-labelledby="journey-title">
        <div className="am-section__head">
          <p className="am-eyebrow">The research journey</p>
          <h2 className="am-h2" id="journey-title">
            From a question to an accountable dossier
          </h2>
          <p className="am-lede">
            Follow one question, “{JOURNEY_Q}”, through every step. Each step opens the part of the record that does that
            work today; the redesigned workspace that joins them is being built in stages.
          </p>
        </div>
        <ol className="am-journey">
          {JOURNEY.map((j) => (
            <li key={j.step}>
              <a href={j.href}>
                <b>{j.step}</b>
                <span>{j.text}</span>
                <span className="am-journey__where">{j.where} →</span>
              </a>
            </li>
          ))}
        </ol>
      </section>

      <section className="am-section am-wrap" aria-labelledby="separation-title">
        <div className="am-section__head">
          <p className="am-eyebrow">What every answer separates</p>
          <h2 className="am-h2" id="separation-title">
            Evidence, interpretation and inference are never blended
          </h2>
        </div>
        <div className="am-cols4">
          <section className="am-col" aria-labelledby="sep-direct">
            <div className="am-col__h">
              <h3 id="sep-direct">Direct evidence</h3>
              <p>What a source says.</p>
            </div>
            {direct ? (
              <div className="am-col__b">
                <div className="am-meta">
                  <span className="am-chip">{CLASSIFICATION_META[direct.rev.classification].label}</span>
                  <ReviewChip status={direct.rev.status} short />
                </div>
                <p className="am-serif">{direct.rev.statement}</p>
                <p className="am-tiny">
                  {direct.rev.primaryWitnesses.map((w) => w.display).join('; ')} ·{' '}
                  <Link href={`/claims/${direct.code}`}>{direct.code}</Link>
                </p>
              </div>
            ) : null}
          </section>
          <section className="am-col" aria-labelledby="sep-reading">
            <div className="am-col__h">
              <h3 id="sep-reading">Interpretations</h3>
              <p>Readings, attributed.</p>
            </div>
            {reading ? (
              <div className="am-col__b">
                <div className="am-meta">
                  <span className="am-chip">{CLASSIFICATION_META[reading.rev.classification].label}</span>
                  <ReviewChip status={reading.rev.status} short />
                </div>
                <p className="am-serif">{reading.rev.statement}</p>
                <p className="am-tiny">
                  <Link href={`/claims/${reading.code}`}>{reading.code}</Link>
                </p>
              </div>
            ) : null}
          </section>
          <section className="am-col" aria-labelledby="sep-inference">
            <div className="am-col__h">
              <h3 id="sep-inference">Inferences</h3>
              <p>What follows, and on what.</p>
            </div>
            {drv ? (
              <div className="am-col__b">
                <div className="am-meta">
                  <span className="am-chip">Derivation</span>
                  <span className="am-chip am-mono">{drv.code}</span>
                </div>
                <p className="am-serif">
                  {drv.label}: {drv.summary}
                </p>
                <p className="am-tiny">
                  {drv.axioms.map((a, i) => (
                    <span key={a.axiom}>
                      {i ? ' · ' : ''}
                      {a.role === 'requires' ? 'Requires' : 'Strengthened by'}{' '}
                      <Link href={`/hermeneutics#${a.axiom}`}>{a.axiom}</Link>
                    </span>
                  ))}{' '}
                  · <Link href={`/claims/${drv.claim}`}>{drv.claim}</Link>
                </p>
              </div>
            ) : null}
          </section>
          <section className="am-col" aria-labelledby="sep-unresolved">
            <div className="am-col__h">
              <h3 id="sep-unresolved">Unresolved</h3>
              <p>Objections and gaps.</p>
            </div>
            {cm ? (
              <div className="am-col__b">
                <div className="am-meta">
                  <span className="am-chip">Counter-model</span>
                  <span className="am-chip">{cm.strength}</span>
                </div>
                <p className="am-serif">
                  {cm.title}: {cm.thesis}
                </p>
                <p className="am-tiny">
                  {cm.heldBy} · <Link href={`/hermeneutics#${cm.code}`}>{cm.code}</Link>
                </p>
              </div>
            ) : null}
          </section>
        </div>
      </section>

      <section className="am-section am-wrap" aria-labelledby="state-title">
        <div className="am-grid2">
          <div>
            <div className="am-section__head">
              <p className="am-eyebrow">State of the record</p>
              <h2 className="am-h2" id="state-title">
                Honest numbers, including the unfinished ones
              </h2>
            </div>
            <dl className="am-stats">
              <div className="am-stat">
                <dt>claims in the ledger</dt>
                <dd>{claims.length}</dd>
              </div>
              <div className="am-stat">
                <dt>public revisions, hash-locked</dt>
                <dd>{publicRevisions.length}</dd>
              </div>
              <div className="am-stat">
                <dt>
                  revisions verified by an editor
                  <Cite n={1} scope="state" />
                </dt>
                <dd>{editorVerified}</dd>
              </div>
              <div className="am-stat">
                <dt>externally reviewed</dt>
                <dd>{externallyReviewed}</dd>
              </div>
            </dl>
            <Footnotes
              scope="state"
              notes={[
                <>
                  Counted from the record at build time. Records carried over from the earlier Claim Ledger are not counted as
                  verified, because no reviewer was recorded for them; see{' '}
                  <Link href="/about#editorial">editorial responsibility</Link> and the <Link href="/status">status page</Link>.
                </>,
              ]}
            />
          </div>
          <div className="am-card">
            <LiveChecks initial={initialChecks} builtAt={builtAt} />
            <h3 className="am-subhead">Latest changes</h3>
            <ul className="am-feed">
              {feed.map(({ code, revision }) => (
                <li key={`${code}@${revision.rev}`}>
                  <Link className="am-mono" href={`/claims/${code}`}>
                    {code} r{revision.rev}
                  </Link>
                  <span className="am-serif">{short(revision.statement, 110)}</span>
                  <span className="am-tiny">{formatDate(revision.publishedAt)}</span>
                </li>
              ))}
            </ul>
            <p className="am-tiny">
              <Link href="/changelog">Full changelog</Link> · <Link href="/status">Service status</Link>
            </p>
          </div>
        </div>
      </section>

      <section className="am-section am-wrap" aria-labelledby="ways-title">
        <div className="am-section__head">
          <p className="am-eyebrow">Ways in</p>
          <h2 className="am-h2" id="ways-title">
            For readers, researchers, institutions and builders
          </h2>
        </div>
        <ul className="am-qlist">
          {WAYS_IN.map((w) => (
            <li key={w.who}>
              <Link className="am-qc" href={w.href}>
                <span className="am-eyebrow">{w.who}</span>
                <span className="am-qc__t am-serif">{w.text}</span>
                <span className="am-qc__m">
                  {w.chips.map((c) => (
                    <span className="am-chip" key={c}>
                      {c}
                    </span>
                  ))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

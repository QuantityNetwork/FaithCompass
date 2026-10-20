import type { Metadata } from 'next';
import Link from 'next/link';
import { ReviewChip } from '@/components/ds/status';
import { Cite, Footnotes } from '@/components/ds/footnotes';
import { CovenantWord } from '@/components/home/covenant-word';
import { FocusTabs } from '@/components/home/focus-tabs';
import { LiveChecks, type LiveCheck } from '@/components/home/live-record';
import { PaletteButton } from '@/components/shell/palette-button';
import { checkRecord } from '@/lib/record/integrity';
import { getRecord } from '@/lib/record/record';
import { CLASSIFICATION_META, isEditorVerified } from '@/lib/record/taxonomy';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

/** Each study's field, with a word from its own tradition's language set as the list glyph. */
const FIELD_GLYPH: Record<string, { text: string; cls: string; lang?: string }> = {
  'jewish-studies': { text: 'תּוֹרָה', cls: 'he', lang: 'he' },
  'christian-studies': { text: 'ἱερεύς', cls: 'gr', lang: 'grc' },
  'islamic-studies': { text: 'إبراهيم', cls: 'ar', lang: 'ar' },
  'latter-day-saint-studies': { text: 'Restoration', cls: 'en' },
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
  { step: 'Question', text: 'The relationship between the Abrahamic and Mosaic covenants.', href: '/research?dossier=covenants', where: 'Research workspace' },
  { step: 'Source discovery', text: 'The works and editions the record cites, by provenance.', href: '/corpus', where: 'Corpus' },
  { step: 'Historical context', text: 'Where each covenant sits in each tradition’s history.', href: '/covenants', where: 'Covenant map' },
  { step: 'Comparative analysis', text: 'Positions side by side, with the disagreement inside each tradition.', href: '/compare', where: 'Compare' },
  { step: 'Evidence graph', text: 'Premises, assumptions and conclusions, with evidence on every edge.', href: '/research?dossier=covenants&view=graph', where: 'Argument graph' },
  { step: 'Assumption testing', text: 'Set aside an interpretive assumption and see which conclusions still follow.', href: '/research?dossier=covenants&view=graph#rw-graph-title', where: 'Argument graph' },
  { step: 'Research dossier', text: 'The dossier as JSON or Markdown, with its reproducibility manifest, or printed.', href: '/research?dossier=covenants#rw-export-title', where: 'Dossier export' },
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
    <main id="main" className="d-home">
      <section className="d-hero am-wrap" aria-labelledby="hero-title">
        <div className="d-hero__text">
          <p className="d-over">Structured Theological Intelligence</p>
          <h1 id="hero-title" className="d-h1">
            Ask a question. <em>Trace every answer to its source.</em>
          </h1>
          <p className="d-lead">
            A research record of the Abrahamic traditions, built claim by claim. Every statement names its passage and
            edition, says what kind of claim it is, and shows who holds it, who disputes it and what it depends on.
          </p>
          <form className="d-ask" action="/research/ask" method="post" role="search" aria-label="Research the record">
            <label className="am-sr" htmlFor="home-q">
              Research question
            </label>
            <input id="home-q" name="q" type="search" autoComplete="off" placeholder="Ask the record…" required />
            <button type="submit">
              Research <span aria-hidden="true">→</span>
            </button>
          </form>
          <p className="d-try">
            Try{' '}
            {cases.slice(0, 3).map((c, n) => (
              <span key={c.slug}>
                {n ? ' · ' : ''}
                <Link href={`/research?case=${c.slug}`}>{c.title}</Link>
              </span>
            ))}
            {' · '}
            <PaletteButton>search everything</PaletteButton>
          </p>
        </div>
        <CovenantWord />
      </section>

      <section className="d-nums" aria-label="State of the record">
        <div className="am-wrap d-nums__in">
          <dl>
            <div>
              <dd>{claims.length}</dd>
              <dt>claims</dt>
            </div>
            <div>
              <dd>{record.data.works.length}</dd>
              <dt>works</dt>
            </div>
            <div>
              <dd>{record.data.traditions.length}</dd>
              <dt>traditions</dt>
            </div>
            <div>
              <dd>{editorVerified}</dd>
              <dt>editor-verified</dt>
            </div>
            <div>
              <dd>{externallyReviewed}</dd>
              <dt>externally reviewed</dt>
            </div>
          </dl>
          <p className="d-nums__note">
            Named editors and reviewers are not yet published; no external review has taken place.{' '}
            <Link href="/status">Status</Link>
          </p>
        </div>
      </section>

      <section className="d-sec am-wrap" aria-labelledby="coverage-title">
        <div className="d-sec__side">
          <p className="d-over">Start from real coverage</p>
          <h2 className="d-h2" id="coverage-title">
            Questions the record can already answer
          </h2>
          <p>Four studies, each asked in the terms of its own tradition.</p>
        </div>
        <ul className="d-list">
          {cases.map((c) => {
            const g = FIELD_GLYPH[c.field];
            return (
              <li key={c.slug}>
                <Link href={`/research/${c.slug}`}>
                  <span className={`d-list__g ${g?.cls ?? 'en'}`} aria-hidden="true">
                    <span lang={g?.lang}>{g?.text ?? '§'}</span>
                  </span>
                  <span className="d-list__b">
                    <span className="d-list__f">{FIELD_LABEL[c.field] ?? c.title}</span>
                    <span className="d-list__t">{c.title}</span>
                    <span className="d-list__p">{c.question}</span>
                    <span className="d-list__m">
                      {record.claimsInCase(c.slug).length} claims · {c.positions.length} positions ·{' '}
                      <ReviewChip status={c.status} short />
                    </span>
                  </span>
                  <span className="d-list__ar" aria-hidden="true">
                    →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="d-sec am-wrap" aria-labelledby="separation-title">
        <div className="d-sec__side">
          <p className="d-over">Research dossier</p>
          <h2 className="d-h2" id="separation-title">
            What every answer separates
          </h2>
          <p>Evidence, interpretation and inference are never blended.</p>
        </div>
        <div>
          <p className="d-dq">{JOURNEY_Q}</p>
          <FocusTabs>
            <section className="d-col c1" aria-labelledby="sep-direct">
              <h3 id="sep-direct">Direct evidence</h3>
              <p className="d-col__k">What the cited sources say.</p>
              {direct ? (
                <div className="d-it">
                  <Link className="d-code" href={`/claims/${direct.code}`}>
                    {direct.code} · {CLASSIFICATION_META[direct.rev.classification].label}
                  </Link>
                  <p>{direct.rev.statement}</p>
                  <p className="d-it__m">{direct.rev.primaryWitnesses.map((w) => w.display).join('; ')}</p>
                  <ReviewChip status={direct.rev.status} short />
                </div>
              ) : null}
            </section>
            <section className="d-col c2" aria-labelledby="sep-reading">
              <h3 id="sep-reading">Interpretations</h3>
              <p className="d-col__k">Attributed, never asserted.</p>
              {reading ? (
                <div className="d-it">
                  <Link className="d-code" href={`/claims/${reading.code}`}>
                    {reading.code} · {CLASSIFICATION_META[reading.rev.classification].label}
                  </Link>
                  <p>{reading.rev.statement}</p>
                  <ReviewChip status={reading.rev.status} short />
                </div>
              ) : null}
            </section>
            <section className="d-col c3" aria-labelledby="sep-inference">
              <h3 id="sep-inference">Inferences</h3>
              <p className="d-col__k">Premises, assumptions, conclusion.</p>
              {drv ? (
                <div className="d-it">
                  <Link className="d-code" href={`/claims/${drv.claim}`}>
                    {drv.code} → {drv.claim}
                  </Link>
                  <p>
                    {drv.label}: {drv.summary}
                  </p>
                  <p className="d-it__m">
                    {drv.axioms.map((a, i) => (
                      <span key={a.axiom}>
                        {i ? ' · ' : ''}
                        {a.role === 'requires' ? 'Requires' : 'Strengthened by'}{' '}
                        <Link href={`/hermeneutics#${a.axiom}`}>{a.axiom}</Link>
                      </span>
                    ))}
                  </p>
                </div>
              ) : null}
            </section>
            <section className="d-col c4" aria-labelledby="sep-unresolved">
              <h3 id="sep-unresolved">Unresolved questions</h3>
              <p className="d-col__k">Objections, counter-evidence, gaps.</p>
              {cm ? (
                <div className="d-it">
                  <Link className="d-code" href={`/hermeneutics#${cm.code}`}>
                    {cm.code} · {cm.heldBy}
                  </Link>
                  <p>
                    {cm.title}: {cm.thesis}
                  </p>
                  <p className="d-it__m">Strength: {cm.strength}</p>
                </div>
              ) : null}
            </section>
          </FocusTabs>
          <p className="d-more">
            <Link href="/research?dossier=covenants">
              Open the covenant dossier <span aria-hidden="true">→</span>
            </Link>
          </p>
        </div>
      </section>

      <section className="d-sec am-wrap" aria-labelledby="journey-title">
        <div className="d-sec__side">
          <p className="d-over">The research journey</p>
          <h2 className="d-h2" id="journey-title">
            From a question to an accountable dossier
          </h2>
          <p>Each step opens the part of the record that does that work today.</p>
        </div>
        <ol className="d-steps">
          {JOURNEY.map((j, n) => (
            <li key={j.step}>
              <a href={j.href}>
                <span className="d-steps__n" aria-hidden="true">
                  {String(n + 1).padStart(2, '0')}
                </span>
                <span>
                  <b>{j.step}</b>
                  <span className="d-steps__t">{j.text}</span>
                </span>
                <span className="d-steps__w">{j.where} →</span>
              </a>
            </li>
          ))}
        </ol>
      </section>

      <section className="d-sec am-wrap" aria-labelledby="state-title">
        <div className="d-sec__side">
          <p className="d-over">State of the record</p>
          <h2 className="d-h2" id="state-title">
            Honest numbers, including the unfinished ones
          </h2>
          <dl className="d-mini">
            <div>
              <dt>Public revisions, hash-locked</dt>
              <dd>{publicRevisions.length}</dd>
            </div>
            <div>
              <dt>
                Revisions verified by an editor
                <Cite n={1} scope="state" />
              </dt>
              <dd>{editorVerified}</dd>
            </div>
            <div>
              <dt>Externally reviewed</dt>
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
        <div className="d-card">
          <LiveChecks initial={initialChecks} builtAt={builtAt} />
          <h3 className="d-h3">Latest changes</h3>
          <ul className="d-feed">
            {feed.map(({ code, revision }) => (
              <li key={`${code}@${revision.rev}`}>
                <Link className="d-code" href={`/claims/${code}`}>
                  {code} r{revision.rev}
                </Link>
                <span className="d-feed__s">{short(revision.statement, 110)}</span>
                <span className="d-feed__d">{formatDate(revision.publishedAt)}</span>
              </li>
            ))}
          </ul>
          <p className="d-it__m">
            <Link href="/changelog">Full changelog</Link> · <Link href="/status">Service status</Link>
          </p>
        </div>
      </section>

      <section className="d-sec am-wrap" aria-labelledby="ways-title">
        <div className="d-sec__side">
          <p className="d-over">Ways in</p>
          <h2 className="d-h2" id="ways-title">
            For readers, researchers, institutions and builders
          </h2>
        </div>
        <ul className="d-list d-list--plain">
          {WAYS_IN.map((w) => (
            <li key={w.who}>
              <Link href={w.href}>
                <span className="d-list__b">
                  <span className="d-list__f">{w.chips.join(' · ')}</span>
                  <span className="d-list__t">{w.who}</span>
                  <span className="d-list__p">{w.text}</span>
                </span>
                <span className="d-list__ar" aria-hidden="true">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

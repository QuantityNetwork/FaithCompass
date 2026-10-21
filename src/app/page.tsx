import type { Metadata } from 'next';
import Link from 'next/link';
import { ReviewChip } from '@/components/ds/status';
import { Cite, Footnotes } from '@/components/ds/footnotes';
import { CovenantWord } from '@/components/home/covenant-word';
import { FocusTabs } from '@/components/home/focus-tabs';
import { LiveChecks, type LiveCheck } from '@/components/home/live-record';
import { DecisionTwinLogo } from '@/components/decision/brand';
import { PaletteButton } from '@/components/shell/palette-button';
import { checkRecord } from '@/lib/record/integrity';
import { getRecord } from '@/lib/record/record';
import { CLASSIFICATION_META, isEditorVerified } from '@/lib/record/taxonomy';
import './home.css';

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
  {
    who: 'Decision Room',
    text: 'Sagolik Institutional, the same method applied to decisions: a room per decision with its evidence, findings, review and passport, for named workspace members. A sample room on fictional data is public. Not validated by any institution.',
    href: '/institutional/decision-room',
    chips: ['Institutional', 'Sample room'],
  },
  {
    who: 'Evidence workspace',
    text: 'Private workspaces for named members: import documents, propose decisions that cite them, have a second person review each one, and export a record that verifies offline.',
    href: '/institutional/workspace',
    chips: ['Institutional', 'Members'],
  },
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

  const latest = record.history().filter(({ revision }) => revision.status !== 'draft').slice(0, 6);

  const register: Array<{ n: number; label: string; href: string }> = [
    { n: claims.length, label: 'Claims', href: '/claims' },
    { n: record.data.works.length, label: 'Works cited', href: '/corpus' },
    { n: record.data.traditions.length, label: 'Traditions', href: '/traditions' },
    { n: derivations.length, label: 'Derivations', href: '/hermeneutics' },
    { n: publicRevisions.length, label: 'Public revisions, hash-locked', href: '/changelog' },
    { n: editorVerified, label: 'Verified by a named editor', href: '/about#editorial' },
    { n: externallyReviewed, label: 'Externally reviewed', href: '/status' },
  ];

  return (
    <main id="main" className="d-home h-home">
      <section className="h-hero" aria-labelledby="hero-title">
        <div className="am-wrap h-hero__in">
          <div className="h-hero__text">
            <p className="h-kicker">AbrahamMoses · Structured Theological Intelligence</p>
            <h1 id="hero-title" className="h-title">
              The Abrahamic traditions, set out claim by claim and <em>traced to their sources.</em>
            </h1>
            <p className="h-lead">
              A research record in which every statement names its passage and edition, says what kind of claim it is,
              and shows who holds it, who disputes it and what it depends on.
            </p>
            <form className="h-ask" action="/research/ask" method="post" role="search" aria-label="Research the record">
              <label className="h-ask__label" htmlFor="home-q">
                Research question
              </label>
              <div className="h-ask__row">
                <input id="home-q" name="q" type="search" autoComplete="off" placeholder="Ask the record…" required />
                <button type="submit">Research</button>
              </div>
            </form>
            <p className="h-try">
              <span className="h-try__k">Studies in the record:</span>{' '}
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
          <figure className="h-plate" aria-label="The word covenant in three scripts">
            <CovenantWord />
          </figure>
        </div>
      </section>

      <section className="h-register" aria-labelledby="register-title">
        <div className="am-wrap">
          <div className="h-register__head">
            <h2 id="register-title" className="h-label">
              State of the record
            </h2>
            <p className="h-register__as">Counted from the record as built, {builtAt}</p>
          </div>
          <table className="h-figures">
            <caption className="am-sr">State of the record: counts of claims, sources, revisions and review</caption>
            <thead>
              <tr>
                {register.map((r) => (
                  <th key={r.label} scope="col">
                    <Link href={r.href}>{r.label}</Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {register.map((r) => (
                  <td key={r.label} data-label={r.label}>
                    {r.n}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <p className="h-note">
            Named editors and reviewers are not yet published, and no external review has taken place. Records carried over
            from the earlier Claim Ledger are not counted as verified, because no reviewer was recorded for them. See the{' '}
            <Link href="/status">service status</Link> and <Link href="/about#editorial">editorial responsibility</Link>.
          </p>
        </div>
      </section>

      <section className="h-sec am-wrap" aria-labelledby="ledger-title">
        <header className="h-sec__head">
          <p className="h-label">I · The claims register</p>
          <h2 className="h-h2" id="ledger-title">
            Latest public revisions
          </h2>
          <p className="h-sec__intro">
            Each claim is revisioned and hash-locked; a correction is a new revision, never an overwrite.
          </p>
        </header>
        <div>
        <div className="h-tablewrap" role="region" aria-labelledby="ledger-title" tabIndex={0}>
          <table className="h-table">
            <thead>
              <tr>
                <th scope="col">Claim</th>
                <th scope="col">Statement</th>
                <th scope="col">Kind of claim</th>
                <th scope="col">Review</th>
                <th scope="col" className="h-num">
                  Published
                </th>
              </tr>
            </thead>
            <tbody>
              {latest.map(({ code, revision }) => (
                <tr key={`${code}@${revision.rev}`}>
                  <th scope="row">
                    <Link className="h-code" href={`/claims/${code}`}>
                      {code}
                    </Link>
                    <span className="h-rev">r{revision.rev}</span>
                  </th>
                  <td className="h-stmt">{short(revision.statement, 150)}</td>
                  <td>{CLASSIFICATION_META[revision.classification]?.label ?? revision.classification}</td>
                  <td>
                    <ReviewChip status={revision.status} short />
                  </td>
                  <td className="h-num">{formatDate(revision.publishedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="h-more">
          <Link href="/claims">
            Open the Claim Ledger: all {claims.length} claims <span aria-hidden="true">→</span>
          </Link>
          <Link href="/changelog">Full changelog</Link>
        </p>
        </div>
      </section>

      <section className="h-sec am-wrap" aria-labelledby="coverage-title">
        <header className="h-sec__head">
          <p className="h-label">II · Studies</p>
          <h2 className="h-h2" id="coverage-title">
            Questions the record can already answer
          </h2>
          <p className="h-sec__intro">Four studies, each asked in the terms of its own tradition.</p>
        </header>
        <ol className="h-studies">
          {cases.map((c) => {
            const g = FIELD_GLYPH[c.field];
            return (
              <li key={c.slug}>
                <Link href={`/research/${c.slug}`}>
                  <span className={`h-studies__g d-list__g ${g?.cls ?? 'en'}`} aria-hidden="true">
                    <span lang={g?.lang}>{g?.text ?? '§'}</span>
                  </span>
                  <span className="h-studies__b">
                    <span className="h-studies__f">{FIELD_LABEL[c.field] ?? c.title}</span>
                    <span className="h-studies__t">{c.title}</span>
                    <span className="h-studies__q">{c.question}</span>
                  </span>
                  <span className="h-studies__m">
                    <span>
                      <b>{record.claimsInCase(c.slug).length}</b> claims
                    </span>
                    <span>
                      <b>{c.positions.length}</b> positions
                    </span>
                    <ReviewChip status={c.status} short />
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="h-sec am-wrap" aria-labelledby="separation-title">
        <header className="h-sec__head">
          <p className="h-label">III · Method</p>
          <h2 className="h-h2" id="separation-title">
            What every answer separates
          </h2>
          <p className="h-sec__intro">Evidence, interpretation and inference are never blended.</p>
        </header>
        <div>
          <p className="d-dq h-dq">{JOURNEY_Q}</p>
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
          <p className="h-more">
            <Link href="/research?dossier=covenants">
              Open the covenant dossier <span aria-hidden="true">→</span>
            </Link>
          </p>
        </div>
      </section>

      <section className="h-sec am-wrap" aria-labelledby="journey-title">
        <header className="h-sec__head">
          <p className="h-label">IV · Procedure</p>
          <h2 className="h-h2" id="journey-title">
            From a question to an accountable dossier
          </h2>
          <p className="h-sec__intro">Each step opens the part of the record that does that work today.</p>
        </header>
        <ol className="h-steps">
          {JOURNEY.map((j, n) => (
            <li key={j.step}>
              <a href={j.href}>
                <span className="h-steps__n" aria-hidden="true">
                  {String(n + 1).padStart(2, '0')}
                </span>
                <span className="h-steps__s">{j.step}</span>
                <span className="h-steps__t">{j.text}</span>
                <span className="h-steps__w">{j.where}</span>
              </a>
            </li>
          ))}
        </ol>
      </section>

      <section className="h-sec am-wrap" aria-labelledby="state-title">
        <header className="h-sec__head">
          <p className="h-label">V · Accountability</p>
          <h2 className="h-h2" id="state-title">
            The service checks itself
          </h2>
          <p className="h-sec__intro">
            Live self-tests run on every visit. The counts above are taken from the record, including the unfinished
            ones.
            <Cite n={1} scope="state" />
          </p>
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
        </header>
        <div className="h-panel">
          <LiveChecks initial={initialChecks} builtAt={builtAt} />
          <p className="h-panel__links">
            <Link href="/changelog">Full changelog</Link> · <Link href="/status">Service status</Link>
          </p>
        </div>
      </section>

      <section className="h-inst" aria-labelledby="inst-title">
        <div className="am-wrap h-inst__in">
          <div className="h-inst__mark">
            <DecisionTwinLogo height={92} />
          </div>
          <div>
            <p className="h-label">VI · Institutional application</p>
            <h2 className="h-h2" id="inst-title">
              Sagolik Institutional: the same method, applied to decisions
            </h2>
            <p>
              The AbrahamMoses Decision Twin keeps a versioned record of why an institutional decision was justified, what
              could invalidate it and who approved it. Today the evidence workspace, the Decision Room, Deep Analysis and
              Decision Passport issuing serve named workspace members, and a public sample room shows one fictional private credit case with synthetic data. It has not been
              reviewed, validated or used by any institution.
            </p>
            <p className="h-more">
              <Link href="/institutional/decision-room">
                Open the Decision Room <span aria-hidden="true">→</span>
              </Link>
              <Link href="/institutional/decision-room/sample">The sample room (synthetic case)</Link>
              <Link href="/institutional/decision-twin">The Decision Twin and its terms</Link>
            </p>
          </div>
        </div>
      </section>

      <section className="h-sec am-wrap" aria-labelledby="ways-title">
        <header className="h-sec__head">
          <p className="h-label">VII · Ways in</p>
          <h2 className="h-h2" id="ways-title">
            For readers, researchers, institutions and builders
          </h2>
        </header>
        <ul className="h-ways">
          {WAYS_IN.map((w) => (
            <li key={w.who}>
              <Link href={w.href}>
                <span className="h-ways__f">{w.chips.join(' · ')}</span>
                <span className="h-ways__t">{w.who}</span>
                <span className="h-ways__p">{w.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { ReviewChip } from '@/components/ds/status';
import { CORPUS_ENTRIES } from '@/lib/evidence/corpus/documents';
import { SEEDED_SUBJECTS } from '@/lib/evidence/seed';
import { canPersist } from '@/lib/evidence/store';
import { getRecord } from '@/lib/record/record';
import { REVISION_STATUSES } from '@/lib/record/taxonomy';
import { OPERATOR, legalContact } from '@/lib/site/config';

export const metadata: Metadata = {
  title: 'Institutional',
  description:
    'For libraries, faculties and publishers: who is responsible for AbrahamMoses, how the record is governed, what review has taken place and what is still outstanding.',
  alternates: { canonical: '/institutional' },
};

const DOCS: Array<{ title: string; text: string; links: Array<{ href: string; label: string }> }> = [
  {
    title: 'Who is responsible',
    text: 'What AbrahamMoses is and is not, its relationship to Sagolik, and where editorial responsibility rests.',
    links: [
      { href: '/about#status', label: 'Organisational status' },
      { href: '/about#editorial', label: 'Editorial responsibility' },
      { href: '/about#relationships', label: 'Sagolik, Doctrine Lab and other clients' },
    ],
  },
  {
    title: 'How the record is governed',
    text: 'Publication states, immutable revisions, editorial standards and the known limitations of the record.',
    links: [
      { href: '/methodology#publication', label: 'Publication states and revisions' },
      { href: '/methodology#editorial', label: 'Editorial standards' },
      { href: '/methodology#limitations', label: 'Limitations' },
      { href: '/about#governance', label: 'Governance and accountability' },
    ],
  },
  {
    title: 'What changed, and whether it works',
    text: 'Every public revision and status correction, and live self-tests of the site, API and MCP server.',
    links: [
      { href: '/changelog', label: 'Changelog' },
      { href: '/changelog#status-corrections', label: 'Status corrections' },
      { href: '/status', label: 'Service status' },
    ],
  },
  {
    title: 'Integration and terms',
    text: 'Programmatic access to the same records and review states, and the terms and privacy notice that apply.',
    links: [
      { href: '/developers', label: 'REST API and MCP server' },
      { href: '/terms', label: 'Terms of use' },
      { href: '/privacy', label: 'Privacy' },
    ],
  },
];

export default function InstitutionalPage() {
  const record = getRecord();
  const revisions = record.data.claims.flatMap((c) => c.revisions).filter((r) => r.status !== 'draft');
  const byStatus = REVISION_STATUSES.filter((s) => s !== 'draft').map((s) => ({ status: s, n: revisions.filter((r) => r.status === s).length }));
  const contact = legalContact();
  // Distinct named reviewers recorded on any revision (editorial or external).
  const reviewers = new Set(
    record.data.claims.flatMap((c) => c.revisions.flatMap((r) => r.editorial.reviewers.map((x) => x.name))),
  );
  const externallyVerifiedSources = CORPUS_ENTRIES.filter((e) => e.verified === 'VERIFIED').length;
  const glance: Array<{ n: number; label: string }> = [
    { n: record.data.claims.length, label: 'claims' },
    { n: record.data.works.length, label: 'works in the corpus' },
    { n: CORPUS_ENTRIES.length, label: 'sources in the evidence registry' },
    {
      n: externallyVerifiedSources,
      label: 'sources verified against an external catalogue',
    },
    {
      n: SEEDED_SUBJECTS.length,
      label: 'evidence assessments, all awaiting editorial review',
    },
    { n: reviewers.size, label: 'named reviewers on record' },
  ];

  return (
    <main id="main" className="am-page">
      <div className="am-wrap">
        <header className="am-page__head">
          <p className="am-eyebrow">Institutional</p>
          <h1 className="am-h1">Governance, review and accountability</h1>
          <p className="am-lede">
            For libraries, faculties and publishers deciding whether to rely on the record. {OPERATOR.statement} AbrahamMoses
            is not an accredited institution and not a religious authority; this page gathers what it does publish about
            responsibility, review and change.
          </p>
        </header>

        <section className="am-section" aria-labelledby="glance-title">
          <div className="am-section__head">
            <p className="am-eyebrow">The record at a glance</p>
            <h2 className="am-h2" id="glance-title">
              What exists today
            </h2>
          </div>
          <ul className="am-inst-states">
            {glance.map(({ n, label }) => (
              <li key={label}>
                <span className="am-inst-states__n">{n}</span>
                <span>{label}</span>
              </li>
            ))}
          </ul>
          <p className="am-tiny">
            Challenges to an evidence assessment are taken as proposals for editorial review and never change a
            published assessment by themselves.{' '}
            {canPersist()
              ? 'New analyses and challenges are stored privately until an editor reviews them.'
              : 'This deployment has no database, so new analyses and challenges are not accepted yet.'}
          </p>
        </section>

        <section className="am-section" id="decision-room" aria-labelledby="dr-title">
          <div className="am-section__head">
            <p className="am-eyebrow">Sagolik Institutional · Demonstration</p>
            <h2 className="am-h2" id="dr-title">
              AbrahamMoses and Sagolik Institutional
            </h2>
          </div>
          <div className="am-grid2">
            <div>
              <h3 className="am-h3">AbrahamMoses</h3>
              <p>
                A scholarly research record: claims about the Abrahamic traditions, each tied to its sources, the assumptions it
                rests on and what depends on it. Everything on this site outside the Decision Room is AbrahamMoses.
              </p>
            </div>
            <div>
              <h3 className="am-h3">Sagolik Institutional (proposed)</h3>
              <p>
                A proposed commercial application of the same method to institutional decisions. It exists today only as a
                public demonstration on fictional data. It has not been validated, reviewed or used by any bank, fund or
                institution, and no private client data is accepted.
              </p>
            </div>
          </div>
          <p>
            <Link className="am-btn am-btn--gold" href="/institutional/decision-room">
              Open the Decision Room
            </Link>{' '}
            <span className="am-tiny">A synthetic $120M private credit facility, traced from ten documents to a reproducible Decision Passport.</span>
          </p>
        </section>

        <section className="am-section" aria-labelledby="review-title">
          <div className="am-section__head">
            <p className="am-eyebrow">Review today</p>
            <h2 className="am-h2" id="review-title">
              Where the {revisions.length} public revisions stand
            </h2>
          </div>
          <ul className="am-inst-states">
            {byStatus.map(({ status, n }) => (
              <li key={status}>
                <span className="am-inst-states__n">{n}</span>
                <ReviewChip status={status} />
              </li>
            ))}
          </ul>
          <p className="am-tiny">
            Counted from the record this page was built from. Named editors and external reviewers will be listed, on the{' '}
            <Link href="/about#editorial">About page</Link> and on every revision they review, as they are appointed; the record
            does not attribute review to anyone who has not done it.
          </p>
        </section>

        <section className="am-section" aria-labelledby="docs-title">
          <div className="am-section__head">
            <p className="am-eyebrow">Published documentation</p>
            <h2 className="am-h2" id="docs-title">
              What to read before relying on the record
            </h2>
          </div>
          <div className="am-cols4">
            {DOCS.map((d) => (
              <section className="am-col" key={d.title} aria-label={d.title}>
                <div className="am-col__h">
                  <h3>{d.title}</h3>
                  <p>{d.text}</p>
                </div>
                <ul className="am-col__b am-linklist">
                  {d.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href}>{l.label}</Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </section>

        <section className="am-section" aria-labelledby="contact-title">
          <div className="am-section__head">
            <p className="am-eyebrow">Contact</p>
            <h2 className="am-h2" id="contact-title">
              Corrections and enquiries
            </h2>
          </div>
          <p>
            {contact.general ? (
              <>
                Write to <a href={`mailto:${contact.general}`}>{contact.general}</a> and cite the claim code.
              </>
            ) : (
              <>A contact address for corrections and enquiries will be published here and on the About page.</>
            )}
          </p>
        </section>
      </div>
    </main>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { PageIntro, Section } from '@/components/record/ui';
import { getRecord } from '@/lib/record/record';
import { OPERATOR, legalContact } from '@/lib/site/config';

export const metadata: Metadata = {
  title: 'About and governance',
  description:
    'What AbrahamMoses is, who is responsible for it, how it relates to Sagolik and Doctrine Lab, and how its editorial work is governed.',
  alternates: { canonical: '/about' },
};

function RelationshipDiagram() {
  const box = (x: number, y: number, w: number, title: string, sub: string, strong = false) => (
    <g>
      <rect x={x} y={y} width={w} height={64} rx={2} strokeWidth={strong ? 1.8 : 1.1} style={{ fill: 'var(--ground-inset)', stroke: strong ? 'var(--gold)' : 'var(--rule-strong)' }} />
      <text x={x + w / 2} y={y + 27} textAnchor="middle" fontSize="16" style={{ fill: 'var(--ink-strong)', fontFamily: 'var(--serif)' }}>
        {title}
      </text>
      <text x={x + w / 2} y={y + 47} textAnchor="middle" fontSize="11" style={{ fill: 'var(--ink-muted)', fontFamily: 'var(--sans)' }}>
        {sub}
      </text>
    </g>
  );
  const arrow = (x1: number, y1: number, x2: number, y2: number, label: string, lx: number, ly: number) => (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={1.2} markerEnd="url(#rel-arrow)" style={{ stroke: 'var(--gold-dim)' }} />
      <text x={lx} y={ly} textAnchor="middle" fontSize="11" style={{ fill: 'var(--ink-faint)', fontFamily: 'var(--sans)' }}>
        {label}
      </text>
    </g>
  );
  return (
    <figure className="diagram" style={{ margin: 0 }}>
      <svg viewBox="0 0 720 330" role="img" aria-labelledby="rel-title rel-desc" style={{ width: '100%', height: 'auto', display: 'block' }}>
        <title id="rel-title">Relationships between Sagolik, AbrahamMoses and its clients</title>
        <desc id="rel-desc">
          Sagolik owns, writes and operates AbrahamMoses. AbrahamMoses publishes a read-only REST API and MCP server. Doctrine
          Lab, the Sagolik Sandbox and independent AI agents and research tools read the record through those public interfaces.
        </desc>
        <defs>
          <marker id="rel-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" style={{ fill: 'var(--gold-dim)' }} />
          </marker>
        </defs>
        {box(260, 10, 200, 'Sagolik', 'Owner · author · operator')}
        {arrow(360, 74, 360, 124, 'owns, writes and operates', 470, 104)}
        {box(230, 126, 260, 'AbrahamMoses', 'The record · REST API v1 · MCP server', true)}
        {arrow(300, 190, 120, 252, 'public, read-only', 170, 214)}
        {arrow(360, 190, 360, 252, 'public, read-only', 420, 226)}
        {arrow(420, 190, 600, 252, 'public, read-only', 560, 214)}
        {box(20, 254, 200, 'Doctrine Lab', 'Research application')}
        {box(260, 254, 200, 'Sagolik Sandbox', 'Sagolik environment')}
        {box(500, 254, 200, 'Agents and tools', 'Any MCP or HTTP client')}
      </svg>
      <figcaption className="small faint" style={{ marginTop: 10 }}>
        Every client reads the same public interfaces; none edits the record. Editorial responsibility rests with AbrahamMoses
        editorial at Sagolik.
      </figcaption>
    </figure>
  );
}

export default function AboutPage() {
  const record = getRecord();
  const contact = legalContact();
  const revisions = record.data.claims.flatMap((c) => c.revisions);
  const verified = revisions.filter((r) => r.status === 'published' || r.status === 'externally_reviewed').length;
  const reviewed = revisions.filter((r) => r.status === 'externally_reviewed').length;

  return (
    <main id="main" className="shell page">
      <PageIntro
        eyebrow="About AbrahamMoses"
        title="What AbrahamMoses is — and is not"
        lede="AbrahamMoses is a research product: a structured, revisioned record of theological sources, claims and interpretations, with public interfaces for people and machines. It is written, built and owned by Sagolik."
      />

      <Section id="status" title="Organisational status">
        <div className="prose-block">
          <ul>
            <li>
              <strong>A Sagolik product, not an independent body.</strong> {OPERATOR.statement} AbrahamMoses has no legal
              existence of its own.
            </li>
            <li>
              <strong>Not an accredited institution.</strong> It is not a university, institute or degree-granting body, and
              it makes no claim of accreditation, endorsement by a religious authority, or institutional independence.
            </li>
            <li>
              <strong>Not a religious authority.</strong> It records what texts say and what traditions hold, with attribution.
              Inclusion of a source or tradition does not constitute endorsement, and the record ranks no religion.
            </li>
          </ul>
        </div>
      </Section>

      <Section id="relationships" title="Sagolik, Doctrine Lab and other clients">
        <RelationshipDiagram />
      </Section>

      <Section id="editorial" title="Editorial responsibility">
        <div className="prose-block">
          <p>
            Editorial responsibility for the record rests with <strong>AbrahamMoses editorial at Sagolik</strong>, named as the
            author of every revision. The editorial standards, review levels and correction policy are set out in the{' '}
            <Link className="link" href="/methodology#editorial">
              methodology
            </Link>
            .
          </p>
          <p>
            Of {revisions.length} public revisions, <strong>{verified}</strong> {verified === 1 ? 'has' : 'have'} a recorded
            verification by a named editor and <strong>{reviewed}</strong> {reviewed === 1 ? 'has' : 'have'} been externally
            reviewed. The rest are provisional, awaiting editorial review, and say so wherever they appear. That includes the
            records carried over from the earlier Claim Ledger: they were shown there as published, but no reviewer was ever
            recorded for them, so they are not counted as verified here. Named
            editors and external reviewers from each tradition will be listed here, and on every revision they review, as they
            are appointed; the record does not attribute review to anyone who has not done it.
          </p>
        </div>
      </Section>

      <Section id="governance" title="Governance and accountability">
        <div className="prose-block">
          <ul>
            <li>
              Every revision is permanent and citable; corrections append, never overwrite. The one exception, a correction of
              status only, is listed with its reason on the <Link className="link" href="/changelog#status-corrections">changelog</Link>.
            </li>
            <li>Every revision discloses whether AI assisted and whether an editor has verified it.</li>
            <li>
              The <Link className="link" href="/changelog">changelog</Link> and the{' '}
              <Link className="link" href="/status">status page</Link> are public, including outstanding editorial work.
            </li>
            <li>The full record can be exported and independently checked against its pinned revision hashes.</li>
          </ul>
          <p>
            {contact.general ? (
              <>
                Corrections and enquiries: <a className="link" href={`mailto:${contact.general}`}>{contact.general}</a>. Please
                cite the claim code.
              </>
            ) : (
              <>A contact address for corrections and enquiries will be published here.</>
            )}
          </p>
        </div>
      </Section>

      <Section id="identity" title="Identity">
        <p className="prose-block" style={{ marginTop: 0 }}>
          This site uses the AbrahamMoses wordmark only. Partner products are named in text and keep their own identities; no
          partner logo is reproduced here.
        </p>
      </Section>
    </main>
  );
}

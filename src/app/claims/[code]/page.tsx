import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AcceptanceGrid,
  CodeLink,
  ConfidenceAxes,
  DerivationCard,
  JsonLd,
  ProvenanceChain,
  ProvisionalNotice,
  Refs,
  Section,
  StatusPill,
} from '@/components/record/ui';
import { CopyButton } from '@/components/ui/copy-button';
import { getCitation } from '@/lib/api/operations';
import { claimView } from '@/lib/api/views';
import { getRecord } from '@/lib/record/record';
import type { ClaimRevision } from '@/lib/record/schema';
import { REVIEW_STATE_LABELS, ROLE_META, isEditorVerified, type RevisionStatus } from '@/lib/record/taxonomy';
import { absoluteUrl } from '@/lib/site/config';
import { param, type SearchParams } from '@/lib/site/explorer';

type Props = { params: Promise<{ code: string }>; searchParams: Promise<SearchParams> };

export function generateStaticParams() {
  return getRecord().data.claims.map((c) => ({ code: c.code }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const record = getRecord();
  const claim = record.claim(code);
  if (!claim) return {};
  const r = record.current(claim);
  return {
    title: `${claim.code} — ${r.statement.slice(0, 80)}`,
    description: `${r.statement} ${r.interpretiveDivergence}`.slice(0, 300),
    alternates: { canonical: `/claims/${claim.code}` },
    openGraph: { title: r.statement, description: r.interpretiveDivergence.slice(0, 300), type: 'article' },
  };
}

function diff(prev: ClaimRevision, next: ClaimRevision): Array<{ field: string; before: string; after: string }> {
  const fields: Array<[string, (r: ClaimRevision) => string]> = [
    ['Statement', (r) => r.statement],
    ['Classification', (r) => r.classification],
    ['Disputed', (r) => r.disputed],
    ['Interpretive divergence', (r) => r.interpretiveDivergence],
    ['Primary witnesses', (r) => r.primaryWitnesses.map((w) => w.display).join('; ')],
    ['Evidence notes', (r) => `${r.evidence.length} recorded`],
    ['Quotations', (r) => `${r.quotations.length} recorded`],
    ['Variants', (r) => `${r.variants.length} recorded`],
    ['Confidence profile', (r) => (r.confidence ? 'Recorded on four axes' : 'Not recorded')],
    ['Tradition acceptance', (r) => `${r.acceptance.length} traditions recorded`],
    ['Status', (r) => r.status],
    ['Machine involvement', (r) => r.machine.level],
  ];
  return fields
    .map(([field, get]) => ({ field, before: get(prev), after: get(next) }))
    .filter((d) => d.before !== d.after);
}

export default async function ClaimPage({ params, searchParams }: Props) {
  const { code } = await params;
  const sp = await searchParams;
  const record = getRecord();
  const claim = record.claim(code);
  if (!claim) notFound();
  const requested = Number(param(sp, 'rev'));
  const rev = Number.isInteger(requested) && record.revision(claim, requested) ? requested : undefined;
  const view = claimView(record, claim, rev);
  const current = record.current(claim);
  const isCurrent = view.revision === current.rev;
  const citation = getCitation(record, claim.code, view.revision);
  const revision = record.revision(claim, view.revision)!;
  const prev = view.revision > 1 ? record.revision(claim, view.revision - 1) : undefined;

  return (
    <main id="main" className="shell page">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Claim',
          identifier: claim.code,
          text: view.statement,
          url: absoluteUrl(`/claims/${claim.code}`),
          datePublished: view.published_at,
          version: view.revision,
          author: { '@type': 'Organization', name: view.editorial.author },
          appearance: view.witnesses.map((w) => ({ '@type': 'CreativeWork', name: `${w.display} (${w.edition})` })),
        }}
      />
      <p className="eyebrow">
        Claim Ledger · {ROLE_META[claim.role as keyof typeof ROLE_META].label} · {view.topic}
      </p>
      <div className="claim-card__head" style={{ fontSize: 12 }}>
        <span className="code-inline">{claim.code}</span>
        <span>revision {view.revision} of {claim.revisions.length}</span>
        <StatusPill status={view.status} />
        <span>{view.classification_label}</span>
      </div>
      <h1 className="display display--statement" style={{ fontSize: 'clamp(30px, 4vw, 46px)', marginTop: 14 }}>
        {view.statement}
      </h1>
      {!isCurrent ? (
        <p className="status-notice" role="note">
          <strong>You are reading revision {view.revision}.</strong> It is preserved unchanged so that citations to it stay
          valid. <Link className="link" href={`/claims/${claim.code}`}>Read the current revision ({current.rev})</Link>.
        </p>
      ) : null}
      <ProvisionalNotice subject="This revision" status={view.status} machine={view.machine_involvement.level} />

      <div className="grid-3 section--tight">
        <div className="card">
          <div className="card__meta">Disputed</div>
          <p style={{ margin: '6px 0 0' }}>{view.disputed}</p>
        </div>
        <div className="card">
          <div className="card__meta">Review state</div>
          <p style={{ margin: '6px 0 0' }}>{REVIEW_STATE_LABELS[view.status as RevisionStatus] ?? view.status}</p>
          <p className="small faint" style={{ margin: '4px 0 0' }}>
            {isEditorVerified(view.status as RevisionStatus)
              ? `Verified by ${view.editorial.reviewers.map((r) => r.name).join(', ')}.`
              : view.machine_involvement.level === 'not_recorded'
                ? 'From the earlier Claim Ledger; no reviewer or AI involvement was recorded.'
                : `${view.machine_involvement.label}; editorial verification pending.`}
          </p>
        </div>
        <div className="card">
          <div className="card__meta">Where interpretation diverges</div>
          <p style={{ margin: '6px 0 0' }}>{view.interpretive_divergence}</p>
        </div>
      </div>

      <Section id="confidence" title="Confidence, on separate axes" eyebrow="Never combined">
        {!isEditorVerified(view.status as RevisionStatus) && view.confidence ? (
          <p className="small faint" style={{ marginTop: 0 }}>
            Levels as proposed in the draft. They have not yet been verified by an editor and may change on review.
          </p>
        ) : null}
        <ConfidenceAxes confidence={view.confidence} />
      </Section>

      <Section id="acceptance" title="Traditional acceptance" eyebrow="Fifth axis">
        <AcceptanceGrid acceptance={view.acceptance} />
      </Section>

      <Section id="sources" title="Witnesses, editions and evidence">
        <div className="table-wrap">
          <table className="table table--stack">
            <thead>
              <tr>
                <th scope="col">Primary witness</th>
                <th scope="col">Work</th>
                <th scope="col">Edition cited</th>
              </tr>
            </thead>
            <tbody>
              {view.witnesses.map((w) => (
                <tr key={w.display}>
                  <td data-label="Primary witness">{w.display}</td>
                  <td data-label="Work">{w.work_title}</td>
                  <td data-label="Edition cited">{w.edition}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {view.evidence.length ? (
          <>
            <h3 className="subheading section--tight">Evidence</h3>
            <ul className="reasons-plain" style={{ fontSize: 14 }}>
              {view.evidence.map((e) => (
                <li key={e.reference.display}>
                  <strong>{e.reference.display}</strong>
                  {e.note ? ` — ${e.note}` : ''} <span className="faint">({e.reference.edition})</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <h3 className="subheading section--tight">Quotations and translations</h3>
        {view.quotations.length ? (
          <ul className="reasons-plain" style={{ fontSize: 14 }}>
            {view.quotations.map((q) => (
              <li key={q.text}>
                “{q.text}” — {q.reference.display}.{' '}
                {q.translation ? (
                  <>
                    Translation: {q.translation.name}. {q.translation.license}{' '}
                    {q.translation.verified ? '' : <span className="faint">(not yet verified by an editor)</span>}
                  </>
                ) : (
                  'Original-language wording; no translation involved.'
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="small muted">The claim quotes no translated wording.</p>
        )}
        <h3 className="subheading section--tight">Textual variants</h3>
        {view.variants.length ? (
          <ul className="reasons-plain" style={{ fontSize: 14 }}>
            {view.variants.map((v) => (
              <li key={v.reference.display}>
                <strong>{v.reference.display}</strong> ({v.bearing} bearing on the claim) — {v.description}
              </li>
            ))}
          </ul>
        ) : (
          <p className="small muted">No variant bearing on this claim is recorded.</p>
        )}
      </Section>

      <Section id="derivations" title="What this claim rests on">
        {view.grounded_in_witness ? (
          <p className="small muted" style={{ marginTop: 0 }}>
            Grounded in its witness: as a report of what the text says, it remains supported unless it is set aside directly. Any
            argument recorded below is what supports it as a reading.
          </p>
        ) : (
          <p className="small muted" style={{ marginTop: 0 }}>
            A derived claim: it holds only while at least one derivation below holds.
          </p>
        )}
        <div className="stack">
          {view.derivations.length ? (
            view.derivations.map((d) => <DerivationCard key={d.code} derivation={d} />)
          ) : (
            <p className="small faint">No argument is recorded; the claim is a direct report.</p>
          )}
        </div>
        {view.supports.length ? (
          <p className="small" style={{ marginTop: 16 }}>
            Claims that rest on this one: {view.supports.map((c, i) => (
              <span key={c}>
                {i ? ', ' : ''}
                <CodeLink code={c} />
              </span>
            ))}
            .{' '}
            <Link className="link" href={`/hermeneutics?reject=${claim.code}#explorer`}>
              Reject it in the explorer
            </Link>
          </p>
        ) : null}
      </Section>

      {view.counter_models.length ? (
        <Section id="counter-models" title="Counterviews">
          <div className="grid-2">
            {view.counter_models.map((m) => (
              <article className="card" key={m.code}>
                <div className="claim-card__head">
                  <span className="code-inline">{m.code}</span>
                  <span>{m.strength}</span>
                  <StatusPill status={m.status} />
                </div>
                <h3 className="card__title">{m.title}</h3>
                <p className="small muted">{m.held_by}</p>
                <p>{m.thesis}</p>
                <p className="small muted">{m.alternative_reading}</p>
                <p className="small faint">
                  <Refs refs={m.evidence} />
                </p>
              </article>
            ))}
          </div>
        </Section>
      ) : null}

      <Section id="provenance" title="Provenance chain">
        <ProvenanceChain steps={view.provenance} />
        {view.map_links.length ? (
          <p className="small">
            Map connections: {view.map_links.map((l, i) => (
              <span key={`${l.code}-${i}`}>
                {i ? '; ' : ''}
                <CodeLink code={l.code} /> ({l.role})
              </span>
            ))}
          </p>
        ) : null}
      </Section>

      <Section id="editorial" title="Editorial record and machine involvement">
        <div className="grid-2">
          <div className="card">
            <div className="card__meta">Editorial</div>
            <p style={{ margin: '6px 0' }}>Author: {view.editorial.author}</p>
            <p style={{ margin: '6px 0' }}>
              Reviewers:{' '}
              {view.editorial.reviewers.length
                ? view.editorial.reviewers.map((r) => `${r.name} (${r.role}, ${r.date})`).join('; ')
                : 'none recorded — this revision has not been externally reviewed.'}
            </p>
            <p className="small muted" style={{ margin: 0 }}>
              Change note: {view.editorial.change_note}
            </p>
          </div>
          <div className="card">
            <div className="card__meta">Machine involvement</div>
            <p style={{ margin: '6px 0' }}>{view.machine_involvement.label}</p>
            <p className="small muted" style={{ margin: 0 }}>
              {view.machine_involvement.description} Verification: {view.machine_involvement.verification.replace('_', ' ')}.
            </p>
          </div>
        </div>
      </Section>

      <Section id="revisions" title="Revision history" eyebrow="Living record">
        <div className="table-wrap">
          <table className="table table--stack">
            <thead>
              <tr>
                <th scope="col">Revision</th>
                <th scope="col">Status</th>
                <th scope="col">Published</th>
                <th scope="col">Change</th>
              </tr>
            </thead>
            <tbody>
              {view.revisions.map((r) => (
                <tr key={r.rev}>
                  <td data-label="Revision">
                    <Link className="link" href={`/claims/${claim.code}?rev=${r.rev}`} aria-current={r.rev === view.revision ? 'true' : undefined}>
                      Revision {r.rev}
                    </Link>
                  </td>
                  <td data-label="Status">
                    <StatusPill status={r.status} />
                  </td>
                  <td data-label="Published">{r.published_at.slice(0, 10)}</td>
                  <td data-label="Change">{r.change_note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {prev ? (
          <>
            <h3 className="subheading section--tight">
              What changed from revision {prev.rev} to {view.revision}
            </h3>
            <ul className="reasons-plain" style={{ fontSize: 14 }}>
              {diff(prev, revision).map((d) => (
                <li key={d.field}>
                  <strong>{d.field}:</strong> <span className="diff-del">{d.before}</span> → <span className="diff-ins">{d.after}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </Section>

      <Section id="cite" title="Cite this claim">
        <p className="small muted" style={{ marginTop: 0 }}>
          Citations point at revision {view.revision}, which will never change.
        </p>
        <div className="cite-box">{citation.text}</div>
        <div className="button-row">
          <CopyButton text={citation.text} label="Copy citation" />
          <CopyButton text={citation.bibtex} label="Copy BibTeX" />
          <a className="button button--quiet" href={`/api/v1/claims/${claim.code}/citation?rev=${view.revision}`}>
            CSL-JSON
          </a>
          <Link className="button button--quiet" href={`/claims/${claim.code}/report?rev=${view.revision}`}>
            Provenance report
          </Link>
          <a className="button button--quiet" href={`/api/v1/claims/${claim.code}?rev=${view.revision}`}>
            Full record as JSON
          </a>
        </div>
      </Section>
    </main>
  );
}

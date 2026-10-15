/**
 * Server components for presenting the record.
 *
 * They take the same view objects the API serves (src/lib/api/views.ts), so
 * a reader and a machine see the same fields with the same names.
 */

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { z } from 'zod/v4';
import type { AcceptanceV1, ClaimSummaryV1, ClaimV1, DerivationV1, ProvenanceStepV1, ReferenceV1 } from '@/lib/api/views';
import { ACCEPTANCE_META, AXIS_META, CONFIDENCE_AXES, STATUS_META, type AcceptanceStance, type RevisionStatus } from '@/lib/record/taxonomy';

type ClaimSummary = z.infer<typeof ClaimSummaryV1>;
type Claim = z.infer<typeof ClaimV1>;

export function PageIntro({ eyebrow, title, lede, children }: { eyebrow: string; title: ReactNode; lede?: ReactNode; children?: ReactNode }) {
  return (
    <header>
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="display">{title}</h1>
      {lede ? <p className="lede">{lede}</p> : null}
      {children}
    </header>
  );
}

export function StatusPill({ status }: { status: RevisionStatus | string }) {
  const meta = STATUS_META[status as RevisionStatus];
  return (
    <span className={`pill pill--${status}`} title={meta?.definition}>
      {meta?.label ?? status}
    </span>
  );
}

export function ProvisionalNotice({ subject = 'This record', status }: { subject?: string; status: string }) {
  if (status !== 'provisional') return null;
  return (
    <p className="status-notice" role="note">
      <strong>Provisional.</strong> {subject} is public and citable, but its references, wording and confidence levels have
      not yet been verified by an AbrahamMoses editor. It was drafted with AI assistance, which is disclosed on every
      record it affects. <Link className="link" href="/methodology#publication">What provisional means</Link>
    </p>
  );
}

export function Refs({ refs, empty = 'None recorded.' }: { refs: Array<z.infer<typeof ReferenceV1>>; empty?: string }) {
  if (refs.length === 0) return <span className="faint">{empty}</span>;
  return (
    <>
      {refs.map((r, i) => (
        <span key={`${r.display}-${i}`} title={`${r.work_title} — ${r.edition}`}>
          {i > 0 ? '; ' : ''}
          {r.display}
        </span>
      ))}
    </>
  );
}

export function CodeLink({ code }: { code: string }) {
  const href = code.startsWith('AM-CLAIM-')
    ? `/claims/${code}`
    : code.startsWith('AM-AX-')
      ? `/hermeneutics#${code}`
      : code.startsWith('AM-COV-')
        ? `/covenants#${code}`
        : code.startsWith('AM-DOC-')
          ? `/doctrine#${code}`
          : code.startsWith('AM-CM-')
            ? `/hermeneutics#${code}`
            : null;
  return href ? (
    <Link className="code-inline" href={href}>
      {code}
    </Link>
  ) : (
    <span className="code-inline">{code}</span>
  );
}

export function ClaimCard({ claim, children, headingLevel = 3 }: { claim: ClaimSummary; children?: ReactNode; headingLevel?: 2 | 3 | 4 }) {
  const H = `h${headingLevel}` as 'h3';
  return (
    <article className="claim-card">
      <div className="claim-card__head">
        <CodeLink code={claim.code} />
        <span>{claim.classification_label}</span>
        <span>{claim.topic}</span>
        <StatusPill status={claim.status} />
      </div>
      <H className="claim-card__statement" style={{ fontWeight: 400 }}>
        <Link href={`/claims/${claim.code}`}>{claim.statement}</Link>
      </H>
      <p className="claim-card__witnesses">
        <Refs refs={claim.witnesses} />
      </p>
      {children}
    </article>
  );
}

export function ConfidenceAxes({ confidence }: { confidence: Claim['confidence'] }) {
  if (!confidence) {
    return (
      <p className="faint small">
        This revision predates the formal confidence taxonomy. Its headline label is shown above; later revisions record each
        axis separately.
      </p>
    );
  }
  return (
    <div className="axes">
      {CONFIDENCE_AXES.map((key) => {
        const v = confidence[key];
        return (
          <div className="axis" key={key}>
            <div className="axis__name">{AXIS_META[key].label}</div>
            {v.level ? (
              <>
                <div className="axis__level">
                  {v.label} <span className="faint small">· level {v.level} of 5</span>
                </div>
                <div className="axis__steps" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span key={n} className={`axis__step${n <= v.level! ? ' axis__step--on' : ''}`} />
                  ))}
                </div>
              </>
            ) : (
              <div className="axis__level axis__level--na">Not applicable</div>
            )}
            <p className="axis__basis">{v.basis}</p>
          </div>
        );
      })}
    </div>
  );
}

export function AcceptanceGrid({ acceptance, attributionNote }: { acceptance: Array<z.infer<typeof AcceptanceV1>>; attributionNote?: ReactNode }) {
  if (acceptance.length === 0) {
    return (
      <p className="small muted" style={{ maxWidth: '68ch' }}>
        {attributionNote ??
          'As a report of what the text says, this claim is not disputed between traditions. Disagreement begins with the readings built on it, which are recorded as separate claims.'}
      </p>
    );
  }
  return (
    <div className="acceptance">
      {acceptance.map((a) => (
        <div key={a.tradition} className={`stance stance--${a.stance}`}>
          <span className="stance__who">{a.tradition_name}</span>
          <span className="stance__what">{ACCEPTANCE_META[a.stance as AcceptanceStance].label}</span>
          {a.note ? <p style={{ margin: '6px 0 0' }} className="muted">{a.note}</p> : null}
        </div>
      ))}
    </div>
  );
}

export function ProvenanceChain({ steps }: { steps: Array<z.infer<typeof ProvenanceStepV1>> }) {
  return (
    <ol className="chain">
      {steps.map((s) => (
        <li key={s.position}>
          <div className="chain__label">{s.label}</div>
          <div className="chain__detail">{s.detail}</div>
        </li>
      ))}
    </ol>
  );
}

export function DerivationCard({ derivation, status }: { derivation: z.infer<typeof DerivationV1>; status?: ReactNode }) {
  return (
    <div className="derivation" id={derivation.code}>
      <div className="claim-card__head">
        <span className="code-inline">{derivation.code}</span>
        {status}
      </div>
      <div className="derivation__label">{derivation.label}</div>
      <p className="small muted" style={{ margin: '4px 0 0' }}>
        {derivation.summary}
      </p>
      <ul className="premise-list">
        {derivation.premises.map((p) => (
          <li key={p.claim}>
            <CodeLink code={p.claim} />
            <span className={`premise-tag premise-tag--${p.necessity}`}>{p.necessity}</span>
            <span className="premise-tag">{p.type.replace('_', ' ')}</span>
            {p.use === 'warrant' ? <span className="premise-tag">needs warrant</span> : null}
            <div className="muted">{p.rationale}</div>
          </li>
        ))}
        {derivation.axioms.map((a) => (
          <li key={a.axiom}>
            <CodeLink code={a.axiom} /> <span>{a.label}</span>
            <span className={`premise-tag premise-tag--${a.role}`}>{a.role === 'requires' ? 'required' : 'strengthens'}</span>
            {a.note ? <div className="muted">{a.note}</div> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}

export function Section({ id, title, eyebrow, children, intro }: { id?: string; title: string; eyebrow?: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section className="section" id={id} aria-labelledby={id ? `${id}-title` : undefined}>
      {eyebrow ? <p className="chapter-number">{eyebrow}</p> : null}
      <h2 className="section-heading" id={id ? `${id}-title` : undefined}>
        {title}
      </h2>
      {intro ? <p className="lede" style={{ marginTop: 0, marginBottom: 24 }}>{intro}</p> : null}
      {children}
    </section>
  );
}

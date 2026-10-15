import Link from 'next/link';
import type { ReactNode } from 'react';

/** Section navigation for the Evidence Intelligence pages. The site header and footer come from the root layout. */
export function EvidenceNav() {
  return (
    <nav className="lane-legend" aria-label="Evidence Intelligence">
      <Link className="filter-link" href="/evidence">
        Evidence assessments
      </Link>
      <Link className="filter-link" href="/evidence/daniel/12/1">
        Daniel 12:1
      </Link>
      <Link className="filter-link" href="/evidence/method">
        How the figures work
      </Link>
    </nav>
  );
}

export function EvidenceNote() {
  return (
    <aside className="notice" style={{ marginTop: 72 }}>
      <p className="small" style={{ maxWidth: '68ch', margin: 0 }}>
        Every figure shown is an <strong>evidence confidence</strong> — an assessment of how strongly the available
        evidence supports a specific claim. It is not a probability that the claim is true, and AbrahamMoses does not
        score religious traditions. Assessments record the model, prompt version and sources they were produced from,
        and can be challenged.
      </p>
    </aside>
  );
}

export function Page({
  children,
  narrow = false,
}: {
  children: ReactNode;
  narrow?: boolean;
}) {
  return (
    <main id="main" className={narrow ? 'shell shell--narrow page' : 'shell page'}>
      <EvidenceNav />
      {children}
      <EvidenceNote />
    </main>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="section-title">{children}</h2>;
}

export function Tag({
  children,
  variant,
}: {
  children: ReactNode;
  variant?: string;
}) {
  return <span className={variant ? `tag ${variant}` : 'tag'}>{children}</span>;
}

/**
 * A confidence figure.
 *
 * Renders the band, the number and a hairline. When a claim is not scorable, it
 * says so in words and shows no number at all — a zero would read as "the
 * evidence is against it", which is a different and false statement.
 */
export function ConfidenceFigure({
  score,
  label,
  caption,
}: {
  score: number | null;
  label: string;
  caption?: string;
}) {
  const scorable = score !== null;
  return (
    <div>
      {caption ? <div className="profile__label">{caption}</div> : null}
      <div className={`profile__band${scorable ? '' : ' profile__band--na'}`}>{label}</div>
      {scorable ? (
        <div className="profile__score">
          {score}
          <sub>/100</sub>
        </div>
      ) : null}
      <div className={`meter${scorable ? '' : ' meter--muted'}`}>
        <div className="meter__fill" style={{ width: `${scorable ? score : 0}%` }} />
      </div>
    </div>
  );
}

export function ReasonList({
  items,
  variant,
}: {
  items: string[];
  variant: 'plus' | 'minus' | 'neutral';
}) {
  if (items.length === 0) {
    return <p className="small faint">None recorded.</p>;
  }
  return (
    <ul className={`reasons reasons--${variant}`}>
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export function Disclosure({
  title,
  children,
  open = false,
}: {
  title: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details className="disclosure" open={open}>
      <summary>{title}</summary>
      <div className="disclosure__body">{children}</div>
    </details>
  );
}

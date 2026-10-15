import type { Metadata } from 'next';
import Link from 'next/link';
import { PageIntro, StatusPill } from '@/components/record/ui';
import { getRecord } from '@/lib/record/record';

export const metadata: Metadata = {
  title: 'Changelog',
  description: 'Every revision of every claim in the AbrahamMoses record, newest first. Published revisions never change.',
  alternates: { canonical: '/changelog' },
};

export default function ChangelogPage() {
  const record = getRecord();
  const history = record.history();
  const byDay = new Map<string, typeof history>();
  for (const h of history) {
    const day = h.revision.publishedAt.slice(0, 10);
    byDay.set(day, [...(byDay.get(day) ?? []), h]);
  }
  return (
    <main id="main" className="shell page">
      <PageIntro
        eyebrow="Living record"
        title="Changelog"
        lede="Every revision, newest first. A revision, once public, is never edited: corrections are new revisions with a change note, and the earlier text stays readable at its own address."
      />
      {[...byDay.entries()].map(([day, items]) => (
        <section key={day} className="section--tight" aria-labelledby={`d-${day}`}>
          <h2 className="section-title" id={`d-${day}`}>
            {day} · {items.length} revision{items.length === 1 ? '' : 's'}
          </h2>
          <ul className="affected-list">
            {items.map(({ code, revision }) => (
              <li key={`${code}@${revision.rev}`}>
                <div className="claim-card__head">
                  <Link className="code-inline" href={`/claims/${code}?rev=${revision.rev}`}>
                    {code} · rev {revision.rev}
                  </Link>
                  <StatusPill status={revision.status} />
                  <span>{revision.machine.level === 'assisted' ? 'AI-assisted' : revision.machine.level === 'not_recorded' ? 'pre-tracking' : revision.machine.level}</span>
                </div>
                <p style={{ margin: '6px 0 2px' }}>{revision.statement}</p>
                <p className="small faint" style={{ margin: 0 }}>
                  {revision.editorial.changeNote}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="small faint" style={{ marginTop: 24 }}>
        <a className="link" href="/api/v1/changelog">
          JSON
        </a>{' '}
        · MCP tool <code className="code-inline">get_record_history</code>
      </p>
    </main>
  );
}

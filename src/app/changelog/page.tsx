import type { Metadata } from 'next';
import Link from 'next/link';
import { PageIntro, StatusPill } from '@/components/record/ui';
import { getRecord } from '@/lib/record/record';
import { STATUS_CORRECTION_2026_10_20 as CORRECTION } from '@/lib/record/data/corrections';

export const metadata: Metadata = {
  title: 'Changelog',
  description: 'Every revision of every claim in the AbrahamMoses record, newest first. Public revisions never change; the one status correction is listed with its reason.',
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
        lede="Every revision, newest first. A revision, once public, is never edited: corrections are new revisions with a change note, and the earlier text stays readable at its own address. The one exception, a correction of status only, is listed at the end with its reason."
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
      <section className="section--tight" id="status-corrections" aria-labelledby="status-corrections-title">
        <h2 className="section-title" id="status-corrections-title">
          Status corrections
        </h2>
        <p className="small" style={{ maxWidth: '72ch' }}>
          {CORRECTION.date}: revision 1 of {CORRECTION.revisions.length} claims corrected from <strong>{CORRECTION.from}</strong> to{' '}
          <strong>{CORRECTION.to}</strong>. {CORRECTION.reason} Because status is part of each revision’s content hash, the
          pinned hash changed; both are listed.
        </p>
        <ul className="affected-list">
          {CORRECTION.revisions.map((r) => (
            <li key={r.code}>
              <Link className="code-inline" href={`/claims/${r.code}?rev=${r.rev}`}>
                {r.code} · rev {r.rev}
              </Link>
              <p className="small faint mono" style={{ margin: '4px 0 0', overflowWrap: 'anywhere' }}>
                was {r.previousHash} · now {r.hash}
              </p>
            </li>
          ))}
        </ul>
      </section>
      <p className="small faint" style={{ marginTop: 24 }}>
        <a className="link" href="/api/v1/changelog">
          JSON
        </a>{' '}
        · MCP tool <code className="code-inline">get_record_history</code>
      </p>
    </main>
  );
}

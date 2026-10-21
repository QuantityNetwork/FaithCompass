import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { PageIntro, Section } from '@/components/record/ui';
import { statusReport } from '@/lib/api/status';
import { dispatchV1 } from '@/lib/api/v1';
import { canonicalOrigin } from '@/lib/site/config';

export const metadata: Metadata = {
  title: 'Status',
  description: 'Live self-tests of the AbrahamMoses record, REST API and MCP server, and the editorial work still outstanding.',
  alternates: { canonical: '/status' },
};

export const dynamic = 'force-dynamic';

const OUTSTANDING_LABELS: Record<string, string> = {
  verification_pending: 'Claim revisions awaiting editorial verification',
  stances_provisional: 'Reading principles whose tradition stances await verification',
  case_provisional: 'Research cases awaiting review by scholars of the tradition',
  translation_unverified: 'Translations whose quotations await checking',
  no_confidence_profile: 'Current revisions without a confidence profile',
};

export default async function StatusPage() {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const request = new Request(`${proto}://${host}/status`, { headers: { 'x-forwarded-host': host, 'x-forwarded-proto': proto } });
  const report = await statusReport(request, async (path) => {
    const response = await dispatchV1(new Request(`${canonicalOrigin()}/api/v1${path}`, { headers: { 'x-forwarded-for': 'status-self-test' } }), path);
    return { status: response.status, body: response.status === 200 ? await response.json() : null };
  });

  return (
    <main id="main" className="shell page">
      <PageIntro
        eyebrow="Status"
        title={report.status === 'ok' ? 'All self-tests pass' : 'Degraded'}
        lede={`Each check below ran just now, in this server process, against the real code paths. Generated ${report.generated_at}.`}
      />

      <Section id="checks" title="Self-tests">
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Status checks">
          <table className="table table--stack">
            <thead>
              <tr>
                <th scope="col">Check</th>
                <th scope="col">Result</th>
                <th scope="col">Detail</th>
                <th scope="col">Time</th>
              </tr>
            </thead>
            <tbody>
              {report.checks.map((c) => (
                <tr key={c.id}>
                  <td data-label="Check">{c.label}</td>
                  <td data-label="Result">
                    <span className={`check check--${c.result}`}>{c.result}</span>
                  </td>
                  <td data-label="Detail">{c.detail}</td>
                  <td data-label="Time">{c.duration_ms} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="record" title="The record">
        <div className="stat-row" style={{ fontSize: 14 }}>
          <span>
            Version <strong className="mono">{report.record_version}</strong>
          </span>
          <span>
            <strong>{report.record.claims}</strong> claims
          </span>
          <span>
            <strong>{report.record.revisions}</strong> public revisions
          </span>
          <span>
            <strong>{report.record.published_revisions}</strong> editor-verified (named reviewer on record)
          </span>
          <span>
            <strong>{report.record.provisional_revisions}</strong> provisional, awaiting editorial review
          </span>
          <span>
            <strong>{report.record.cases}</strong> research cases
          </span>
          <span>
            <strong>{report.record.works}</strong> works in the corpus
          </span>
        </div>
      </Section>

      <Section id="outstanding" title="Editorial work outstanding">
        <p className="small muted" style={{ marginTop: 0 }}>
          Published so a reader can judge how far each part of the record has been checked.
        </p>
        <ul className="affected-list">
          {Object.entries(report.outstanding_editorial_work).map(([k, n]) => (
            <li key={k}>
              <strong>{n}</strong> — {OUTSTANDING_LABELS[k] ?? k}
            </li>
          ))}
        </ul>
      </Section>

      <p className="small faint" style={{ marginTop: 24 }}>
        Interfaces: REST API {report.api_version}, MCP protocol {report.mcp_protocol_versions.join(', ')}. Canonical origin{' '}
        <span className="mono">{report.canonical_origin}</span> ({report.canonical_origin_source}).{' '}
        <a className="link" href="/api/v1/status">
          JSON
        </a>{' '}
        · <Link className="link" href="/developers">Developers</Link>
      </p>
    </main>
  );
}

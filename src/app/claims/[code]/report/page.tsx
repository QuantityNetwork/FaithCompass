import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AcceptanceGrid, ConfidenceAxes, DerivationCard, ProvenanceChain, Refs } from '@/components/record/ui';
import { PrintButton } from '@/components/ui/print-button';
import { getCitation } from '@/lib/api/operations';
import { claimView } from '@/lib/api/views';
import { getRecord, revisionHash } from '@/lib/record/record';
import { STATUS_META } from '@/lib/record/taxonomy';
import { param, type SearchParams } from '@/lib/site/explorer';

type Props = { params: Promise<{ code: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  return {
    title: `Provenance report — ${code.toUpperCase()}`,
    robots: { index: false },
    alternates: { canonical: `/claims/${code.toUpperCase()}` },
  };
}

export default async function ProvenanceReport({ params, searchParams }: Props) {
  const { code } = await params;
  const sp = await searchParams;
  const record = getRecord();
  const claim = record.claim(code);
  if (!claim) notFound();
  const requested = Number(param(sp, 'rev'));
  const rev = Number.isInteger(requested) && record.revision(claim, requested) ? requested : record.current(claim).rev;
  const view = claimView(record, claim, rev);
  const citation = getCitation(record, claim.code, rev);
  const hash = revisionHash(claim.code, record.revision(claim, rev)!);

  return (
    <main id="main" className="shell shell--narrow page">
      <div className="no-print button-row" style={{ marginTop: 0 }}>
        <PrintButton />
      </div>
      <p className="eyebrow">AbrahamMoses · Provenance report</p>
      <h1 className="display" style={{ fontSize: 30 }}>
        {view.statement}
      </h1>
      <div className="table-wrap" style={{ marginTop: 20 }}>
      <table className="table">
        <tbody>
          <tr>
            <th scope="row">Claim</th>
            <td>
              {claim.code}, revision {rev} of {claim.revisions.length}
            </td>
          </tr>
          <tr>
            <th scope="row">Status</th>
            <td>
              {STATUS_META[view.status].label} — {STATUS_META[view.status].definition}
            </td>
          </tr>
          <tr>
            <th scope="row">Classification</th>
            <td>{view.classification_label}</td>
          </tr>
          <tr>
            <th scope="row">Published</th>
            <td>{view.published_at}</td>
          </tr>
          <tr>
            <th scope="row">Primary witnesses</th>
            <td>
              <Refs refs={view.witnesses} />
            </td>
          </tr>
          <tr>
            <th scope="row">Editions</th>
            <td>{view.editions.map((e) => `${e.work_title}: ${e.edition}`).join('; ')}</td>
          </tr>
          <tr>
            <th scope="row">Disputed</th>
            <td>{view.disputed}</td>
          </tr>
          <tr>
            <th scope="row">Interpretive divergence</th>
            <td>{view.interpretive_divergence}</td>
          </tr>
          <tr>
            <th scope="row">Machine involvement</th>
            <td>
              {view.machine_involvement.label}. {view.machine_involvement.description}
            </td>
          </tr>
          <tr>
            <th scope="row">Content hash</th>
            <td className="mono">{hash}</td>
          </tr>
          <tr>
            <th scope="row">Record version</th>
            <td className="mono">{record.version}</td>
          </tr>
        </tbody>
      </table>
      </div>

      <h2 className="subheading section--tight">Confidence</h2>
      <ConfidenceAxes confidence={view.confidence} />
      <h2 className="subheading section--tight">Traditional acceptance</h2>
      <AcceptanceGrid acceptance={view.acceptance} />
      <h2 className="subheading section--tight">Derivations</h2>
      <div className="stack">
        {view.derivations.length ? view.derivations.map((d) => <DerivationCard key={d.code} derivation={d} />) : <p className="small">Reported directly from its witness.</p>}
      </div>
      <h2 className="subheading section--tight">Provenance chain</h2>
      <ProvenanceChain steps={view.provenance} />
      <h2 className="subheading section--tight">Citation</h2>
      <div className="cite-box">{citation.text}</div>
      <div className="cite-box" style={{ marginTop: 10 }}>
        {citation.bibtex}
      </div>
    </main>
  );
}

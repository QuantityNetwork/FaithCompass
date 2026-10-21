import type { Metadata } from 'next';
import Link from 'next/link';
import { Intro } from '../../decision-passport/content';
import { DPA_ANNEXES, DPA_CLAUSES, DPA_DATE, DPA_FILES, DPA_PARTIES, DPA_SIGNATURES, DPA_STATUS, DPA_SUBTITLE, DPA_TITLE, DPA_VERSION } from '@/lib/trust/dpa';
import { TrustFooter } from '../content';

export const metadata: Metadata = {
  title: 'Data Processing Agreement (template) · Trust and security',
  description: 'A Data Processing Agreement template under Article 28 GDPR between the customer (controller) and Sagolik (processor), as a page, Word document and PDF. Subject to legal review and signature.',
  alternates: { canonical: '/institutional/trust/dpa' },
};

export default function DpaPage() {
  return (
    <>
      <Intro kicker="Trust and security · Data Processing Agreement" title="Data Processing Agreement">
        <p>
          A template for the agreement under Article 28 GDPR that governs client data in an AbrahamMoses workspace: the customer is the controller and Sagolik the processor. Client data is processed
          only once both parties have signed it.
        </p>
        <p className="dp-row tr-noprint">
          <a className="dp-btn dp-btn--primary" href={DPA_FILES.docx} download>Download Word (.docx)</a>
          <a className="dp-btn" href={DPA_FILES.pdf} download>Download PDF</a>
        </p>
      </Intro>

      <article className="dp-section tr-doc" aria-labelledby="dpa-title">
        <p className="tr-stamp">{DPA_STATUS}</p>
        <h2 id="dpa-title">{DPA_TITLE}</h2>
        <p className="dp-lede">{DPA_SUBTITLE} · Template version {DPA_VERSION}, {DPA_DATE}. Square brackets mark what the parties complete or agree.</p>
        <h3>Parties</h3>
        <table className="dp-table tr-kv"><tbody>{DPA_PARTIES.map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td>{v}</td></tr>)}</tbody></table>

        {DPA_CLAUSES.map((c) => (
          <section key={c.n} aria-labelledby={`c${c.n}`}>
            <h3 id={`c${c.n}`}>{c.n}. {c.title}{c.ref ? <span className="tr-ref">{c.ref}</span> : null}</h3>
            <ol className="tr-paras">{c.paras.map((p, i) => <li key={i} data-n={`${c.n}.${i + 1}`}>{p}</li>)}</ol>
          </section>
        ))}

        {DPA_ANNEXES.map((a) => (
          <section key={a.n} aria-labelledby={`a${a.n}`}>
            <h3 id={`a${a.n}`}>Annex {a.n}. {a.title}</h3>
            {a.rows ? <table className="dp-table tr-kv"><tbody>{a.rows.map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td>{v}</td></tr>)}</tbody></table> : null}
            {a.table ? (
              <div className="dp-scroll">
                <table className="dp-table tr-stack">
                  <thead><tr>{a.table.head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
                  <tbody>{a.table.rows.map((r) => <tr key={r[0]}><th scope="row">{r[0]}</th>{r.slice(1).map((c, i) => <td key={i} data-label={a.table!.head[i + 1]}>{c}</td>)}</tr>)}</tbody>
                </table>
              </div>
            ) : null}
          </section>
        ))}

        <h3>Signatures</h3>
        <div className="tr-sign">{DPA_SIGNATURES.map((s) => <div key={s}>{s}</div>)}</div>
        <p className="dp-muted">
          This template has not been reviewed by a lawyer. It is offered as a starting point and binds neither party until signed. See also the <Link href="/institutional/decision-twin/terms">Terms of Sale</Link> and the{' '}
          <Link href="/institutional/trust/subprocessors">sub-processors</Link>.
        </p>
      </article>
      <TrustFooter />
    </>
  );
}

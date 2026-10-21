'use client';
/**
 * Deep Analysis report. Every citation is a button: it highlights the exact passage in the document pane and
 * scrolls to it. Findings carry their layer (rule-based or AI) and, for AI, the "needs human review" mark.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Finding, Report, Section, Span } from '@/lib/deep-analysis/schema';

const RATING: Record<Report['finalStatement']['rating'], string> = {
  acceptable: 'Acceptable as drafted',
  acceptable_with_changes: 'Acceptable with changes',
  significant_concerns: 'Significant concerns',
  insufficient_information: 'Insufficient information',
};
const SEV_ORDER = { high: 0, medium: 1, low: 2, info: 3 } as const;

const TOPIC_SECTIONS: { id: Section; label: string }[] = [
  { id: 'payment', label: 'Payment terms' },
  { id: 'liability', label: 'Liability' },
  { id: 'indemnity', label: 'Indemnity' },
  { id: 'ip', label: 'Intellectual property' },
  { id: 'confidentiality', label: 'Confidentiality' },
  { id: 'data_protection', label: 'Data protection' },
  { id: 'governing_law', label: 'Governing law' },
  { id: 'dispute_resolution', label: 'Dispute resolution' },
];

const NAV = [
  ['da-overview', 'Overview'],
  ['da-clauses', 'Clauses'],
  ['da-obligations', 'Obligations'],
  ['da-deadlines', 'Deadlines'],
  ['da-terms', 'Key terms'],
  ['da-risks', 'Risks'],
  ['da-contradictions', 'Contradictions'],
  ['da-missing', 'Missing / unusual'],
  ['da-questions', 'Open questions'],
  ['da-final', 'Final Statement'],
  ['da-method', 'Method and seal'],
] as const;

export function ReportView({ report, onJson, recorded }: { report: Report; onJson: () => void; recorded?: string }) {
  const [active, setActive] = useState<string | null>(null);
  const spans = useMemo(() => new Map(report.spans.map((s) => [s.id, s])), [report]);
  const clauses = useMemo(() => new Map(report.clauses.map((c) => [c.id, c])), [report]);
  const bySection = useMemo(() => {
    const m = new Map<Section, Finding[]>();
    for (const f of report.findings) m.set(f.section, [...(m.get(f.section) ?? []), f]);
    return m;
  }, [report]);
  const findings = (s: Section) => bySection.get(s) ?? [];
  const findingById = useMemo(() => new Map(report.findings.map((f) => [f.id, f])), [report]);

  const Cite = ({ ids }: { ids: string[] }) =>
    ids.length ? (
      <span className="da-cites">
        {ids.map((id) => {
          const s = spans.get(id);
          if (!s) return null;
          const c = s.clause ? clauses.get(s.clause) : null;
          const label = c ? (c.number ? `§${c.number}` : c.heading.slice(0, 18)) : 'text';
          return (
            <button key={id} type="button" className={`da-cite${active === id ? ' is-active' : ''}`} onClick={() => setActive(id)} aria-pressed={active === id} title={s.quote.slice(0, 200)}>
              {label} · {id}
            </button>
          );
        })}
      </span>
    ) : null;

  const Tags = ({ f }: { f: Finding }) => (
    <span className="da-tags">
      {f.severity && f.severity !== 'info' ? <span className={`da-sev da-sev--${f.severity}`}>{f.severity}</span> : null}
      <span className={`da-layer da-layer--${f.layer}`}>{f.layer === 'ai' ? 'AI' : 'Rule'}</span>
    </span>
  );

  const List = ({ items, empty }: { items: Finding[]; empty: string }) =>
    items.length ? (
      <ol className="da-findings">
        {[...items].sort((a, b) => SEV_ORDER[a.severity ?? 'info'] - SEV_ORDER[b.severity ?? 'info']).map((f) => (
          <li key={f.id} className="da-finding">
            <div className="da-finding__head">
              <strong>{f.title}</strong>
              <Tags f={f} />
            </div>
            {f.detail ? <p className="da-finding__detail">{f.detail}</p> : null}
            {f.reasoning ? <p className="da-finding__why"><span>Reasoning</span> {f.reasoning}</p> : null}
            {f.rule ? <p className="da-finding__why"><span>Engine</span> {f.contradictionClass?.replace(/_/g, ' ').toLowerCase()} · {f.rule}</p> : null}
            {f.absence ? <p className="da-finding__why"><span>Absence</span> {f.absence.searched.startsWith('AI') ? f.absence.searched : 'no passage matched the standard wording'}; anchored to text {f.absence.textSha256.slice(0, 12)}…</p> : null}
            <Cite ids={f.spans} />
          </li>
        ))}
      </ol>
    ) : (
      empty ? <p className="da-muted">{empty}</p> : null
    );

  const parties = useMemo(() => {
    const m = new Map<string, Finding[]>();
    for (const f of findings('obligation')) {
      const p = f.party ?? 'Unattributed';
      m.set(p, [...(m.get(p) ?? []), f]);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [bySection]); // eslint-disable-line react-hooks/exhaustive-deps

  const fs = report.finalStatement;
  const ai = report.engine.ai;
  const Section = ({ id, n, title, children, lede }: { id: string; n: string; title: string; children: ReactNode; lede?: string }) => (
    <section id={id} className="da-section" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`}><span className="da-num">{n}</span>{title}</h2>
      {lede ? <p className="da-lede">{lede}</p> : null}
      {children}
    </section>
  );
  const Sub = ({ n, title, children }: { n: string; title: string; children: ReactNode }) => (
    <div className="da-sub"><h3><span className="da-num">{n}</span>{title}</h3>{children}</div>
  );
  const sevCount = (s: 'high' | 'medium' | 'low') => report.findings.filter((f) => f.severity === s && ['risk', 'unusual', 'contradiction', 'missing', 'concern'].includes(f.section)).length;
  const topConcerns = fs.keyConcerns.map((id) => findingById.get(id)).filter(Boolean).slice(0, 4) as Finding[];
  const issued = report.generatedAt.replace('T', ' ').replace(/\.\d+Z$/, ' UTC');

  return (
    <div className="da-report">
      <header className="da-reporthead">
        <p className="da-kicker">{report.document.sample ? 'Analysis of a fictional sample document' : 'Analysis report'}{recorded ? ` · ${recorded}` : ''}</p>
        <h2 className="da-title">{report.overview.title || report.document.filename}</h2>
        <dl className="da-docmeta">
          <div><dt>File</dt><dd>{report.document.filename} ({report.document.format.toUpperCase()}{report.document.pages ? `, ${report.document.pages} pp.` : ''})</dd></div>
          <div><dt>Scope</dt><dd>{report.clauses.length} clauses · {report.document.chars.toLocaleString('en')} characters · {report.findings.length} findings</dd></div>
          <div><dt>Issued</dt><dd>{issued}</dd></div>
          <div><dt>AI layer</dt><dd>{ai.status === 'used' ? `Used (${ai.model})` : ai.status === 'not_configured' ? 'Not configured on this deployment' : ai.status === 'not_permitted' ? 'Not used' : 'Failed'}</dd></div>
        </dl>
        <div className="da-actions">
          <button type="button" className="da-btn" onClick={onJson}>Export sealed JSON</button>
          <button type="button" className="da-btn" onClick={() => window.print()}>Export PDF</button>
        </div>
      </header>
      <p className="da-disclaimer" role="note"><strong>{report.disclaimer}</strong> Findings are proposals for a human reader to check against the cited passages.{ai.status !== 'used' ? ` ${ai.note}` : ''}</p>

      <section className="da-exec" aria-labelledby="da-exec-h">
        <h2 id="da-exec-h">Executive summary</h2>
        <div className="da-exec__grid">
          <div>
            <p className="da-exec__label">Assessment</p>
            <p className="da-exec__rating">{RATING[fs.rating]}</p>
            <p className="da-exec__label">Confidence</p>
            <p className="da-exec__value">{fs.confidence[0].toUpperCase() + fs.confidence.slice(1)}</p>
            <table className="da-scale" aria-label="Rated items">
              <tbody>
                <tr><th scope="row"><span className="da-sev da-sev--high">High</span></th><td>{sevCount('high')}</td></tr>
                <tr><th scope="row"><span className="da-sev da-sev--medium">Medium</span></th><td>{sevCount('medium')}</td></tr>
                <tr><th scope="row"><span className="da-sev da-sev--low">Low</span></th><td>{sevCount('low')}</td></tr>
              </tbody>
            </table>
          </div>
          <div>
            <p className="da-exec__label">Parties</p>
            <p className="da-exec__value">{report.overview.parties.length ? report.overview.parties.map((p) => `${p.name}${p.role ? ` (${p.role})` : ''}`).join('; ') : 'Not identified'}</p>
            <p className="da-exec__label">Principal concerns</p>
            {topConcerns.length ? (
              <ol className="da-exec__list">{topConcerns.map((f) => <li key={f.id}>{f.title} <Cite ids={f.spans} /></li>)}</ol>
            ) : <p className="da-exec__value">None rated high or medium.</p>}
            <p className="da-exec__more"><a href="#da-final">Read the Final Statement (section 10)</a></p>
          </div>
        </div>
      </section>

      <div className="da-layout">
        <div className="da-main">
          <nav className="da-nav" aria-label="Report sections">
            <ol>{NAV.map(([id, label], i) => <li key={id}><a href={`#${id}`}><span className="da-num">{i + 1}.</span>{label}</a></li>)}</ol>
          </nav>

          <Section id="da-overview" n="1." title="Document overview">
            <div className="ws-scroll">
              <table className="da-table da-kv">
                <tbody>
                  <tr><th scope="row">Type</th><td>{report.overview.type ? <>{report.overview.type.value} <Cite ids={report.overview.type.spans} /></> : '—'}</td></tr>
                  <tr><th scope="row">Parties</th><td>{report.overview.parties.length ? <ul className="da-plain">{report.overview.parties.map((p) => <li key={p.name}><strong>{p.name}</strong>{p.role ? ` — “${p.role}”` : ''} <span className={`da-layer da-layer--${p.layer}`}>{p.layer === 'ai' ? 'AI' : 'Rule'}</span> <Cite ids={p.spans} /></li>)}</ul> : '—'}</td></tr>
                  <tr><th scope="row">Dates</th><td>{report.overview.dates.length ? report.overview.dates.map((d) => <span key={d.value} className="da-chipline">{d.value} <Cite ids={d.spans} /></span>) : '—'}</td></tr>
                  <tr><th scope="row">Amounts</th><td>{report.overview.amounts.length ? report.overview.amounts.map((d) => <span key={d.value} className="da-chipline">{d.value} <Cite ids={d.spans} /></span>) : '—'}</td></tr>
                  <tr><th scope="row">Periods</th><td>{report.overview.durations.length ? report.overview.durations.map((d) => <span key={d.value} className="da-chipline">{d.value} <Cite ids={d.spans} /></span>) : '—'}</td></tr>
                  <tr><th scope="row">Governing law</th><td>{report.overview.governingLaw ? <>{report.overview.governingLaw.value} <Cite ids={report.overview.governingLaw.spans} /></> : '—'}</td></tr>
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="da-clauses" n="2." title="Clause-by-clause analysis" lede="Topics and key terms are identified by rule; summaries come from the AI layer and cite the passage they rest on.">
            <div className="ws-scroll">
              <table className="da-table da-clauses">
                <thead><tr><th scope="col">Clause</th><th scope="col">Topics and key terms</th><th scope="col">Summary</th></tr></thead>
                <tbody>
                  {report.clauses.map((c) => (
                    <tr key={c.id}>
                      <td><button type="button" className="da-linkish" onClick={() => setActive(`clause:${c.id}`)}>{c.number ? `${c.number}. ` : ''}{c.heading}</button></td>
                      <td>{c.topics.join(', ') || '—'}{c.keyTerms.length ? <div className="da-terms">{c.keyTerms.join(' · ')}</div> : null}</td>
                      <td>{c.summary ? <>{c.summary.text} <Cite ids={c.summary.spans} /></> : <span className="da-muted">{ai.status === 'used' ? 'No verified summary.' : 'Requires the AI layer.'}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="da-obligations" n="3." title="Obligations by party">
            {parties.length ? parties.map(([p, items], i) => (
              <Sub key={p} n={`3.${i + 1}`} title={`${p} (${items.length})`}><List items={items} empty="" /></Sub>
            )) : <p className="da-muted">No obligation sentences found.</p>}
          </Section>

          <Section id="da-deadlines" n="4." title="Deadlines, renewal and termination">
            <Sub n="4.1" title="Deadlines and time limits"><List items={findings('deadline')} empty="No time limits found." /></Sub>
            <Sub n="4.2" title="Renewal and termination"><List items={findings('renewal_termination')} empty="No renewal or termination terms found." /></Sub>
          </Section>

          <Section id="da-terms" n="5." title="Key commercial and legal terms">
            {TOPIC_SECTIONS.map((t, i) => (
              <Sub key={t.id} n={`5.${i + 1}`} title={t.label}><List items={findings(t.id)} empty={`No ${t.label.toLowerCase()} terms found.`} /></Sub>
            ))}
          </Section>

          <Section id="da-risks" n="6." title="Risk assessment" lede="Rated high, medium or low with the reasoning. The rating reflects the wording, not the commercial context.">
            <List items={findings('risk')} empty="No risk patterns found." />
          </Section>

          <Section id="da-contradictions" n="7." title="Internal contradictions" lede="Rule findings come from the contradiction engine on extracted terms; AI candidates are capped at “potential conflict” and pass the engine’s veto.">
            <List items={findings('contradiction')} empty="No internal contradictions found." />
          </Section>

          <Section id="da-missing" n="8." title="Missing and unusual terms">
            <Sub n="8.1" title="Missing"><List items={findings('missing')} empty="No standard term found missing." /></Sub>
            <Sub n="8.2" title="Unusual"><List items={findings('unusual')} empty="No unusual terms found." /></Sub>
          </Section>

          <Section id="da-questions" n="9." title="Open questions">
            <List items={findings('open_question')} empty={ai.status === 'used' ? 'No open questions.' : 'Open questions require the AI layer.'} />
          </Section>

          <section id="da-final" className="da-section da-memo" aria-labelledby="da-final-h">
            <h2 id="da-final-h"><span className="da-num">10.</span>Final Statement</h2>
            <div className="da-memo__sheet">
              <p className="da-memo__type">Memorandum</p>
              <table className="da-memo__head">
                <tbody>
                  <tr><th scope="row">To</th><td>The reader of this report</td></tr>
                  <tr><th scope="row">From</th><td>AbrahamMoses Deep Analysis ({report.engine.version}{fs.layer === 'ai' && ai.model ? `, AI layer ${ai.model}` : ', rule-based'})</td></tr>
                  <tr><th scope="row">Date</th><td>{issued}</td></tr>
                  <tr><th scope="row">Re</th><td>{report.overview.title || report.document.filename}</td></tr>
                </tbody>
              </table>
              <p className="da-memo__rating"><span>Conclusion</span> {RATING[fs.rating]} <span className={`da-layer da-layer--${fs.layer}`}>{fs.layer === 'ai' ? 'AI' : 'Rule'}</span></p>
              <p className="da-overall">{fs.overall}</p>
              <Cite ids={fs.overallSpans} />
              {fs.keyConcerns.length ? (
                <>
                  <h3><span className="da-num">10.1</span>Key concerns</h3>
                  <ol className="da-findings">
                    {fs.keyConcerns.map((id) => findingById.get(id)).filter(Boolean).map((f) => (
                      <li key={f!.id} className="da-finding">
                        <div className="da-finding__head"><strong>{f!.title}</strong><Tags f={f!} /></div>
                        {f!.detail ? <p className="da-finding__detail">{f!.detail}</p> : null}
                        <Cite ids={f!.spans} />
                      </li>
                    ))}
                  </ol>
                </>
              ) : null}
              {fs.recommendedActions.length ? (
                <>
                  <h3><span className="da-num">10.2</span>Recommended actions</h3>
                  <ol className="da-actions-list">
                    {fs.recommendedActions.map((a, i) => <li key={i}>{a.text} <Cite ids={a.spans} /></li>)}
                  </ol>
                </>
              ) : null}
              <h3><span className="da-num">10.3</span>Confidence and limitations</h3>
              <table className="da-table da-kv">
                <tbody>
                  <tr><th scope="row">Confidence</th><td><strong>{fs.confidence}</strong> — {fs.confidenceReason}</td></tr>
                  <tr><th scope="row">Limitations</th><td><ul className="da-plain">{fs.limitations.map((l) => <li key={l}>{l}</li>)}</ul></td></tr>
                </tbody>
              </table>
              <div className="da-memo__sign">
                <p className="da-memo__signline">AbrahamMoses Deep Analysis</p>
                <p>Issued by software, not signed by a person. {report.disclaimer}</p>
                <p className="ws-mono">Sealed SHA-256 {report.seal.reportSha256}</p>
              </div>
            </div>
          </section>

          <Section id="da-method" n="11." title="Method, verification and seal">
            <table className="da-table da-kv">
              <tbody>
                <tr><th scope="row">Engine</th><td>{report.engine.version}; contradiction engine with deterministic veto</td></tr>
                <tr><th scope="row">AI layer</th><td>{ai.note}{ai.promptVersion ? ` Prompt ${ai.promptVersion}.` : ''}</td></tr>
                {ai.status === 'used' ? <tr><th scope="row">AI verification</th><td>{ai.proposed} proposals; {ai.dropped} dropped because a quotation was not found verbatim or was malformed; {ai.vetoed} contradiction candidates vetoed by the deterministic layer.{ai.droppedExamples.length ? <ul className="da-plain da-dropped">{ai.droppedExamples.map((d) => <li key={d}>{d}</li>)}</ul> : null}</td></tr> : null}
                {ai.usage ? <tr><th scope="row">AI usage</th><td>{ai.usage.inputTokens.toLocaleString('en')} input and {ai.usage.outputTokens.toLocaleString('en')} output tokens, about ${ai.usage.usd.toFixed(3)}</td></tr> : null}
                <tr><th scope="row">Spans</th><td>{report.spans.length} hash-anchored passages, each re-checkable against the text</td></tr>
                <tr><th scope="row">File SHA-256</th><td className="ws-mono">{report.document.bytesSha256}</td></tr>
                <tr><th scope="row">Text SHA-256</th><td className="ws-mono">{report.document.textSha256}</td></tr>
                <tr><th scope="row">Report seal</th><td className="ws-mono">{report.seal.reportSha256}</td></tr>
              </tbody>
            </table>
          </Section>
        </div>

        <DocumentPane report={report} span={active?.startsWith('clause:') ? null : spans.get(active ?? '') ?? null} clause={active?.startsWith('clause:') ? clauses.get(active.slice(7)) ?? null : null} onClear={() => setActive(null)} />
      </div>
    </div>
  );
}

function DocumentPane({ report, span, clause, onClear }: { report: Report; span: Span | null; clause: Report['clauses'][number] | null; onClear: () => void }) {
  const mark = useRef<HTMLElement | null>(null);
  const range = span ? { start: span.start, end: span.end } : clause ? { start: clause.start, end: clause.end } : null;
  useEffect(() => {
    if (range && mark.current) {
      mark.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      mark.current.focus({ preventScroll: true });
    }
  }, [range?.start, range?.end]); // eslint-disable-line react-hooks/exhaustive-deps
  const t = report.text;
  return (
    <aside className="da-doc" aria-label="Document text">
      <div className="da-doc__head">
        <h2>Document</h2>
        {range ? <button type="button" className="da-linkish" onClick={onClear}>Clear highlight</button> : <span className="ws-hint">Select a citation to highlight its passage.</span>}
      </div>
      {span ? <p className="ws-hint da-doc__anchor">{span.id} · characters {span.start}–{span.end} · SHA-256 {span.sha256.slice(0, 16)}…</p> : null}
      <div className="da-doc__text" tabIndex={0}>
        {range ? (
          <>
            {t.slice(0, range.start)}
            <mark ref={mark} tabIndex={-1}>{t.slice(range.start, range.end)}</mark>
            {t.slice(range.end)}
          </>
        ) : t}
      </div>
    </aside>
  );
}

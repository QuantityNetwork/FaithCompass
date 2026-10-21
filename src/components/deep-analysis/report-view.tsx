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
  ['da-final', 'Final statement'],
  ['da-overview', 'Overview'],
  ['da-clauses', 'Clause by clause'],
  ['da-obligations', 'Obligations'],
  ['da-deadlines', 'Deadlines, renewal, termination'],
  ['da-terms', 'Key terms'],
  ['da-risks', 'Risks'],
  ['da-contradictions', 'Contradictions'],
  ['da-missing', 'Missing or unusual'],
  ['da-questions', 'Open questions'],
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
      <p className="ws-hint">{empty}</p>
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
  const Section = ({ id, title, children, lede }: { id: string; title: string; children: ReactNode; lede?: string }) => (
    <section id={id} className="da-section" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`}>{title}</h2>
      {lede ? <p className="ws-hint da-lede">{lede}</p> : null}
      {children}
    </section>
  );

  return (
    <div className="da-report">
      <div className="da-reporthead">
        <div>
          <p className="eyebrow">{report.document.sample ? 'Fictional sample document' : 'Your document'}{recorded ? ` · ${recorded}` : ''}</p>
          <h2 className="da-title">{report.overview.title || report.document.filename}</h2>
          <p className="ws-meta">
            {report.document.filename} · {report.document.format.toUpperCase()} · {report.document.chars.toLocaleString('en')} characters{report.document.pages ? ` · ${report.document.pages} pages` : ''} · {report.clauses.length} clauses · {report.findings.length} findings
          </p>
          <p className="ws-meta">
            AI layer: <strong>{ai.status === 'used' ? `used (${ai.model})` : ai.status === 'not_configured' ? 'not configured on this deployment' : ai.status === 'not_permitted' ? 'not used' : 'failed'}</strong>
            {ai.status !== 'used' ? ` — ${ai.note}` : ''}
          </p>
        </div>
        <div className="ws-row da-actions">
          <button type="button" className="button" onClick={onJson}>Export sealed JSON</button>
          <button type="button" className="button" onClick={() => window.print()}>Export PDF</button>
        </div>
      </div>
      <p className="da-disclaimer" role="note"><strong>{report.disclaimer}</strong> Findings are proposals for a human reader to check against the cited passages.</p>

      <div className="da-layout">
        <div className="da-main">
          <nav className="da-nav" aria-label="Report sections">
            {NAV.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
          </nav>

          <Section id="da-final" title="Final statement">
            <div className="da-statement">
              <p className="da-rating"><span>Assessment</span> {RATING[fs.rating]} <span className={`da-layer da-layer--${fs.layer}`}>{fs.layer === 'ai' ? 'AI' : 'Rule'}</span></p>
              <p className="da-overall">{fs.overall}</p>
              <Cite ids={fs.overallSpans} />
              {fs.keyConcerns.length ? (
                <>
                  <h3>Key concerns</h3>
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
                  <h3>Recommended actions</h3>
                  <ol className="da-actions-list">
                    {fs.recommendedActions.map((a, i) => <li key={i}>{a.text} <Cite ids={a.spans} /></li>)}
                  </ol>
                </>
              ) : null}
              <table className="ws-table da-kv">
                <tbody>
                  <tr><th scope="row">Confidence</th><td><strong>{fs.confidence}</strong> — {fs.confidenceReason}</td></tr>
                  <tr><th scope="row">Limitations</th><td><ul className="da-plain">{fs.limitations.map((l) => <li key={l}>{l}</li>)}</ul></td></tr>
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="da-overview" title="Document overview">
            <div className="ws-scroll">
              <table className="ws-table da-kv">
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

          <Section id="da-clauses" title="Clause by clause" lede="Topics and key terms are found by rule; summaries come from the AI layer and cite the passage they rest on.">
            <div className="ws-scroll">
              <table className="ws-table da-clauses">
                <thead><tr><th scope="col">Clause</th><th scope="col">Topics · key terms</th><th scope="col">Summary</th></tr></thead>
                <tbody>
                  {report.clauses.map((c) => (
                    <tr key={c.id}>
                      <td><button type="button" className="da-linkish" onClick={() => setActive(`clause:${c.id}`)}>{c.number ? `${c.number}. ` : ''}{c.heading}</button></td>
                      <td>{c.topics.join(', ') || '—'}{c.keyTerms.length ? <div className="da-terms">{c.keyTerms.join(' · ')}</div> : null}</td>
                      <td>{c.summary ? <>{c.summary.text} <Cite ids={c.summary.spans} /></> : <span className="ws-hint">{ai.status === 'used' ? 'No verified summary.' : 'Needs the AI layer.'}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="da-obligations" title="Obligations per party">
            {parties.length ? parties.map(([p, items]) => (
              <div key={p} className="da-party"><h3>{p} <span className="ws-hint">({items.length})</span></h3><List items={items} empty="" /></div>
            )) : <p className="ws-hint">No obligation sentences found.</p>}
          </Section>

          <Section id="da-deadlines" title="Deadlines, renewal and termination">
            <h3>Deadlines and time limits</h3>
            <List items={findings('deadline')} empty="No time limits found." />
            <h3>Renewal and termination</h3>
            <List items={findings('renewal_termination')} empty="No renewal or termination terms found." />
          </Section>

          <Section id="da-terms" title="Key terms">
            {TOPIC_SECTIONS.map((t) => (
              <div key={t.id} className="da-topic"><h3>{t.label}</h3><List items={findings(t.id)} empty={`No ${t.label.toLowerCase()} terms found.`} /></div>
            ))}
          </Section>

          <Section id="da-risks" title="Risks" lede="Rated high, medium or low with the reasoning; the rating reflects the wording, not the commercial context.">
            <List items={findings('risk')} empty="No risk patterns found." />
          </Section>

          <Section id="da-contradictions" title="Internal contradictions" lede="Rule findings come from the contradiction engine on extracted terms; AI candidates are capped at “potential conflict” and pass the engine’s veto.">
            <List items={findings('contradiction')} empty="No internal contradictions found." />
          </Section>

          <Section id="da-missing" title="Missing or unusual terms">
            <h3>Missing</h3>
            <List items={findings('missing')} empty="No standard term found missing." />
            <h3>Unusual</h3>
            <List items={findings('unusual')} empty="No unusual terms found." />
          </Section>

          <Section id="da-questions" title="Open questions">
            <List items={findings('open_question')} empty={ai.status === 'used' ? 'No open questions.' : 'Open questions need the AI layer.'} />
          </Section>

          <Section id="da-method" title="Method, verification and seal">
            <table className="ws-table da-kv">
              <tbody>
                <tr><th scope="row">Engine</th><td>{report.engine.version}; contradiction engine with deterministic veto</td></tr>
                <tr><th scope="row">AI layer</th><td>{ai.note}{ai.promptVersion ? ` Prompt ${ai.promptVersion}.` : ''}</td></tr>
                {ai.status === 'used' ? <tr><th scope="row">AI verification</th><td>{ai.proposed} proposals; {ai.dropped} dropped because a quotation was not found verbatim or was malformed; {ai.vetoed} contradiction candidates vetoed by the deterministic layer.{ai.droppedExamples.length ? <ul className="da-plain da-dropped">{ai.droppedExamples.map((d) => <li key={d}>{d}</li>)}</ul> : null}</td></tr> : null}
                {ai.usage ? <tr><th scope="row">AI usage</th><td>{ai.usage.inputTokens.toLocaleString('en')} input and {ai.usage.outputTokens.toLocaleString('en')} output tokens, about ${ai.usage.usd.toFixed(3)}</td></tr> : null}
                <tr><th scope="row">Spans</th><td>{report.spans.length} hash-anchored passages, each re-checkable against the text</td></tr>
                <tr><th scope="row">File SHA-256</th><td className="ws-mono">{report.document.bytesSha256}</td></tr>
                <tr><th scope="row">Text SHA-256</th><td className="ws-mono">{report.document.textSha256}</td></tr>
                <tr><th scope="row">Report seal</th><td className="ws-mono">{report.seal.reportSha256}</td></tr>
                <tr><th scope="row">Generated</th><td>{report.generatedAt.replace('T', ' ').replace(/\.\d+Z$/, ' UTC')}</td></tr>
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

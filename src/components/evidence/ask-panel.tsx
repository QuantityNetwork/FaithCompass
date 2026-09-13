'use client';

import { useState } from 'react';

/**
 * Ask AbrahamMoses.
 *
 * Two kinds of input arrive here and they are handled very differently. A lens
 * ("show only primary sources", "analyse only using evidence before AD 500")
 * narrows the corpus the reasoning may draw on. A request for a tradition-level
 * verdict is redirected into the specific claims underneath it, with the
 * reasoning stated rather than a bare refusal.
 */

interface AskResponse {
  kind: 'GUARDRAIL' | 'ANALYSIS' | 'NONE';
  message?: string;
  suggestedClaims?: string[];
  href?: string;
  title?: string;
  lensNote?: string;
}

const LENSES = [
  { id: 'primary', label: 'Show only primary sources' },
  { id: 'pre500', label: 'Only evidence before AD 500' },
  { id: 'historical', label: 'Remove theological assumptions' },
];

const EXAMPLES = [
  'Why is this score low?',
  'What evidence supports the identification of Michael?',
  'Give me the strongest argument against this assessment.',
  'Give Islam a truth score',
];

export function AskPanel({ defaultQuery = '' }: { defaultQuery?: string }) {
  const [query, setQuery] = useState(defaultQuery);
  const [lenses, setLenses] = useState<string[]>([]);
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  const [busy, setBusy] = useState(false);

  function toggleLens(id: string) {
    setLenses((cur) => (cur.includes(id) ? cur.filter((l) => l !== id) : [...cur, id]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setAnswer(null);
    try {
      const res = await fetch('/api/evidence/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query, lenses }),
      });
      setAnswer((await res.json()) as AskResponse);
    } catch {
      setAnswer({
        kind: 'NONE',
        message: 'The request could not be completed.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel__title">Ask AbrahamMoses</div>
      <form onSubmit={submit}>
        <input
          className="field"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask about a passage, a claim, or an assessment…"
          aria-label="Ask AbrahamMoses"
        />
        <div className="chips">
          {LENSES.map((l) => (
            <button
              type="button"
              key={l.id}
              className="chip"
              aria-pressed={lenses.includes(l.id)}
              onClick={() => toggleLens(l.id)}
            >
              {l.label}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 18 }}>
          <button className="button" type="submit" disabled={busy}>
            {busy ? 'Working…' : 'Analyse'}
          </button>
        </div>
      </form>

      <div className="chips" style={{ marginTop: 20 }}>
        {EXAMPLES.map((ex) => (
          <button type="button" key={ex} className="chip" onClick={() => setQuery(ex)}>
            {ex}
          </button>
        ))}
      </div>

      {answer ? <AskAnswer answer={answer} /> : null}
    </div>
  );
}

function AskAnswer({ answer }: { answer: AskResponse }) {
  if (answer.kind === 'ANALYSIS' && answer.href) {
    return (
      <div className="notice">
        <div className="tiny" style={{ color: 'var(--gold)', marginBottom: 10 }}>
          Analysis available
        </div>
        <p className="small" style={{ marginTop: 0 }}>
          {answer.lensNote ? <em>{answer.lensNote} </em> : null}
          An Evidence Intelligence analysis exists for <strong>{answer.title}</strong>.
        </p>
        <a className="button" href={answer.href}>
          Open analysis
        </a>
      </div>
    );
  }

  return (
    <div className={`notice${answer.kind === 'GUARDRAIL' ? ' notice--caution' : ''}`}>
      <div className="tiny" style={{ color: 'var(--ink-muted)', marginBottom: 10 }}>
        {answer.kind === 'GUARDRAIL' ? 'Reformulating the question' : 'No analysis available'}
      </div>
      <p className="small" style={{ marginTop: 0 }}>
        {answer.message}
      </p>
      {answer.suggestedClaims && answer.suggestedClaims.length > 0 ? (
        <ul className="reasons reasons--neutral" style={{ marginTop: 14 }}>
          {answer.suggestedClaims.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

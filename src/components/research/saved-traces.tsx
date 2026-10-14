'use client';

/**
 * Saved research traces, kept on the reader's own device.
 *
 * A research history can reveal religious or philosophical beliefs — special-
 * category data under the GDPR — so AbrahamMoses does not collect it. Traces
 * live in this browser's local storage; the reader can export them as JSON or
 * delete them, and nothing is sent to a server. See /privacy.
 */

import { useEffect, useState } from 'react';

const KEY = 'abrahammoses.traces.v1';

export interface Trace {
  url: string;
  title: string;
  savedAt: string;
}

function read(): Trace[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Trace[]) : [];
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t.url === 'string' && t.url.startsWith('/')) : [];
  } catch {
    return [];
  }
}

function write(traces: Trace[]): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(traces));
    return true;
  } catch {
    return false;
  }
}

export function SaveTraceButton({ title }: { title: string }) {
  const [state, setState] = useState<'idle' | 'saved' | 'unavailable'>('idle');
  return (
    <button
      type="button"
      className="button button--quiet"
      onClick={() => {
        const url = window.location.pathname + window.location.search;
        const traces = read().filter((t) => t.url !== url);
        traces.unshift({ url, title, savedAt: new Date().toISOString() });
        setState(write(traces.slice(0, 100)) ? 'saved' : 'unavailable');
      }}
    >
      {state === 'saved' ? 'Saved on this device' : state === 'unavailable' ? 'Storage unavailable' : 'Save this trace'}
    </button>
  );
}

export function SavedTraces() {
  const [traces, setTraces] = useState<Trace[] | null>(null);

  useEffect(() => {
    setTraces(read());
  }, []);

  if (traces === null) return null;

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), traces }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'abrahammoses-research-traces.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="card" aria-labelledby="traces-title" style={{ marginTop: 40 }}>
      <h2 id="traces-title" className="subheading">
        Your saved traces
      </h2>
      <p className="small muted" style={{ marginTop: 0 }}>
        Stored only in this browser. AbrahamMoses never receives your research history.
      </p>
      {traces.length === 0 ? (
        <p className="small faint">None yet. Use “Save this trace” on a result to keep it here.</p>
      ) : (
        <>
          <ul className="affected-list">
            {traces.map((t) => (
              <li key={t.url}>
                <a className="link" href={t.url}>
                  {t.title}
                </a>{' '}
                <span className="small faint">{new Date(t.savedAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
          <div className="button-row">
            <button type="button" className="button button--quiet" onClick={exportJson}>
              Export as JSON
            </button>
            <button
              type="button"
              className="button button--quiet"
              onClick={() => {
                try {
                  window.localStorage.removeItem(KEY);
                } catch {
                  /* nothing stored */
                }
                setTraces([]);
              }}
            >
              Delete all
            </button>
          </div>
        </>
      )}
    </section>
  );
}

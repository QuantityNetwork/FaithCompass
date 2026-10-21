'use client';
import { useState } from 'react';

interface Check { id: string; status: 'pass' | 'fail' | 'uncheckable'; detail: string; explanation: string }
interface Result { verdict: string; summary: string; passport_sha256: string | null; checks: Check[]; notes: string[]; error?: string }

const SAMPLES = [
  { label: 'Approved draft (unsigned)', href: '/decision-passport/samples/approved-draft.bundle.json' },
  { label: 'Issued, test key', href: '/decision-passport/samples/issued-test-key.bundle.json' },
  { label: 'Tampered finding', href: '/decision-passport/samples/tampered-finding.bundle.json' },
];

export function VerifyPortal() {
  const [text, setText] = useState('');
  const [lookup, setLookup] = useState('');
  const [deep, setDeep] = useState<unknown>(undefined);
  const [deepName, setDeepName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/passport/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) setError(j.error ?? `HTTP ${res.status}`);
      else setResult(j);
    } catch {
      setError('The verification service could not be reached. You can verify offline with the Go verifier.');
    } finally {
      setBusy(false);
    }
  }

  function verifyText() {
    let bundle: unknown;
    try {
      bundle = JSON.parse(text);
    } catch {
      setError('The pasted text is not JSON. Paste a whole .bundle.json file.');
      return;
    }
    run({ bundle, ...(deep !== undefined ? { deepAnalysis: deep } : {}) });
  }

  function verifyLookup() {
    const v = lookup.trim();
    if (/^[0-9a-fA-F]{64}$/.test(v)) run({ sha256: v.toLowerCase() });
    else if (v.startsWith('DP1-')) run({ id: v });
    else setError('Give a passport ID (DP1-…) or a 64-hex SHA-256.');
  }

  async function readFile(f: File | undefined, into: (s: string) => void) {
    if (!f) return;
    if (f.size > 4_000_000) return setError('The file is larger than 4 MB.');
    into(await f.text());
  }

  return (
    <div>
      <div className="dp-form">
        <label>
          Passport bundle (paste JSON)
          <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} placeholder='{"bundle":"abrahammoses-decision-passport-bundle", …}' />
        </label>
        <div className="dp-row">
          <label>
            …or upload a .bundle.json file
            <input type="file" accept=".json,application/json" onChange={(e) => readFile(e.target.files?.[0], setText)} />
          </label>
          <label>
            Optional: the Deep Analysis bundle it is bound to
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) =>
                readFile(e.target.files?.[0], (s) => {
                  try {
                    setDeep(JSON.parse(s));
                    setDeepName(e.target.files?.[0]?.name ?? null);
                  } catch {
                    setError('The Deep Analysis file is not JSON.');
                  }
                })
              }
            />
          </label>
        </div>
        {deepName ? <p className="dp-muted">Cross-check with {deepName}.</p> : null}
        <div className="dp-row">
          <button className="dp-btn dp-btn--primary" type="button" disabled={busy || !text.trim()} onClick={verifyText}>
            {busy ? 'Verifying…' : 'Verify bundle'}
          </button>
          <span className="dp-muted">Samples:</span>
          {SAMPLES.map((s) => (
            <button
              key={s.href}
              className="dp-btn"
              type="button"
              disabled={busy}
              onClick={async () => {
                const t = await (await fetch(s.href)).text();
                setText(t);
                setResult(null);
              }}
            >
              {s.label}
            </button>
          ))}
          <button
            className="dp-btn"
            type="button"
            disabled={busy}
            onClick={async () => {
              setDeep(await (await fetch('/decision-passport/samples/deep-analysis-sample.bundle.json')).json());
              setDeepName('the sample Deep Analysis bundle');
            }}
          >
            Sample Deep Analysis
          </button>
        </div>
        <label>
          …or look up a passport ID or SHA-256 in the registry
          <input type="text" value={lookup} onChange={(e) => setLookup(e.target.value)} placeholder="DP1-… or 64 hex digits" spellCheck={false} />
        </label>
        <div className="dp-row">
          <button className="dp-btn" type="button" disabled={busy || !lookup.trim()} onClick={verifyLookup}>
            Look up
          </button>
        </div>
      </div>
      {error ? (
        <p className="dp-notice" role="alert">
          {error}
        </p>
      ) : null}
      {result ? <Verdict r={result} /> : null}
    </div>
  );
}

function Verdict({ r }: { r: Result }) {
  const bad = ['INVALID', 'REVOKED', 'UNSUPPORTED', 'NOT_FOUND'].includes(r.verdict);
  return (
    <section className={`dp-verdict${bad ? ' dp-verdict--bad' : ''}`} aria-live="polite" aria-label="Verification result">
      <div className="dp-verdict__head">
        <h2>Verdict</h2>
        {r.passport_sha256 ? <span>SHA-256 {r.passport_sha256}</span> : null}
      </div>
      <div className="dp-verdict__body">
        <p className="dp-verdict__word">{r.verdict}</p>
        <p>{r.summary}</p>
        {r.checks.length ? (
          <div className="dp-scroll">
            <table className="dp-table">
              <thead>
                <tr><th scope="col">Check</th><th scope="col">Result</th><th scope="col">Detail</th><th scope="col">What it means</th></tr>
              </thead>
              <tbody>
                {r.checks.map((c) => (
                  <tr key={c.id}>
                    <th scope="row"><code>{c.id}</code></th>
                    <td><span className={`dp-status dp-status--${c.status}`}>{c.status === 'uncheckable' ? 'not checked' : c.status}</span></td>
                    <td><code>{c.detail}</code></td>
                    <td>{c.explanation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {r.notes.length ? <ul>{r.notes.map((n) => <li key={n} className="dp-muted">{n}</li>)}</ul> : null}
      </div>
    </section>
  );
}

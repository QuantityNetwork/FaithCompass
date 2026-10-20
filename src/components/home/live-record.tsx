'use client';

/**
 * The home page's "live record" panel. It is rendered with the checks that can be run when
 * the page is built, then replaced by the service's own live self-tests (/api/v1/status)
 * when the browser fetches them. If that fetch fails, the panel says it shows the build.
 */
import { useEffect, useState } from 'react';

export interface LiveCheck {
  id: string;
  label: string;
  result: 'pass' | 'warn' | 'fail';
  detail: string;
}

const MARK: Record<LiveCheck['result'], string> = { pass: '✓', warn: '!', fail: '✕' };

function stockholmTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' });
}

function zoneLabel(iso: string): string {
  const part = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Stockholm', timeZoneName: 'short' })
    .formatToParts(new Date(iso))
    .find((p) => p.type === 'timeZoneName')?.value;
  // en-GB renders Stockholm as "CEST"/"CET" in most engines and "GMT+2" in some.
  return part ?? 'Stockholm time';
}

export function LiveChecks({ initial, builtAt }: { initial: LiveCheck[]; builtAt: string }) {
  const [checks, setChecks] = useState(initial);
  const [liveAt, setLiveAt] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/api/v1/status', { signal: ctrl.signal, headers: { accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((s: { generated_at?: string; checks?: LiveCheck[] }) => {
        if (Array.isArray(s.checks) && s.generated_at) {
          setChecks(s.checks);
          setLiveAt(s.generated_at);
        }
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  return (
    <>
      <div className="am-row">
        <h3 className="am-h3">Live record</h3>
        <span className={`am-live${liveAt ? ' is-live' : ''}`} role="status">
          <span className="am-live__dot" aria-hidden="true" />
          {liveAt ? `live · ${stockholmTime(liveAt)} ${zoneLabel(liveAt)}` : `as built · ${builtAt}`}
        </span>
      </div>
      <ul className="am-checks">
        {checks.map((c) => (
          <li key={c.id} className={`is-${c.result}`}>
            <i aria-hidden="true">{MARK[c.result]}</i>
            <span>
              <b>{c.label}</b> <span className="am-tiny">· {c.detail}</span>
              <span className="am-sr"> ({c.result})</span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

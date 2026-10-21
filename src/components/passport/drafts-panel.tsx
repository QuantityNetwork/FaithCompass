'use client';
/** Passport drafts of a workspace, with the actions the signed-in user's role allows. The server and rules decide again. */
import { useCallback, useEffect, useState } from 'react';
import { freshAuthHeader } from '@/lib/firebase/client';
import { api, type DraftSummary } from './api';

const fmt = (iso: string | null) => (iso ? iso.replace('T', ' ').replace('Z', ' UTC') : '–');

export function PassportDrafts({ tenant, uid, role }: { tenant: string; uid: string; role: 'member' | 'editor' | null }) {
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const reload = useCallback(async () => {
    try {
      setDrafts((await api<{ drafts: DraftSummary[] }>(`/api/workspaces/${tenant}/passport-drafts`)).drafts);
    } catch (e) {
      setMsg({ text: (e as Error).message, error: true });
    }
  }, [tenant]);
  useEffect(() => {
    reload();
  }, [reload]);

  const step = async (id: string, body: Record<string, unknown>, done: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ draft: DraftSummary; passport_sha256?: string }>(`/api/workspaces/${tenant}/passport-drafts/${id}`, { method: 'POST', body });
      setMsg({ text: r.passport_sha256 ? `${done} Passport SHA-256 ${r.passport_sha256}.` : done });
      await reload();
    } catch (e) {
      setMsg({ text: (e as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  };

  const download = async (d: DraftSummary) => {
    const auth = await freshAuthHeader();
    const res = await fetch(`/api/workspaces/${tenant}/passport-drafts/${d.id}/bundle`, { headers: { ...auth } });
    if (!res.ok) return setMsg({ text: ((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'Download failed.', error: true });
    const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'decision-passport.bundle.json';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(await res.blob());
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <section className="ws-section" aria-labelledby="ws-passports" id="ws-passports">
      <h2 id="ws-passports">Passport drafts</h2>
      <p className="ws-hint">
        Created from Deep Analysis reports. The proposer submits; a different editor approves or rejects; then the proposer or reviewer issues, and the server signs. See the{' '}
        <a href="/institutional/decision-passport/policy">Passport Policy</a>.
      </p>
      <div aria-live="polite">{msg ? <p className={`ws-msg${msg.error ? ' ws-msg--error' : ''}`}>{msg.text}</p> : null}</div>
      {drafts.length === 0 ? <p className="ws-hint">No passport drafts yet. Create one from a Deep Analysis report.</p> : null}
      <ol className="ws-form" style={{ listStyle: 'none', padding: 0 }}>
        {drafts.map((d) => {
          const mine = d.createdBy === uid;
          const canReview = d.status === 'submitted' && !mine && role === 'editor';
          const canIssue = d.status === 'approved' && (mine || d.reviewedBy === uid);
          return (
            <li key={d.id} className="ws-panel">
              <div className="ws-row"><span className={`ws-status ws-status--${d.status}`}>{d.status}</span><h3 style={{ margin: 0 }}>{d.title}</h3><span className="ws-mono ws-meta">{d.id}</span></div>
              <p className="ws-meta">
                Report <span className="ws-mono">{d.reportSha256.slice(0, 16)}…</span> · proposed by {d.createdByEmail ?? d.createdBy} {fmt(d.createdAt)}
                {d.reviewedBy ? ` · reviewed by ${d.reviewedByEmail ?? d.reviewedBy} ${fmt(d.reviewedAt)}` : ''}
                {d.passportSha256 ? <> · passport <span className="ws-mono">{d.passportSha256.slice(0, 16)}…</span> ({d.kid})</> : null}
                {d.revokedAt ? ` · revoked ${fmt(d.revokedAt)} (${d.revocationReason})` : ''}
              </p>
              {d.reviewNote ? <p className="ws-meta">Review note: {d.reviewNote}</p> : null}
              <div className="ws-row">
                <button className="button button--quiet" type="button" onClick={() => download(d)}>{d.status === 'issued' || d.status === 'revoked' ? 'Download passport' : 'Download draft (unsigned)'}</button>
                {d.status === 'draft' && mine ? <button className="button" type="button" disabled={busy} onClick={() => step(d.id, { action: 'submit' }, 'Submitted for review.')}>Submit for review</button> : null}
                {d.status === 'submitted' && mine ? <span className="ws-hint">Waiting for review by another editor.</span> : null}
                {canReview ? (
                  <>
                    <input aria-label="Review note" placeholder="Review note (required)" value={notes[d.id] ?? ''} onChange={(e) => setNotes({ ...notes, [d.id]: e.target.value })} />
                    <label className="ws-meta"><input type="checkbox" checked={!!consent[d.id]} onChange={(e) => setConsent({ ...consent, [d.id]: e.target.checked })} /> show my email</label>
                    <button className="button" type="button" disabled={busy || (notes[d.id] ?? '').trim().length < 3} onClick={() => step(d.id, { action: 'approve', note: notes[d.id], showEmail: !!consent[d.id] }, 'Approved.')}>Approve</button>
                    <button className="button button--quiet" type="button" disabled={busy || (notes[d.id] ?? '').trim().length < 3} onClick={() => step(d.id, { action: 'reject', note: notes[d.id], showEmail: !!consent[d.id] }, 'Rejected.')}>Reject</button>
                  </>
                ) : null}
                {canIssue ? <button className="button button--solid" type="button" disabled={busy} onClick={() => step(d.id, { action: 'issue' }, 'Issued and signed.')}>Issue and sign</button> : null}
                {d.status === 'issued' && role === 'editor' ? (
                  <button className="button button--quiet" type="button" disabled={busy} onClick={() => { if (window.confirm('Revoke this passport permanently (reason: withdrawn)?')) step(d.id, { action: 'revoke', reason: 'withdrawn', supersededBy: null }, 'Revoked.'); }}>Revoke</button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

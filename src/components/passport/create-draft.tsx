'use client';
/**
 * "Create passport draft" for a Deep Analysis report: sends the sealed bundle to a workspace the signed-in user is a
 * member of. The server re-verifies the seal and every span; nothing is signed at this step.
 */
import { useEffect, useState } from 'react';
import { firebaseClientAvailable, freshAuthHeader, watchUser } from '@/lib/firebase/client';
import { api, type DraftSummary } from './api';

export function CreatePassportDraft({ bundle }: { bundle: unknown }) {
  const available = firebaseClientAvailable();
  const [user, setUser] = useState<{ uid: string; email: string | null } | null | undefined>(available ? undefined : null);
  const [workspaces, setWorkspaces] = useState<{ id: string; role: string }[] | null>(null);
  const [tenant, setTenant] = useState('');
  const [showFilename, setShowFilename] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    if (!available) return;
    let off: (() => void) | undefined;
    watchUser(setUser).then((f) => (off = f));
    return () => off?.();
  }, [available]);
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        await freshAuthHeader(true);
        const r = await api<{ workspaces: { id: string; role: string }[] }>('/api/workspaces');
        setWorkspaces(r.workspaces);
        if (r.workspaces.length) setTenant((t) => t || r.workspaces[0].id);
      } catch (e) {
        setMsg({ text: (e as Error).message, error: true });
      }
    })();
  }, [user]);

  const create = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ draft: DraftSummary }>(`/api/workspaces/${tenant}/passport-drafts`, { method: 'POST', body: { deepAnalysis: bundle, showFilename, showEmail } });
      setMsg({ text: `Draft ${r.draft.id} created in ${tenant}. Submit it for review in the workspace; a different editor must approve it before it can be issued.` });
    } catch (e) {
      setMsg({ text: (e as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="da-section dp-create" aria-labelledby="dp-create-h">
      <h2 id="dp-create-h">Decision Passport</h2>
      <p className="da-lede">
        Turn this report into a passport draft in your workspace. The draft binds the report seal, the document hashes, the findings and their span hashes. It is signed only after a second
        person approves it. <a href="/institutional/decision-passport">What a passport attests</a>.
      </p>
      {!available ? (
        <p className="da-muted">Workspaces are not configured on this deployment, so drafts cannot be created here. You can still download the bundle above.</p>
      ) : user === undefined ? (
        <p className="da-muted">Checking sign-in…</p>
      ) : user === null ? (
        <p className="da-muted"><a href="/institutional/workspace/sign-in">Sign in</a> as a workspace member to create a passport draft.</p>
      ) : workspaces && workspaces.length === 0 ? (
        <p className="da-muted">Your account is not a member of any workspace yet.</p>
      ) : (
        <div className="ws-form">
          <label className="ws-meta">
            Workspace{' '}
            <select value={tenant} onChange={(e) => setTenant(e.target.value)}>
              {(workspaces ?? []).map((w) => (
                <option key={w.id} value={w.id}>{w.id} ({w.role})</option>
              ))}
            </select>
          </label>
          <label className="da-check"><input type="checkbox" checked={showFilename} onChange={(e) => setShowFilename(e.target.checked)} /> Show the file name in the passport (otherwise only its hashes)</label>
          <label className="da-check"><input type="checkbox" checked={showEmail} onChange={(e) => setShowEmail(e.target.checked)} /> Show my email address as proposer (otherwise only my account id)</label>
          <div className="da-row">
            <button className="da-btn da-btn--primary" type="button" disabled={busy || !tenant} onClick={create}>{busy ? 'Creating…' : 'Create passport draft'}</button>
            <a className="da-linkish" href="/institutional/workspace#ws-passports">Open passport drafts</a>
          </div>
        </div>
      )}
      <div aria-live="polite">{msg ? <p className={`ws-msg${msg.error ? ' ws-msg--error' : ''}`}>{msg.text}</p> : null}</div>
    </section>
  );
}

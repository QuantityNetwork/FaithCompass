'use client';
/**
 * Evidence workspace client. Every call carries the user's Firebase ID token; the server forwards it to Firestore,
 * where firestore.rules decide again. Nothing here is trusted for access control.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { firebaseClientAvailable, freshAuthHeader, signOutUser, watchUser } from '@/lib/firebase/client';

type Role = 'member' | 'editor';
interface DocSummary { id: string; title: string; filename: string; bytes: number; passages: number; textSha256: string; importedByEmail: string | null; importedBy: string; importedAt: string }
interface Passage { n: number; text: string; sha256: string }
interface Decision {
  id: string; title: string; question: string; conclusion: string; rationale: string; status: 'proposed' | 'approved' | 'rejected';
  evidence: { documentId: string; passage: number; passageSha256: string; note: string }[];
  proposedBy: string; proposedByEmail: string | null; proposedAt: string; decidedBy: string | null; decidedByEmail: string | null; decidedAt: string | null; decisionNote: string | null;
}
interface AuditEvent { id: string; changeType: string; entityType: string; entityId: string; actorEmail: string | null; actorId: string; at: string; detail: string }
interface PassportRec { sha256: string; decisionId: string; decisionStatus: string; exportedAt: string; signed: boolean }

const fmt = (iso: string | null) => (iso ? iso.replace('T', ' ').replace('Z', ' UTC') : '–');

async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const auth = await freshAuthHeader();
  if (!auth) throw new Error('Sign in first.');
  const res = await fetch(path, {
    method: init.method ?? 'GET',
    headers: { ...auth, ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status}).`);
  return data as T;
}

function toBase64(buf: ArrayBuffer): string {
  let s = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function WorkspaceApp() {
  const available = firebaseClientAvailable();
  const [user, setUser] = useState<{ uid: string; email: string | null } | null | undefined>(undefined);
  const [workspaces, setWorkspaces] = useState<{ id: string; role: Role }[] | null>(null);
  const [tenant, setTenant] = useState<string>('');
  const [docs, setDocs] = useState<DocSummary[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [passports, setPassports] = useState<PassportRec[]>([]);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const role = workspaces?.find((w) => w.id === tenant)?.role ?? null;

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
        await freshAuthHeader(true); // picks up workspace roles granted after the last sign-in
        const r = await api<{ workspaces: { id: string; role: Role }[] }>('/api/workspaces');
        setWorkspaces(r.workspaces);
        if (r.workspaces.length) setTenant((t) => t || r.workspaces[0].id);
      } catch (e) {
        setMessage({ text: (e as Error).message, error: true });
      }
    })();
  }, [user]);

  const reload = useCallback(async () => {
    if (!tenant) return;
    try {
      const [d, c, a] = await Promise.all([
        api<{ documents: DocSummary[] }>(`/api/workspaces/${tenant}/documents`),
        api<{ decisions: Decision[] }>(`/api/workspaces/${tenant}/decisions`),
        api<{ events: AuditEvent[]; passports: PassportRec[] }>(`/api/workspaces/${tenant}/audit`),
      ]);
      setDocs(d.documents);
      setDecisions(c.decisions);
      setEvents(a.events);
      setPassports(a.passports);
    } catch (e) {
      setMessage({ text: (e as Error).message, error: true });
    }
  }, [tenant]);

  useEffect(() => {
    reload();
  }, [reload]);

  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    setMessage(null);
    try {
      setMessage({ text: await fn() });
      await reload();
    } catch (e) {
      setMessage({ text: (e as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  };

  if (!available) return <p className="ws-msg ws-msg--error">Workspaces are not configured on this deployment.</p>;
  if (user === undefined) return <p className="ws-hint">Checking sign-in…</p>;
  if (user === null)
    return (
      <section className="ws-section">
        <ol className="ws-steps">
          <li><strong>Import</strong> source documents; each file is hashed on receipt and split into numbered passages.</li>
          <li><strong>Propose</strong> a decision that cites those passages.</li>
          <li><strong>Review</strong>: a second member with the editor role approves or rejects it; nobody approves their own proposal.</li>
          <li><strong>Export</strong> the record as a passport bundle that can be verified offline.</li>
        </ol>
        <p className="ws-meta">Workspaces are private to their members. Access is granted by the operator to named accounts.</p>
        <a className="button button--solid" href="/institutional/workspace/sign-in">Sign in</a>
      </section>
    );

  return (
    <div>
      <section className="ws-section" aria-label="Account">
        <div className="ws-row">
          <span className="ws-meta">Signed in as <strong>{user.email ?? user.uid}</strong></span>
          {workspaces && workspaces.length > 0 ? (
            <label className="ws-meta">
              Workspace{' '}
              <select value={tenant} onChange={(e) => setTenant(e.target.value)}>
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>{w.id} ({w.role})</option>
                ))}
              </select>
            </label>
          ) : null}
          <button className="button button--quiet" type="button" onClick={() => signOutUser()}>Sign out</button>
        </div>
        <div aria-live="polite">{message ? <p className={`ws-msg${message.error ? ' ws-msg--error' : ''}`}>{message.text}</p> : null}</div>
        {workspaces && workspaces.length === 0 ? (
          <p className="ws-msg">This account has no workspace access yet. Access is granted by the operator; sign out and in again after it has been granted.</p>
        ) : null}
      </section>

      {tenant ? (
        <>
          <section className="ws-section ws-grid" aria-labelledby="ws-docs">
            <div>
              <h2 id="ws-docs">Documents</h2>
              <DocumentList tenant={tenant} docs={docs} />
            </div>
            <ImportForm busy={busy} onImport={(f, title) => run(async () => {
              const r = await api<{ document: DocSummary }>(`/api/workspaces/${tenant}/documents`, { method: 'POST', body: { filename: f.name, title: title || undefined, contentBase64: toBase64(await f.arrayBuffer()) } });
              return `Imported ${r.document.filename}: ${r.document.passages} passages, text SHA-256 ${r.document.textSha256.slice(0, 16)}…`;
            })} />
          </section>

          <section className="ws-section ws-grid" aria-labelledby="ws-decisions">
            <div>
              <h2 id="ws-decisions">Decisions</h2>
              <DecisionList
                decisions={decisions}
                uid={user.uid}
                role={role}
                busy={busy}
                onDecide={(id, action, note) => run(async () => {
                  const r = await api<{ decision: Decision }>(`/api/workspaces/${tenant}/decisions/${id}/decision`, { method: 'POST', body: { action, note } });
                  return `Decision ${r.decision.status}.`;
                })}
                onExport={(id) => run(async () => {
                  const auth = await freshAuthHeader();
                  const res = await fetch(`/api/workspaces/${tenant}/decisions/${id}/passport`, { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: '{}' });
                  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'Export failed.');
                  const blob = await res.blob();
                  const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'workspace-decision.bundle.json';
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = name;
                  a.click();
                  URL.revokeObjectURL(a.href);
                  return `Exported ${name}. Passport SHA-256 ${res.headers.get('x-passport-sha256')}.`;
                })}
              />
            </div>
            <ProposeForm docs={docs} busy={busy} onPropose={(body) => run(async () => {
              const r = await api<{ decision: Decision }>(`/api/workspaces/${tenant}/decisions`, { method: 'POST', body });
              return `Proposed "${r.decision.title}". It now needs review by another editor.`;
            })} tenant={tenant} />
          </section>

          <section className="ws-section" aria-labelledby="ws-audit">
            <h2 id="ws-audit">Audit trail</h2>
            <p className="ws-hint">Append-only. Each entry is written in the same database batch as the change it records.</p>
            <div className="ws-scroll">
              <table className="ws-table">
                <thead><tr><th scope="col">Time</th><th scope="col">Event</th><th scope="col">Entity</th><th scope="col">By</th><th scope="col">Detail</th></tr></thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id}><td>{fmt(e.at)}</td><td>{e.changeType}</td><td className="ws-mono">{e.entityId}</td><td>{e.actorEmail ?? e.actorId}</td><td>{e.detail}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            {passports.length ? (
              <>
                <h3 style={{ marginTop: 20 }}>Exported passports</h3>
                <ul className="ws-meta">
                  {passports.map((p) => (
                    <li key={p.sha256}><span className="ws-mono">{p.sha256}</span> · {p.decisionId} · {p.decisionStatus} · {p.signed ? 'signed' : 'unsigned'} · {fmt(p.exportedAt)}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}

function DocumentList({ tenant, docs }: { tenant: string; docs: DocSummary[] }) {
  const [open, setOpen] = useState<{ id: string; passages: Passage[] } | null>(null);
  if (!docs.length) return <p className="ws-hint">No documents yet.</p>;
  return (
    <div className="ws-scroll">
      <table className="ws-table">
        <thead><tr><th scope="col">Document</th><th scope="col">Passages</th><th scope="col">Imported</th></tr></thead>
        <tbody>
          {docs.map((d) => (
            <tr key={d.id}>
              <td>
                <button type="button" className="button button--quiet" aria-expanded={open?.id === d.id} onClick={async () => {
                  if (open?.id === d.id) return setOpen(null);
                  const r = await api<{ document: { passages: Passage[] } }>(`/api/workspaces/${tenant}/documents/${d.id}`);
                  setOpen({ id: d.id, passages: r.document.passages });
                }}>{d.title}</button>
                <div className="ws-meta">{d.filename} · <span className="ws-mono">{d.id}</span></div>
                {open?.id === d.id ? open.passages.slice(0, 40).map((p) => <p className="ws-passage" key={p.n}><strong>{p.n}.</strong> {p.text}</p>) : null}
              </td>
              <td>{d.passages}</td>
              <td className="ws-meta">{fmt(d.importedAt)}<br />{d.importedByEmail ?? d.importedBy}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ImportForm({ busy, onImport }: { busy: boolean; onImport: (f: File, title: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  return (
    <form className="ws-panel ws-form" onSubmit={(e) => { e.preventDefault(); if (file) onImport(file, title); }}>
      <h3>Import a document</h3>
      <label>File<input type="file" accept=".txt,.md,.markdown,.csv,.json,.html,.htm" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
      <label>Title (optional)<input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} /></label>
      <p className="ws-hint">Text, Markdown, CSV, JSON or HTML, up to 200 KB. The exact bytes are hashed on receipt; the text is split into numbered passages. PDF and Word files are not parsed yet: export them as text first.</p>
      <div><button className="button button--solid" type="submit" disabled={busy || !file}>Import</button></div>
    </form>
  );
}

function ProposeForm({ docs, busy, onPropose, tenant }: { docs: DocSummary[]; busy: boolean; tenant: string; onPropose: (b: unknown) => void }) {
  const [title, setTitle] = useState('');
  const [question, setQuestion] = useState('');
  const [conclusion, setConclusion] = useState('');
  const [rationale, setRationale] = useState('');
  const [cites, setCites] = useState<{ documentId: string; passage: number; note: string }[]>([{ documentId: '', passage: 1, note: '' }]);
  useEffect(() => setCites([{ documentId: docs[0]?.id ?? '', passage: 1, note: '' }]), [tenant, docs]);
  const ok = useMemo(() => cites.every((c) => c.documentId && c.passage >= 1), [cites]);
  if (!docs.length) return <div className="ws-panel"><h3>Propose a decision</h3><p className="ws-hint">Import a document first; every decision cites at least one passage.</p></div>;
  return (
    <form className="ws-panel ws-form" onSubmit={(e) => { e.preventDefault(); onPropose({ title, question, conclusion, rationale, evidence: cites }); }}>
      <h3>Propose a decision</h3>
      <label>Title<input required minLength={3} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label>Question<textarea required minLength={3} value={question} onChange={(e) => setQuestion(e.target.value)} /></label>
      <label>Conclusion<textarea required minLength={3} value={conclusion} onChange={(e) => setConclusion(e.target.value)} /></label>
      <label>Rationale (optional)<textarea value={rationale} onChange={(e) => setRationale(e.target.value)} /></label>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="ws-meta" style={{ fontWeight: 600 }}>Evidence (passages cited)</legend>
        {cites.map((c, i) => (
          <div className="ws-cite" key={i}>
            <label>Document
              <select value={c.documentId} onChange={(e) => setCites(cites.map((x, j) => (j === i ? { ...x, documentId: e.target.value } : x)))}>
                {docs.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
            </label>
            <label>Passage<input type="number" min={1} max={docs.find((d) => d.id === c.documentId)?.passages ?? 1} value={c.passage} onChange={(e) => setCites(cites.map((x, j) => (j === i ? { ...x, passage: Number(e.target.value) } : x)))} /></label>
            <label>Note<input value={c.note} maxLength={1000} onChange={(e) => setCites(cites.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} /></label>
            <button type="button" className="button button--quiet" disabled={cites.length === 1} onClick={() => setCites(cites.filter((_, j) => j !== i))}>Remove</button>
          </div>
        ))}
        <button type="button" className="button button--quiet" style={{ marginTop: 8 }} onClick={() => setCites([...cites, { documentId: docs[0].id, passage: 1, note: '' }])}>Add a citation</button>
      </fieldset>
      <div><button className="button button--solid" type="submit" disabled={busy || !ok}>Propose for review</button></div>
    </form>
  );
}

function DecisionList({ decisions, uid, role, busy, onDecide, onExport }: { decisions: Decision[]; uid: string; role: Role | null; busy: boolean; onDecide: (id: string, a: 'approve' | 'reject', note: string) => void; onExport: (id: string) => void }) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  if (!decisions.length) return <p className="ws-hint">No decisions yet.</p>;
  return (
    <ol className="ws-form" style={{ listStyle: 'none', padding: 0 }}>
      {decisions.map((d) => (
        <li key={d.id} className="ws-panel">
          <div className="ws-row"><span className={`ws-status ws-status--${d.status}`}>{d.status}</span><h3 style={{ margin: 0 }}>{d.title}</h3></div>
          <p className="ws-meta">Proposed by {d.proposedByEmail ?? d.proposedBy}, {fmt(d.proposedAt)}{d.decidedAt ? ` · ${d.status} by ${d.decidedByEmail ?? d.decidedBy}, ${fmt(d.decidedAt)}` : ''}</p>
          <p><strong>Question.</strong> {d.question}</p>
          <p><strong>Conclusion.</strong> {d.conclusion}</p>
          <p className="ws-meta">{d.evidence.length} passage(s) cited{d.decisionNote ? ` · Review note: ${d.decisionNote}` : ''}</p>
          {d.status === 'proposed' && d.proposedBy === uid ? <p className="ws-hint">Awaiting review by another editor (two-person rule).</p> : null}
          {d.status === 'proposed' && d.proposedBy !== uid && role === 'editor' ? (
            <div className="ws-form">
              <label>Review note<input value={notes[d.id] ?? ''} minLength={3} onChange={(e) => setNotes({ ...notes, [d.id]: e.target.value })} /></label>
              <div className="ws-row">
                <button className="button button--solid" type="button" disabled={busy || (notes[d.id] ?? '').trim().length < 3} onClick={() => onDecide(d.id, 'approve', notes[d.id])}>Approve</button>
                <button className="button" type="button" disabled={busy || (notes[d.id] ?? '').trim().length < 3} onClick={() => onDecide(d.id, 'reject', notes[d.id])}>Reject</button>
              </div>
            </div>
          ) : null}
          <div className="ws-row" style={{ marginTop: 8 }}>
            <button className="button" type="button" disabled={busy} onClick={() => onExport(d.id)}>Export passport bundle</button>
            <span className="ws-mono ws-meta">{d.id}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

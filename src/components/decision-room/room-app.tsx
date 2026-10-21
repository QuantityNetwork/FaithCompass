'use client';
/**
 * Decision Room: one decision from the signed-in user's evidence workspace, with everything that bears on it in one
 * place — the record, the cited evidence, Deep Analysis findings on the cited documents, contradictions, an evidence
 * counterfactual, the two-person review and the passport. It reads and writes only through the workspace APIs
 * (/api/workspaces/…) with the user's own ID token; firestore.rules decide access. Deep Analysis runs rule-based
 * only from here (useAi: false): no AI call and nothing stored.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { firebaseClientAvailable, freshAuthHeader, signOutUser, watchUser } from '@/lib/firebase/client';
import type { Finding, Report } from '@/lib/deep-analysis/schema';
import {
  counterfactual,
  documentText,
  implicatedCitations,
  resolveEvidence,
  reviewActions,
  reviewOf,
  roomHref,
  type RoomDecision,
  type RoomDocument,
} from '@/lib/decision-room/room';
import { DECISION_PASSPORT_HUB } from '@/lib/site/nav';

type Role = 'member' | 'editor';
interface DocSummary { id: string; title: string; filename: string; bytes: number; passages: number; textSha256: string; importedByEmail: string | null; importedBy: string; importedAt: string }
interface AuditEvent { id: string; changeType: string; entityType: string; entityId: string; actorEmail: string | null; actorId: string; at: string; detail: string }
interface PassportRec { sha256: string; decisionId: string; decisionStatus: string; exportedAt: string; signed: boolean }
type User = { uid: string; email: string | null };

const SIGN_IN = '/institutional/workspace/sign-in?next=%2Finstitutional%2Fdecision-room';
const SAMPLE = '/institutional/decision-room/sample';
const WORKSPACE = '/institutional/workspace';
const fmt = (iso: string | null) => (iso ? iso.replace('T', ' ').replace(/\.\d+Z$|Z$/, ' UTC') : '–');
const STATUS_LABEL: Record<RoomDecision['status'], string> = { proposed: 'Under review', approved: 'Approved', rejected: 'Rejected' };
const RATING: Record<Report['finalStatement']['rating'], string> = {
  acceptable: 'Acceptable',
  acceptable_with_changes: 'Acceptable with changes',
  significant_concerns: 'Significant concerns',
  insufficient_information: 'Insufficient information',
};

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

async function sha256Hex(text: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function DecisionRoomApp({ room }: { room: { w: string; d: string } | null }) {
  const available = firebaseClientAvailable();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [workspaces, setWorkspaces] = useState<{ id: string; role: Role }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        setWorkspaces((await api<{ workspaces: { id: string; role: Role }[] }>('/api/workspaces')).workspaces);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [user]);

  if (!available)
    return (
      <Notice title="Not available on this deployment">
        <p>Private rooms need the evidence workspace, which is not configured on this deployment. The <a href={SAMPLE}>sample room</a> shows the method on a fictional case.</p>
      </Notice>
    );
  if (user === undefined) return <p className="da-muted" role="status">Checking sign-in…</p>;
  if (user === null) return <SignedOut />;

  return (
    <div className="rm">
      <div className="rm-account">
        <span>Signed in as <strong>{user.email ?? user.uid}</strong></span>
        <button className="da-linkish" type="button" onClick={() => signOutUser()}>Sign out</button>
      </div>
      {error ? <p className="ws-msg ws-msg--error" role="alert">{error}</p> : null}
      {workspaces === null && !error ? <p className="da-muted" role="status">Loading your workspaces…</p> : null}
      {workspaces && workspaces.length === 0 ? (
        <Notice title="Your account has no workspace access yet">
          <p>
            You are signed in as <strong className="ws-mono">{user.email ?? 'an account without an email address'}</strong>. A room belongs to a workspace, and the operator grants
            access to named accounts. Send this address to the operator, then reload this page.
          </p>
          <p>Meanwhile the <a href={SAMPLE}>sample room</a> shows a complete room on a fictional case.</p>
        </Notice>
      ) : null}
      {workspaces && workspaces.length > 0 ? (
        room ? (
          <Room key={`${room.w}/${room.d}`} tenant={room.w} decisionId={room.d} user={user} role={workspaces.find((w) => w.id === room.w)?.role ?? null} />
        ) : (
          <RoomIndex workspaces={workspaces} />
        )
      ) : null}
    </div>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="da-notice rm-notice" aria-label={title}>
      <p className="da-notice__title">{title}</p>
      {children}
    </section>
  );
}

function SignedOut() {
  return (
    <div className="da-start">
      <section className="da-panel" aria-labelledby="rm-what">
        <h2 id="rm-what">What a room holds</h2>
        <ol className="rm-steps">
          <li><strong>The decision record</strong>: the question, the conclusion and the rationale, as proposed.</li>
          <li><strong>The evidence</strong>: every cited passage of the imported documents, checked against its hash.</li>
          <li><strong>Deep Analysis findings</strong> on the cited documents, each cited to the passage.</li>
          <li><strong>Contradictions and a counterfactual</strong>: where the documents disagree, and what the decision would still rest on if a citation fell away.</li>
          <li><strong>The two-person review</strong>: who proposed, who reviewed, and the audit trail.</li>
          <li><strong>The Decision Passport</strong>: an exported record that verifies offline.</li>
        </ol>
      </section>
      <section className="da-panel" aria-labelledby="rm-enter">
        <h2 id="rm-enter">Enter</h2>
        <p className="da-muted">Rooms are private to the members of a workspace. Access is granted by the operator to named accounts; signing in alone grants none.</p>
        <p className="rm-actions">
          <a className="da-btn da-btn--primary" href={SIGN_IN}>Sign in</a>
          <a className="da-btn" href={SAMPLE}>Open the sample room</a>
        </p>
        <p className="da-muted">The sample room is a fictional private credit case with synthetic documents. It shows the method; it is not a client decision.</p>
      </section>
    </div>
  );
}

interface IndexRow { tenant: string; role: Role; decision: RoomDecision; passports: number }

function RoomIndex({ workspaces }: { workspaces: { id: string; role: Role }[] }) {
  const [rows, setRows] = useState<IndexRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const all = await Promise.all(
          workspaces.map(async (w) => {
            const [c, a] = await Promise.all([
              api<{ decisions: RoomDecision[] }>(`/api/workspaces/${w.id}/decisions`),
              api<{ passports: PassportRec[] }>(`/api/workspaces/${w.id}/audit`),
            ]);
            return c.decisions.map((d) => ({ tenant: w.id, role: w.role, decision: d, passports: a.passports.filter((p) => p.decisionId === d.id).length }));
          }),
        );
        setRows(all.flat().sort((x, y) => (y.decision.proposedAt > x.decision.proposedAt ? 1 : -1)));
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [workspaces]);

  return (
    <section className="da-section" aria-labelledby="rm-rooms">
      <h2 id="rm-rooms"><span className="da-num">1</span>Your rooms</h2>
      <p className="da-lede">One room per decision in your workspaces ({workspaces.map((w) => `${w.id}, ${w.role}`).join('; ')}). Open a room to see its evidence, findings, review and passport.</p>
      {error ? <p className="ws-msg ws-msg--error" role="alert">{error}</p> : null}
      {rows === null && !error ? <p className="da-muted" role="status">Loading decisions…</p> : null}
      {rows && rows.length === 0 ? (
        <p className="da-muted">No decisions yet. A room opens when a decision is proposed: import the source documents and propose a decision in the <a href={`${WORKSPACE}#ws-decisions`}>evidence workspace</a>.</p>
      ) : null}
      {rows && rows.length > 0 ? (
        <div className="table-wrap">
          <table className="da-table rm-index table--stack">
            <thead>
              <tr><th scope="col">Decision</th><th scope="col">Status</th><th scope="col">Workspace</th><th scope="col">Evidence</th><th scope="col">Passports</th><th scope="col">Proposed</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.tenant}/${r.decision.id}`}>
                  <th scope="row" data-label="Decision"><a href={roomHref(r.tenant, r.decision.id)}>{r.decision.title}</a></th>
                  <td data-label="Status"><span className={`rm-status rm-status--${r.decision.status}`}>{STATUS_LABEL[r.decision.status]}</span></td>
                  <td data-label="Workspace">{r.tenant}</td>
                  <td data-label="Evidence">{r.decision.evidence.length} passage{r.decision.evidence.length === 1 ? '' : 's'}</td>
                  <td data-label="Passports">{r.passports || '–'}</td>
                  <td data-label="Proposed">{fmt(r.decision.proposedAt)}<br /><span className="da-muted">{r.decision.proposedByEmail ?? r.decision.proposedBy}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="rm-actions">
        <a className="da-btn" href={`${WORKSPACE}#ws-decisions`}>Propose a new decision</a>
        <a className="da-linkish" href={SAMPLE}>Open the sample room</a>
      </p>
    </section>
  );
}

interface Analysis { documentId: string; title: string; report: Report }

function Room({ tenant, decisionId, user, role }: { tenant: string; decisionId: string; user: User; role: Role | null }) {
  const [decision, setDecision] = useState<RoomDecision | null>(null);
  const [docs, setDocs] = useState<DocSummary[]>([]);
  const [cited, setCited] = useState<Map<string, RoomDocument>>(new Map());
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [passports, setPassports] = useState<PassportRec[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [analyses, setAnalyses] = useState<Analysis[] | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [withdrawn, setWithdrawn] = useState<Set<number>>(new Set());
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try {
      const [d, list, a] = await Promise.all([
        api<{ decision: RoomDecision }>(`/api/workspaces/${tenant}/decisions/${decisionId}`),
        api<{ documents: DocSummary[] }>(`/api/workspaces/${tenant}/documents`),
        api<{ events: AuditEvent[]; passports: PassportRec[] }>(`/api/workspaces/${tenant}/audit`),
      ]);
      const ids = [...new Set(d.decision.evidence.map((c) => c.documentId))];
      const full = await Promise.all(
        ids.map((id) => api<{ document: RoomDocument }>(`/api/workspaces/${tenant}/documents/${id}`).then((r) => r.document).catch(() => null)),
      );
      setDecision(d.decision);
      setDocs(list.documents);
      setCited(new Map(full.filter((x): x is RoomDocument => !!x).map((x) => [x.id, x])));
      setEvents(a.events);
      setPassports(a.passports.filter((p) => p.decisionId === decisionId));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [tenant, decisionId]);

  useEffect(() => {
    load();
  }, [load]);

  const cites = useMemo(() => (decision ? resolveEvidence(decision, cited) : []), [decision, cited]);
  const contradictions = useMemo(() => (analyses ?? []).flatMap((a) => a.report.findings.filter((f) => f.section === 'contradiction').map((f) => ({ a, f }))), [analyses]);
  const contested = useMemo(
    () => implicatedCitations(cites, contradictions.flatMap(({ a, f }) => f.spans.map((s) => a.report.spans.find((x) => x.id === s)?.quote ?? ''))),
    [cites, contradictions],
  );
  const cf = useMemo(() => counterfactual(cites, withdrawn, contested), [cites, withdrawn, contested]);

  const analyse = async () => {
    setAnalysing(true);
    setMessage(null);
    try {
      const out: Analysis[] = [];
      const docsCited = [...cited.values()];
      const runs: { id: string; title: string; filename: string; text: string }[] = docsCited.map((d) => ({ id: d.id, title: d.title, filename: d.filename, text: documentText(d) }));
      // Two or more documents: also read together, so a contradiction between them can surface.
      if (docsCited.length > 1)
        runs.push({ id: '*', title: 'All cited documents, read together', filename: 'cited-documents.md', text: docsCited.map((d) => `# ${d.title}\n\n${documentText(d)}`).join('\n\n') });
      for (const r of runs) {
        const text = r.text;
        const res = await fetch('/api/deep-analysis', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            filename: r.filename,
            useAi: false,
            extracted: { format: /\.(md|markdown)$/i.test(r.filename) ? 'md' : 'txt', text, pages: null, bytes: new TextEncoder().encode(text).length, bytesSha256: await sha256Hex(text) },
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { report?: Report; error?: string };
        if (!res.ok || !data.report) throw new Error(`${r.title}: ${data.error ?? `analysis failed (${res.status})`}`);
        out.push({ documentId: r.id, title: r.title, report: data.report });
      }
      setAnalyses(out);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setAnalysing(false);
    }
  };

  const decide = async (action: 'approve' | 'reject') => {
    setBusy(true);
    setMessage(null);
    try {
      const r = await api<{ decision: RoomDecision }>(`/api/workspaces/${tenant}/decisions/${decisionId}/decision`, { method: 'POST', body: { action, note } });
      setMessage(`Decision ${r.decision.status}.`);
      setNote('');
      await load();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const exportPassport = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const auth = await freshAuthHeader();
      const res = await fetch(`/api/workspaces/${tenant}/decisions/${decisionId}/passport`, { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: '{}' });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'Export failed.');
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'workspace-decision.bundle.json';
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = name;
      link.click();
      URL.revokeObjectURL(link.href);
      setMessage(`Exported ${name}. Passport SHA-256 ${res.headers.get('x-passport-sha256')}.`);
      await load();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (error)
    return (
      <Notice title="This room could not be opened">
        <p>{error}</p>
        <p><a href="/institutional/decision-room">Back to your rooms</a></p>
      </Notice>
    );
  if (!decision) return <p className="da-muted" role="status">Opening the room…</p>;

  const review = reviewOf(decision);
  const can = reviewActions(decision, user.uid, role);
  const trail = events.filter((e) => e.entityId === decision.id || decision.evidence.some((c) => c.documentId === e.entityId));
  const citedIds = new Set(decision.evidence.map((c) => c.documentId));
  const SECTIONS = ['Decision record', 'Evidence', 'Deep Analysis findings', 'Contradictions', 'Counterfactual', 'Two-person review', 'Decision Passport'];

  return (
    <article className="da-report rm-room" aria-labelledby="rm-title">
      <header className="da-reporthead">
        <p className="da-kicker">Decision Room · Workspace {tenant}</p>
        <h2 className="da-title" id="rm-title">{decision.title}</h2>
        <div className="da-actions"><a className="da-btn" href="/institutional/decision-room">All rooms</a></div>
        <dl className="da-docmeta">
          <div><dt>Status</dt><dd><span className={`rm-status rm-status--${decision.status}`}>{STATUS_LABEL[decision.status]}</span></dd></div>
          <div><dt>Proposed</dt><dd>{decision.proposedByEmail ?? decision.proposedBy}<br />{fmt(decision.proposedAt)}</dd></div>
          <div><dt>Evidence</dt><dd>{decision.evidence.length} passage{decision.evidence.length === 1 ? '' : 's'} · {citedIds.size} document{citedIds.size === 1 ? '' : 's'}</dd></div>
          <div><dt>Decision id</dt><dd className="ws-mono">{decision.id}</dd></div>
        </dl>
      </header>
      <div aria-live="polite">{message ? <p className="ws-msg">{message}</p> : null}</div>

      <nav className="da-nav" aria-label="Room sections">
        <ol>{SECTIONS.map((s, i) => <li key={s}><a href={`#rm-s${i + 1}`}><span className="da-num">{i + 1}</span>{s}</a></li>)}</ol>
      </nav>

      <section className="da-section" id="rm-s1" aria-labelledby="rm-h1">
        <h2 id="rm-h1"><span className="da-num">1</span>Decision record</h2>
        <table className="da-table da-kv">
          <tbody>
            <tr><th scope="row">Question</th><td>{decision.question}</td></tr>
            <tr><th scope="row">Conclusion</th><td>{decision.conclusion}</td></tr>
            <tr><th scope="row">Rationale</th><td>{decision.rationale || <span className="da-muted">None given.</span>}</td></tr>
            <tr><th scope="row">Review note</th><td>{decision.decisionNote ?? <span className="da-muted">Not yet reviewed.</span>}</td></tr>
          </tbody>
        </table>
      </section>

      <section className="da-section" id="rm-s2" aria-labelledby="rm-h2">
        <h2 id="rm-h2"><span className="da-num">2</span>Evidence</h2>
        <p className="da-lede">Each cited passage as stored in the workspace. &ldquo;Intact&rdquo; means the passage still has the SHA-256 hash recorded when the decision was proposed.</p>
        <ol className="rm-cites">
          {cites.map((c) => (
            <li key={c.index} className={withdrawn.has(c.index) ? 'is-withdrawn' : undefined}>
              <p className="rm-cite__head">
                <strong>{c.documentTitle ?? 'Document not found'}</strong> · passage {c.passage}{' '}
                <span className={`rm-tag${c.intact === false ? ' rm-tag--warn' : ''}`}>{c.intact === true ? 'Intact' : c.intact === false ? 'Changed since citing' : 'Not found'}</span>
                {contested.has(c.index) ? <span className="rm-tag rm-tag--warn">Touched by a contradiction</span> : null}
              </p>
              {c.text ? <blockquote className="rm-passage">{c.text}</blockquote> : null}
              {c.note ? <p className="da-muted">Note: {c.note}</p> : null}
            </li>
          ))}
        </ol>
        <h3>Documents in this workspace</h3>
        {docs.length ? (
          <div className="table-wrap">
            <table className="da-table">
              <thead><tr><th scope="col">Document</th><th scope="col">Passages</th><th scope="col">Text SHA-256</th><th scope="col">Imported</th></tr></thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id}>
                    <th scope="row">{d.title}{citedIds.has(d.id) ? <span className="rm-tag">Cited</span> : null}<br /><span className="da-muted">{d.filename}</span></th>
                    <td>{d.passages}</td>
                    <td className="ws-mono">{d.textSha256.slice(0, 16)}…</td>
                    <td>{fmt(d.importedAt)}<br /><span className="da-muted">{d.importedByEmail ?? d.importedBy}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="da-muted">No documents.</p>}
      </section>

      <section className="da-section" id="rm-s3" aria-labelledby="rm-h3">
        <h2 id="rm-h3"><span className="da-num">3</span>Deep Analysis findings</h2>
        <p className="da-lede">
          The rule-based layer of <a href="/institutional/workspace/deep-analysis">Deep Analysis</a>, run on the cited documents as stored here. No AI call is made and nothing
          is stored; the findings exist in this browser until you leave the page.
        </p>
        {analyses === null ? (
          <p className="rm-actions">
            <button className="da-btn da-btn--primary" type="button" disabled={analysing || cited.size === 0} onClick={analyse}>
              {analysing ? 'Analysing…' : `Analyse the ${cited.size} cited document${cited.size === 1 ? '' : 's'}`}
            </button>
          </p>
        ) : (
          <div className="rm-analyses">
            {analyses.map((a) => {
              const fs = a.report.finalStatement;
              const byId = new Map(a.report.findings.map((f) => [f.id, f]));
              const key = fs.keyConcerns.map((id) => byId.get(id)).filter((f): f is Finding => !!f);
              const shown = (key.length ? key : a.report.findings.filter((f) => f.severity === 'high' || f.severity === 'medium')).slice(0, 4);
              return (
                <div className="rm-analysis" key={a.documentId}>
                  <h3>{a.title}</h3>
                  <p className="rm-rating">{RATING[fs.rating]} <span className="da-muted">· confidence {fs.confidence} · {a.report.findings.length} findings · report seal {a.report.seal.reportSha256.slice(0, 12)}…</span></p>
                  <p className="da-exec__label">{key.length ? 'Key concerns' : 'Main risks'}</p>
                  {shown.length ? <FindingList report={a.report} findings={shown} /> : <p className="da-muted">None reported by the rule-based checks.</p>}
                </div>
              );
            })}
            <p><button className="da-linkish" type="button" disabled={analysing} onClick={analyse}>Run again</button></p>
          </div>
        )}
      </section>

      <section className="da-section" id="rm-s4" aria-labelledby="rm-h4">
        <h2 id="rm-h4"><span className="da-num">4</span>Contradictions</h2>
        <p className="da-lede">Places where the cited documents disagree with themselves or with each other, from the analysis above. A cited passage touched by a contradiction is marked in the evidence.</p>
        {analyses === null ? (
          <p className="da-muted">Run the analysis in section 3 to check the cited documents for contradictions.</p>
        ) : contradictions.length === 0 ? (
          <p className="da-muted">No contradiction was found by the rule-based checks. That is not proof that none exists.</p>
        ) : (
          <ul className="da-findings">
            {contradictions.map(({ a, f }) => (
              <li className="da-finding" key={`${a.documentId}/${f.id}`}>
                <p className="da-finding__head"><span>{f.title}</span><span className="da-tags">{f.severity ? <span className={`da-sev da-sev--${f.severity}`}>{f.severity}</span> : null}</span></p>
                <p className="da-finding__detail">{f.detail}</p>
                <p className="da-muted">In: {a.title}</p>
                {f.spans.map((s) => {
                  const q = a.report.spans.find((x) => x.id === s)?.quote;
                  return q && !f.detail.includes(q) ? <blockquote className="rm-passage" key={s}>{q}</blockquote> : null;
                })}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="da-section" id="rm-s5" aria-labelledby="rm-h5">
        <h2 id="rm-h5"><span className="da-num">5</span>Counterfactual: if evidence fell away</h2>
        <p className="da-lede">Strike out citations — a document withdrawn, a passage found wrong — and see what the decision would still rest on. This shows dependency only; it does not re-decide.</p>
        <fieldset className="rm-cf">
          <legend className="da-exec__label">Withdraw</legend>
          {cites.map((c) => (
            <label key={c.index} className="da-check">
              <input
                type="checkbox"
                checked={withdrawn.has(c.index)}
                onChange={(e) => {
                  const next = new Set(withdrawn);
                  if (e.target.checked) next.add(c.index);
                  else next.delete(c.index);
                  setWithdrawn(next);
                }}
              />
              <span>{c.documentTitle ?? c.documentId}, passage {c.passage}{c.note ? ` (${c.note})` : ''}</span>
            </label>
          ))}
        </fieldset>
        <p className={`rm-cf__result${cf.unsupported ? ' is-unsupported' : ''}`} role="status">{cf.summary}</p>
      </section>

      <section className="da-section" id="rm-s6" aria-labelledby="rm-h6">
        <h2 id="rm-h6"><span className="da-num">6</span>Two-person review</h2>
        <table className="da-table da-kv">
          <tbody>
            <tr><th scope="row">Status</th><td>{review.label}</td></tr>
            <tr><th scope="row">Proposed by</th><td>{decision.proposedByEmail ?? decision.proposedBy} · {fmt(decision.proposedAt)}</td></tr>
            <tr><th scope="row">Reviewed by</th><td>{decision.decidedAt ? `${decision.decidedByEmail ?? decision.decidedBy} · ${fmt(decision.decidedAt)}` : <span className="da-muted">Not yet</span>}</td></tr>
            <tr>
              <th scope="row">Two-person rule</th>
              <td>{review.twoPersonRule === null ? 'Pending: the reviewer must be a different editor from the proposer.' : review.twoPersonRule ? 'Met: reviewer and proposer are different accounts.' : 'Not met.'}</td>
            </tr>
          </tbody>
        </table>
        <p className="da-muted rm-gap">{can.reason}</p>
        {can.canReview ? (
          <div className="ws-form rm-review">
            <label>Review note<input value={note} minLength={3} onChange={(e) => setNote(e.target.value)} /></label>
            <div className="rm-actions">
              <button className="da-btn da-btn--primary" type="button" disabled={busy || note.trim().length < 3} onClick={() => decide('approve')}>Approve</button>
              <button className="da-btn" type="button" disabled={busy || note.trim().length < 3} onClick={() => decide('reject')}>Reject</button>
            </div>
          </div>
        ) : null}
        <h3>Audit trail</h3>
        <p className="da-muted">Append-only; each entry was written in the same database batch as the change it records.</p>
        <div className="table-wrap">
          <table className="da-table">
            <thead><tr><th scope="col">Time</th><th scope="col">Event</th><th scope="col">By</th><th scope="col">Detail</th></tr></thead>
            <tbody>
              {trail.map((e) => (
                <tr key={e.id}><td>{fmt(e.at)}</td><td>{e.changeType}</td><td>{e.actorEmail ?? e.actorId}</td><td>{e.detail}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="da-section" id="rm-s7" aria-labelledby="rm-h7">
        <h2 id="rm-h7"><span className="da-num">7</span>Decision Passport</h2>
        <p className="da-lede">
          The exported record: decision, cited passages with their hashes, review and audit entries, in one bundle that verifies offline. Each export is listed with its SHA-256 and whether it
          is signed.
        </p>
        {passports.length ? (
          <ul className="rm-passports">
            {passports.map((p) => (
              <li key={p.sha256}><span className="ws-mono">{p.sha256}</span><br /><span className="da-muted">{p.decisionStatus} · {p.signed ? 'signed' : 'unsigned'} · exported {fmt(p.exportedAt)}</span></li>
            ))}
          </ul>
        ) : (
          <p className="da-muted">No passport exported yet.</p>
        )}
        <p className="rm-actions">
          <button className="da-btn da-btn--primary" type="button" disabled={busy} onClick={exportPassport}>Export passport bundle</button>
          {DECISION_PASSPORT_HUB.live ? <a className="da-linkish" href={DECISION_PASSPORT_HUB.href}>About Decision Passports</a> : null}
        </p>
      </section>
    </article>
  );
}

function FindingList({ report, findings }: { report: Report; findings: Finding[] }) {
  return (
    <ul className="da-findings">
      {findings.map((f) => (
        <li className="da-finding" key={f.id}>
          <p className="da-finding__head"><span>{f.title}</span><span className="da-tags">{f.severity ? <span className={`da-sev da-sev--${f.severity}`}>{f.severity}</span> : null}</span></p>
          <p className="da-finding__detail">{f.detail}</p>
          {f.spans.slice(0, 1).map((s) => {
            const q = report.spans.find((x) => x.id === s)?.quote;
            return q && !f.detail.includes(q) ? <blockquote className="rm-passage" key={s}>{q.length > 400 ? `${q.slice(0, 400)}…` : q}</blockquote> : null;
          })}
        </li>
      ))}
    </ul>
  );
}

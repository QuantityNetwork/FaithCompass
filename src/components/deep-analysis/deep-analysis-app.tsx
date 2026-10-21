'use client';
/**
 * Deep Analysis: upload one document, get a cited report and a final statement. The file is analysed in memory on
 * the server and nothing is stored; the report lives only in this browser tab until exported.
 */
import { useEffect, useRef, useState } from 'react';
import { firebaseClientAvailable, freshAuthHeader, watchUser } from '@/lib/firebase/client';
import type { Report } from '@/lib/deep-analysis/schema';
import { ReportView } from './report-view';
import { CreatePassportDraft } from '@/components/passport/create-draft';

const SAMPLES = [
  { id: 'sample-service-agreement', file: 'sample-service-agreement.md', title: 'Service agreement' },
  { id: 'sample-nda', file: 'sample-nda.md', title: 'Mutual non-disclosure agreement' },
  { id: 'sample-supplier-contract', file: 'sample-supplier-contract.md', title: 'Supply agreement' },
] as const;
const MAX_MB = 15;
/** Larger files are read in the browser and only their text is sent (the server's request body is capped). */
const DIRECT_MB = 3;

type ViewerState = 'signed-out' | 'eligible' | 'email-not-verified' | 'invalid';
interface Status {
  ai: { configured: boolean; model: string | null; access: 'deployment-protected' | 'signed-in' | 'local'; perUserDailyLimit?: number };
  viewer?: { state: ViewerState; remainingToday?: number };
}
const SIGN_IN = '/institutional/workspace/sign-in?next=%2Finstitutional%2Fworkspace%2Fdeep-analysis';

function toBase64(buf: ArrayBuffer): string {
  let s = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DeepAnalysisApp() {
  const [status, setStatus] = useState<Status | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [useAi, setUseAi] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ report: Report; bundle: unknown; recorded?: string } | null>(null);
  const top = useRef<HTMLDivElement>(null);

  const loadStatus = async () => {
    const auth = firebaseClientAvailable() ? await freshAuthHeader().catch(() => null) : null;
    await fetch('/api/deep-analysis', { headers: auth ?? {} }).then((r) => r.json()).then(setStatus).catch(() => setStatus(null));
  };
  useEffect(() => {
    if (!firebaseClientAvailable()) {
      void loadStatus();
      return;
    }
    let off: (() => void) | undefined;
    watchUser(() => void loadStatus()).then((u) => (off = u)).catch(() => void loadStatus());
    return () => off?.();
  }, []);

  const show = (r: { report: Report; bundle: unknown; recorded?: string }) => {
    setResult(r);
    setTimeout(() => top.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  async function analyse(name: string, buf: ArrayBuffer, sample = false) {
    setError(null);
    if (buf.byteLength > MAX_MB * 1024 * 1024) return setError(`Files up to ${MAX_MB} MB are accepted.`);
    const withAi = aiAllowed && useAi;
    setBusy(withAi ? 'Analysing with the rules and the AI layer; with a long document this can take several minutes…' : 'Analysing…');
    try {
      let payload: Record<string, unknown> = { filename: name, contentBase64: '' };
      if (buf.byteLength > DIRECT_MB * 1024 * 1024) {
        setBusy('Reading the file in your browser…');
        const { extractInBrowser } = await import('./extract-client');
        payload = { filename: name, extracted: await extractInBrowser(name, buf) };
        setBusy(withAi ? 'Analysing with the rules and the AI layer; with a long document this can take several minutes…' : 'Analysing…');
      } else payload.contentBase64 = toBase64(buf);
      const auth = firebaseClientAvailable() ? await freshAuthHeader().catch(() => null) : null;
      const res = await fetch('/api/deep-analysis', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(auth ?? {}) },
        body: JSON.stringify({ ...payload, sample, useAi: withAi }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) void loadStatus();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `The analysis failed (${res.status}).`);
      show(data as { report: Report; bundle: unknown });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The analysis failed.');
    } finally {
      setBusy(null);
    }
  }

  async function runSample(s: (typeof SAMPLES)[number]) {
    const res = await fetch(`/deep-analysis/samples/${s.file}`);
    await analyse(s.file, await res.arrayBuffer(), true);
  }

  async function openRecorded(s: (typeof SAMPLES)[number]) {
    setError(null);
    const res = await fetch(`/deep-analysis/samples/${s.id}.report.json`);
    if (!res.ok) return setError('The recorded report is not available.');
    const report = (await res.json()) as Report;
    const { buildDeepBundleClient } = await import('./bundle-client');
    show({ report, bundle: buildDeepBundleClient(report), recorded: `recorded run with the AI layer, ${report.generatedAt.slice(0, 10)}` });
  }

  const ai = status?.ai;
  const viewer = status?.viewer?.state ?? 'signed-out';
  const aiAllowed = !!ai?.configured && (ai.access !== 'signed-in' || viewer === 'eligible');
  return (
    <div className="da">
      <aside className="da-notice" aria-label="Terms of this preview">
        <p className="da-notice__title">Important notice</p>
        <ol>
          <li><strong>Not legal advice; not reviewed by a lawyer.</strong> The report supports, and does not replace, professional review.</li>
          <li>Confidential client documents may not be submitted yet; the security review for client data is not complete. Use your own or sample documents.</li>
          <li>Nothing is stored. The document is analysed in memory and discarded; the report remains in this browser tab until exported.</li>
          <li>Accepted formats: PDF with a text layer, Word (.docx), plain text or Markdown, up to {MAX_MB} MB. Scanned PDFs without text are not supported. Files over {DIRECT_MB} MB are read in your browser and only their text is sent.</li>
          <li>
            AI layer on this deployment:{' '}
            {!status ? 'checking…' : ai?.configured ? (
              <>
                <strong>available ({ai.model})</strong>
                {ai.access === 'signed-in' ? ` to any signed-in account with a verified email address, up to ${ai.perUserDailyLimit ?? 10} analyses per account per day` : ''}
              </>
            ) : (
              <strong>not configured — rule-based analysis only</strong>
            )}
            .
          </li>
          <li>
            Privacy: with the AI layer, the text of the document is sent to OpenAI for analysis. AbrahamMoses does not store the document or the report.
            Without the AI layer, the text does not leave AbrahamMoses. See the <a href="/privacy#deep-analysis">privacy notice</a>.
          </li>
        </ol>
      </aside>

      <div className="da-start">
        <form className="da-panel ws-form" onSubmit={async (e) => { e.preventDefault(); if (file) await analyse(file.name, await file.arrayBuffer()); }}>
          <h2><span className="da-num">A.</span>Submit a document</h2>
          <label>
            Document
            <input type="file" accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          {ai?.configured && !aiAllowed ? (
            <div className="da-gate" role="status">
              {viewer === 'email-not-verified' ? (
                <p>
                  <strong>AI layer: verify your email address first.</strong> Open the link we sent you, or <a href={SIGN_IN}>send it again</a>. The rule-based
                  analysis runs now without it.
                </p>
              ) : viewer === 'invalid' ? (
                <p>
                  <strong>AI layer: your sign-in has expired.</strong> <a href={SIGN_IN}>Sign in again</a>. The rule-based analysis runs without it.
                </p>
              ) : (
                <p>
                  <strong>AI layer: sign in to use it.</strong> <a href={SIGN_IN}>Sign in or create a free account</a> with Google or an email address. Without
                  an account, the rule-based analysis runs.
                </p>
              )}
            </div>
          ) : null}
          {aiAllowed ? (
            <label className="da-check"><input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} /> Include the AI layer. Every AI finding must quote the document verbatim, or it is discarded.{status?.viewer?.remainingToday !== undefined ? ` ${status.viewer.remainingToday} of ${ai?.perUserDailyLimit ?? 10} AI analyses left today.` : ''}</label>
          ) : null}
          <div><button type="submit" className="da-btn da-btn--primary" disabled={!file || !!busy}>Analyse document</button></div>
        </form>
        <div className="da-panel">
          <h2><span className="da-num">B.</span>Sample documents</h2>
          <p className="da-muted">Three fictional documents prepared for this demonstration, each containing deliberate defects.</p>
          <table className="da-table da-samples">
            <tbody>
              {SAMPLES.map((s) => (
                <tr key={s.id}>
                  <th scope="row">{s.title}</th>
                  <td>
                    <div className="da-row">
                      <button type="button" className="da-btn" disabled={!!busy} onClick={() => runSample(s)}>Analyse</button>
                      <button type="button" className="da-linkish" onClick={() => openRecorded(s)}>Recorded AI report</button>
                      <a className="da-linkish" href={`/deep-analysis/samples/${s.file}`} download>Text</a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div aria-live="polite">
        {busy ? <p className="ws-msg">{busy}</p> : null}
        {error ? <p className="ws-msg ws-msg--error" role="alert">{error}</p> : null}
      </div>

      <div ref={top} />
      {result ? <ReportView report={result.report} recorded={result.recorded} onJson={() => download(`deep-analysis-${result.report.seal.reportSha256.slice(0, 12)}.bundle.json`, result.bundle)} /> : null}
      {result && !result.recorded ? <CreatePassportDraft bundle={result.bundle} /> : null}
    </div>
  );
}

'use client';
/**
 * Deep Analysis: upload one document, get a cited report and a final statement. The file is analysed in memory on
 * the server and nothing is stored; the report lives only in this browser tab until exported.
 */
import { useEffect, useRef, useState } from 'react';
import { firebaseClientAvailable, freshAuthHeader } from '@/lib/firebase/client';
import type { Report } from '@/lib/deep-analysis/schema';
import { ReportView } from './report-view';

const SAMPLES = [
  { id: 'sample-service-agreement', file: 'sample-service-agreement.md', title: 'Service agreement' },
  { id: 'sample-nda', file: 'sample-nda.md', title: 'Mutual non-disclosure agreement' },
  { id: 'sample-supplier-contract', file: 'sample-supplier-contract.md', title: 'Supply agreement' },
] as const;
const MAX_MB = 3;

interface Status { ai: { configured: boolean; model: string | null; access: 'deployment-protected' | 'signed-in' | 'local' } }

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

  useEffect(() => {
    fetch('/api/deep-analysis').then((r) => r.json()).then(setStatus).catch(() => setStatus(null));
  }, []);

  const show = (r: { report: Report; bundle: unknown; recorded?: string }) => {
    setResult(r);
    setTimeout(() => top.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  async function analyse(name: string, buf: ArrayBuffer, sample = false) {
    setError(null);
    if (buf.byteLength > MAX_MB * 1024 * 1024) return setError(`Files up to ${MAX_MB} MB are accepted.`);
    setBusy(status?.ai.configured && useAi ? 'Analysing with the rules and the AI layer; this takes up to a minute…' : 'Analysing…');
    try {
      const auth = firebaseClientAvailable() ? await freshAuthHeader().catch(() => null) : null;
      const res = await fetch('/api/deep-analysis', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(auth ?? {}) },
        body: JSON.stringify({ filename: name, contentBase64: toBase64(buf), sample, useAi }),
      });
      const data = await res.json().catch(() => ({}));
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
  return (
    <div className="da">
      <div className="da-notice" role="note">
        <p><strong>Preview. Not legal advice; not reviewed by a lawyer.</strong></p>
        <ul>
          <li>Do not upload confidential client documents yet: the security review for client data is not complete. Use your own or sample documents.</li>
          <li>Nothing is stored. The file is analysed in memory and discarded; the report stays in this tab until you export it.</li>
          <li>Accepted: PDF with a text layer, Word (.docx), plain text or Markdown, up to {MAX_MB} MB. Scanned PDFs without text are not supported.</li>
          <li>
            AI layer on this deployment:{' '}
            {!status ? 'checking…' : ai?.configured ? <strong>available ({ai.model}){ai.access === 'signed-in' ? ' for signed-in, approved accounts' : ''}</strong> : <strong>not configured — rule-based analysis only</strong>}.
          </li>
        </ul>
      </div>

      <div className="ws-grid da-start">
        <form className="ws-panel ws-form" onSubmit={async (e) => { e.preventDefault(); if (file) await analyse(file.name, await file.arrayBuffer()); }}>
          <h2>Analyse a document</h2>
          <label>
            Document
            <input type="file" accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          {ai?.configured ? (
            <label className="da-check"><input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} /> Use the AI layer (every AI finding must quote the document verbatim or it is dropped)</label>
          ) : null}
          <div className="ws-row"><button type="submit" className="button button--solid" disabled={!file || !!busy}>Analyse</button></div>
        </form>
        <div className="ws-panel">
          <h2>Try a sample</h2>
          <p className="ws-hint">Three fictional documents written for this demonstration, each with deliberate problems.</p>
          <table className="ws-table da-samples">
            <tbody>
              {SAMPLES.map((s) => (
                <tr key={s.id}>
                  <th scope="row">{s.title}</th>
                  <td>
                    <div className="ws-row">
                      <button type="button" className="button" disabled={!!busy} onClick={() => runSample(s)}>Analyse now</button>
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
    </div>
  );
}

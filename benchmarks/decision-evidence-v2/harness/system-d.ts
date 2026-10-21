/**
 * System D: the integrated SDEP / Decision Twin pipeline (src/lib/evidence-graph/case-pipeline.ts) with the
 * AI-candidate layer (src/lib/contradiction/ai-candidates.ts) on the same model and settings as baselines A and B.
 * Nothing here decides anything: it calls the product code and maps its result to the benchmark's output format.
 *
 * Findings scored = deterministic findings + AI candidates that survive the deterministic veto (classes as the
 * product shows them: AI candidates are capped at POTENTIAL_CONFLICT). Citations and dependencies are the
 * pipeline's (AI-proposed links resolved through the graph, superseded spans replaced).
 */
import { createAiReader } from '@/lib/contradiction/ai-candidates';
import type { Fact } from '@/lib/contradiction/normalize';
import { runCasePipeline, type CaseResult } from '@/lib/evidence-graph/case-pipeline';
import { LLM, RAW, complete } from '../../decision-evidence-v1/harness/baselines';
import type { Baseline, BenchCase, SystemOutput } from '../../decision-evidence-v1/harness/types';

export const MODEL = { provider: LLM.provider, version: LLM.model };

export function caseInput(c: BenchCase) {
  return { id: c.id, question: c.title, tenant: `bench-${c.id}`, documents: c.documents, spans: c.spans, facts: c.facts as unknown as Fact[], conclusions: c.conclusions };
}

export function toOutput(r: CaseResult, ms: number, usd: number): SystemOutput {
  return {
    findings: [...r.layers.deterministic.map((f) => ({ facts: f.facts, class: f.class })), ...r.layers.candidates.map((f) => ({ facts: [f.facts[0], f.facts[1]] as [string, string], class: f.class }))],
    citations: r.citations,
    dependencies: r.dependencies,
    ms,
    usd,
  };
}

/** Details kept per case besides the scored output. */
export const DETAIL: Record<string, { deterministic: number; candidates: number; candidatePairs: string[]; sha256: string; integrity_ok: boolean; integrity_codes: Record<string, number>; vetoed: { facts: string[]; class: string; reason: string }[]; impact: Record<string, string[]>; ai: CaseResult['ai'] }> = {};

export function remember(id: string, r: CaseResult) {
  const codes: Record<string, number> = {};
  for (const f of r.integrity.findings) codes[`${f.severity}:${f.code}`] = (codes[`${f.severity}:${f.code}`] ?? 0) + 1;
  DETAIL[id] = { deterministic: r.layers.deterministic.length, candidates: r.layers.candidates.length, candidatePairs: r.layers.candidates.map((x) => [...x.facts].sort().join('|')), sha256: r.sha256, integrity_ok: r.integrity.ok, integrity_codes: codes, vetoed: r.layers.vetoed.map((v) => ({ facts: v.facts, class: v.class, reason: v.vetoReason })), impact: r.impact, ai: r.ai };
}

/** Replay D from a stored model answer (no network): used by tests and to re-derive results from committed raw outputs. */
export async function replayD(c: BenchCase, content: string) {
  const reader = createAiReader(`${MODEL.provider}:${MODEL.version}`, async () => content);
  return runCasePipeline(caseInput(c), { reader, model: MODEL });
}

export const systemD: Baseline = {
  id: 'D',
  name: `Integrated SDEP / Decision Twin pipeline (${'case-pipeline/1.0.0'}): deterministic layer + AI-candidate layer (${LLM.model}) with deterministic veto, evidence graph, supersession, integrity check, impact, sealed digest`,
  produces: { findings: true, citations: true, dependencies: true },
  availability: () => (process.env.OPENAI_API_KEY || process.env.BENCH_LLM_API_KEY ? { status: 'READY' } : { status: 'BLOCKED', reason: 'no API key configured (OPENAI_API_KEY unset); the AI-candidate layer cannot run, no call was made' }),
  async run(c) {
    let call: Awaited<ReturnType<typeof complete>> | null = null;
    let prompt = '';
    const reader = createAiReader(`${MODEL.provider}:${MODEL.version}`, async (p) => {
      prompt = p;
      call = await complete(p);
      return call.response.content;
    });
    const t0 = performance.now();
    const r = await runCasePipeline(caseInput(c), { reader, model: MODEL });
    const ms = performance.now() - t0;
    const done = call as Awaited<ReturnType<typeof complete>> | null;
    if (done) RAW.sink?.('D', c.id, { ...done, prompt, extra: { sdep_sha256: r.sha256 } });
    remember(c.id, r);
    return toOutput(r, ms, done?.usd ?? 0);
  },
};

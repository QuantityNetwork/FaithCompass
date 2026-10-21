/**
 * Baselines A–D. A and B call the OpenAI Chat Completions API with the model in `LLM` when OPENAI_API_KEY is set;
 * without a key they report BLOCKED and make no network call. The key is never written anywhere. D needs human reviewers; none have been recruited, so it is BLOCKED. Nothing is ever estimated.
 */
import { performance } from 'node:perf_hooks';
import { detectDeterministic } from './frozen-c/detect';
import type { Fact } from './frozen-c/normalize';
import type { Baseline, BenchCase, SystemOutput } from './types';

/* ------------------------------------------------------------------ C */

/** C: the previous Decision Twin's deterministic contradiction layer (byte-for-byte copy of src/lib/contradiction/{detect,normalize}.ts at cad6e95 in ./frozen-c, so later product changes cannot alter C). */
export const baselineC: Baseline = {
  id: 'C',
  name: 'Previous Decision Twin: deterministic contradiction layer over the structured facts',
  // C has no mechanism that reads conclusion text or arbitrary documents, so it produces no citations or dependencies.
  produces: { findings: true, citations: false, dependencies: false },
  availability: () => ({ status: 'READY' }),
  async run(c) {
    const t0 = performance.now();
    const found = detectDeterministic(c.facts as unknown as Fact[]);
    const ms = performance.now() - t0;
    return { findings: found.map((f) => ({ facts: f.facts, class: f.class })), ms, usd: 0 };
  },
};

/* --------------------------------------------------------------- A / B */

/**
 * Model configuration, fixed before the eval run. One model for A and B; temperature 0 and a fixed seed (OpenAI
 * documents seed as best-effort determinism, so the raw outputs are committed rather than relied on to reproduce).
 */
export const LLM = {
  provider: 'openai',
  model: 'gpt-4.1-mini-2025-04-14',
  temperature: 0,
  seed: 20261020,
  response_format: 'json_object',
  usd_per_1m_input: 0.4,
  usd_per_1m_output: 1.6,
} as const;
/** dev-validated-2: round 1 on dev over-flagged consistent pairs; round 2 lists the exclusions the deterministic
 * layer (C) also applies. Frozen before the eval run. */
export const PROMPT_VERSION = 'dev-validated-2';
const CLASSES = ['CONFIRMED_CONFLICT', 'POTENTIAL_CONFLICT', 'DIFFERENT_REPORTING_BASIS', 'MISSING_EVIDENCE', 'UNRESOLVED_INTERPRETATION'];

const INSTRUCTIONS = [
  'You review documents for a decision. Every statement that can be cited is labelled [Dn#sm] immediately before it.',
  'Task 1. List every pair of labelled statements that are in tension, each with exactly one class:',
  '- CONFIRMED_CONFLICT: the same measure for the same entity and period, with different values; or two mutually exclusive options both asserted.',
  '- POTENTIAL_CONFLICT: values differ but one statement lacks context (e.g. no period), so it may or may not be a conflict.',
  '- DIFFERENT_REPORTING_BASIS: the same measure stated on a different basis or definition (e.g. reported vs adjusted).',
  '- MISSING_EVIDENCE: one document gives a value that another document says is not provided.',
  '- UNRESOLVED_INTERPRETATION: two different readings of the same term.',
  'Do not list pairs that are consistent or about different things: different periods, a figure replaced by a later version or amendment, the same amount in different units or scales, differences within rounding (under 0.5%), or different entities. Use any definitions stated in the documents.',
  'Task 2. For each conclusion, cite the labelled statements that are evidence for it, and list every labelled statement it depends on (the statements of each figure it relies on, excluding superseded figures and figures of other entities).',
  'Answer with one JSON object only: {"findings":[{"facts":["D1#s1","D2#s3"],"class":"CONFIRMED_CONFLICT"}],"citations":{"C1":["D1#s1"]},"dependencies":{"C1":["D1#s1","D2#s3"]}}',
].join('\n');

/** Raw documents with span labels inserted in place (A sees everything). */
export function labelledDocuments(c: Pick<BenchCase, 'documents' | 'spans'>) {
  return c.documents.map((d) => {
    let text = d.text;
    for (const s of [...c.spans].filter((x) => x.doc === d.id).sort((a, b) => b.start - a.start)) text = `${text.slice(0, s.start)}[${s.id}] ${text.slice(s.start)}`;
    return `## ${d.id} ${d.title}\n${text}`;
  });
}

export function buildPrompt(c: Pick<BenchCase, 'conclusions'>, context: string[]) {
  return [INSTRUCTIONS, '', '# Documents', context.join('\n\n'), '', '# Conclusions', ...c.conclusions.map((x) => `${x.id}: ${x.text}`)].join('\n');
}

export function parseAnswer(text: string, c: BenchCase): Omit<SystemOutput, 'ms' | 'usd'> & { parse_ok: boolean; dropped: number } {
  const ids = new Set(c.spans.map((s) => s.id));
  const m = text.match(/\{[\s\S]*\}/);
  let j: any = null;
  try {
    j = m ? JSON.parse(m[0]) : null;
  } catch {
    j = null;
  }
  const raw = Array.isArray(j?.findings) ? j.findings : [];
  const findings = raw
    .filter((f: any) => Array.isArray(f?.facts) && f.facts.length === 2 && f.facts[0] !== f.facts[1] && f.facts.every((x: string) => ids.has(x)) && CLASSES.includes(f.class))
    .map((f: any) => ({ facts: [f.facts[0], f.facts[1]] as [string, string], class: f.class }));
  const clean = (o: any) => Object.fromEntries(c.conclusions.map((x) => [x.id, [...new Set<string>((Array.isArray(o?.[x.id]) ? o[x.id] : []).filter((s: string) => ids.has(s)))]]));
  return { findings, citations: clean(j?.citations), dependencies: clean(j?.dependencies), parse_ok: j !== null, dropped: raw.length - findings.length };
}

const apiKey = () => process.env.OPENAI_API_KEY || process.env.BENCH_LLM_API_KEY || '';
const llmAvailability = () =>
  apiKey() ? ({ status: 'READY' } as const) : ({ status: 'BLOCKED', reason: 'no API key configured (OPENAI_API_KEY unset); no call was made' } as const);

export interface RawCall {
  request: { model: string; temperature: number; seed: number; response_format: string; prompt_sha256: string; prompt_chars: number };
  response: { model: string | null; system_fingerprint: string | null; content: string; usage: { prompt_tokens: number; completion_tokens: number } | null; finish_reason: string | null };
  ms: number;
  usd: number;
}

export async function complete(prompt: string): Promise<RawCall> {
  const { createHash } = await import('node:crypto');
  const t0 = performance.now();
  let res: Response | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey()}` },
      body: JSON.stringify({ model: LLM.model, temperature: LLM.temperature, seed: LLM.seed, response_format: { type: LLM.response_format }, messages: [{ role: 'user', content: prompt }] }),
    });
    if (res.status !== 429 && res.status < 500) break;
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
  if (!res || !res.ok) throw new Error(`OpenAI returned ${res?.status}`);
  const j: any = await res.json();
  const usage = j.usage ? { prompt_tokens: j.usage.prompt_tokens, completion_tokens: j.usage.completion_tokens } : null;
  const usd = usage ? (usage.prompt_tokens * LLM.usd_per_1m_input + usage.completion_tokens * LLM.usd_per_1m_output) / 1e6 : 0;
  return {
    request: { model: LLM.model, temperature: LLM.temperature, seed: LLM.seed, response_format: LLM.response_format, prompt_sha256: createHash('sha256').update(prompt).digest('hex'), prompt_chars: prompt.length },
    response: { model: j.model ?? null, system_fingerprint: j.system_fingerprint ?? null, content: String(j.choices?.[0]?.message?.content ?? ''), usage, finish_reason: j.choices?.[0]?.finish_reason ?? null },
    ms: performance.now() - t0,
    usd,
  };
}

/** Raw-call sink set by the runner, so outputs can be committed as artifacts. */
export const RAW: { sink: ((baseline: string, caseId: string, call: RawCall & { prompt: string; extra?: unknown }) => void) | null } = { sink: null };

export const baselineA: Baseline = {
  id: 'A',
  name: `Plain LLM (${LLM.model}): all raw documents, span-labelled, in one prompt`,
  produces: { findings: true, citations: true, dependencies: true },
  availability: llmAvailability,
  async run(c) {
    const prompt = buildPrompt(c, labelledDocuments(c));
    const r = await complete(prompt);
    RAW.sink?.('A', c.id, { ...r, prompt });
    const { parse_ok, dropped, ...out } = parseAnswer(r.response.content, c);
    void parse_ok; void dropped;
    return { ...out, ms: r.ms, usd: r.usd };
  },
};

/* BM25 retrieval (deterministic, no network): the "R" of baseline B. */
const tok = (s: string) => s.toLowerCase().normalize('NFKC').match(/[a-z0-9$%.]+/g) ?? [];
export function bm25<T extends { id: string; text: string }>(chunks: T[], query: string, k = 8, k1 = 1.2, b = 0.75): T[] {
  const docs = chunks.map((s) => tok(s.text));
  const avg = docs.reduce((a, d) => a + d.length, 0) / Math.max(1, docs.length);
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);
  const q = [...new Set(tok(query))];
  const scored = docs.map((d, i) => {
    let s = 0;
    for (const t of q) {
      const f = d.filter((x) => x === t).length;
      if (!f) continue;
      const idf = Math.log(1 + (docs.length - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
      s += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.length) / avg)));
    }
    return { chunk: chunks[i], s };
  });
  return scored.filter((x) => x.s > 0).sort((x, y) => y.s - x.s || x.chunk.id.localeCompare(y.chunk.id)).slice(0, k).map((x) => x.chunk);
}

/** Sentence chunks of the raw documents: labelled statements keep their span id; other sentences get Dn#ctx-k. */
export function chunks(c: Pick<BenchCase, 'documents' | 'spans'>) {
  const out: { id: string; doc: string; text: string; citable: boolean }[] = [];
  for (const d of c.documents) {
    const spans = c.spans.filter((s) => s.doc === d.id).sort((x, y) => x.start - y.start);
    let pos = 0, k = 0;
    const gap = (from: number, to: number) => {
      for (const sent of d.text.slice(from, to).split(/(?<=\.)\s+|\n/)) if (sent.trim()) out.push({ id: `${d.id}#ctx-${++k}`, doc: d.id, text: sent.trim(), citable: false });
    };
    for (const s of spans) {
      gap(pos, s.start);
      out.push({ id: s.id, doc: d.id, text: s.text, citable: true });
      pos = s.end;
    }
    gap(pos, d.text.length);
  }
  return out;
}

export const RAG_K = 10;

export const baselineB: Baseline = {
  id: 'B',
  name: `RAG (${LLM.model}): BM25 top-${RAG_K} sentence chunks of the raw documents per conclusion, then the LLM with citations`,
  produces: { findings: true, citations: true, dependencies: true },
  availability: llmAvailability,
  async run(c) {
    const all = chunks(c);
    const keep = new Set<string>();
    for (const concl of c.conclusions) for (const s of bm25(all, concl.text, RAG_K)) keep.add(s.id);
    const retrieved = all.filter((s) => keep.has(s.id));
    const context = [...new Set(retrieved.map((r) => r.doc))].map((doc) => `## ${doc} ${c.documents.find((d) => d.id === doc)!.title} (retrieved excerpts)\n` + retrieved.filter((r) => r.doc === doc).map((r) => (r.citable ? `[${r.id}] ${r.text}` : r.text)).join('\n'));
    const prompt = buildPrompt(c, context);
    const r = await complete(prompt);
    RAW.sink?.('B', c.id, { ...r, prompt, extra: { retrieved: retrieved.map((x) => x.id) } });
    const { parse_ok, dropped, ...out } = parseAnswer(r.response.content, c);
    void parse_ok; void dropped;
    return { ...out, ms: r.ms, usd: r.usd };
  },
};

/* ------------------------------------------------------------------ D */

export const baselineD: Baseline = {
  id: 'D',
  name: 'Manual review by qualified human reviewers',
  produces: { findings: true, citations: true, dependencies: true },
  availability: () => ({ status: 'BLOCKED', reason: 'no reviewers have been recruited; review time and results are not estimated' }),
  run: async () => {
    throw new Error('baseline D is BLOCKED');
  },
};

export const BASELINES = [baselineA, baselineB, baselineC, baselineD];

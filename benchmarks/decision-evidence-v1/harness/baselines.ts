/**
 * Baselines A–D. Only C runs today. A and B are complete adapters that need an OpenAI-compatible endpoint
 * (BENCH_LLM_API_KEY, BENCH_LLM_MODEL, optional BENCH_LLM_BASE_URL); without a key they report BLOCKED and make no
 * network call. D needs human reviewers; none have been recruited, so it is BLOCKED. Nothing is ever estimated.
 */
import { performance } from 'node:perf_hooks';
import { detectDeterministic } from '@/lib/contradiction/detect';
import type { Fact } from '@/lib/contradiction/normalize';
import type { Baseline, BenchCase, SystemOutput } from './types';

/* ------------------------------------------------------------------ C */

/** C: the previous Decision Twin's deterministic contradiction layer (src/lib/contradiction, unchanged since cad6e95). */
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

export const PROMPT_VERSION = 'dev1-v1';
const CLASSES = ['CONFIRMED_CONFLICT', 'POTENTIAL_CONFLICT', 'DIFFERENT_REPORTING_BASIS', 'MISSING_EVIDENCE', 'UNRESOLVED_INTERPRETATION'];

export function buildPrompt(c: Pick<BenchCase, 'documents' | 'spans' | 'conclusions'>, spans = c.spans) {
  const passages = spans.map((s) => `[${s.id}] ${s.text}`).join('\n');
  const context = c.documents.map((d) => `## ${d.id} ${d.title}\n${d.text}`).join('\n\n');
  return [
    'You review documents for a decision. Passages are labelled [Dn#sm].',
    `Task 1: list every pair of passages that conflict, with one class from: ${CLASSES.join(', ')}. Do not list pairs that are consistent (different periods, different entities, superseded versions, the same amount in other units, rounding).`,
    'Task 2: for each conclusion, cite the passages that are evidence for it, and list every passage it depends on.',
    'Answer with JSON only: {"findings":[{"facts":["D1#s1","D2#s3"],"class":"…"}],"citations":{"C1":["…"]},"dependencies":{"C1":["…"]}}',
    '',
    '# Documents',
    context,
    '',
    '# Passages',
    passages,
    '',
    '# Conclusions',
    ...c.conclusions.map((x) => `${x.id}: ${x.text}`),
  ].join('\n');
}

export function parseAnswer(text: string, c: BenchCase): Omit<SystemOutput, 'ms' | 'usd'> {
  const ids = new Set(c.spans.map((s) => s.id));
  const m = text.match(/\{[\s\S]*\}/);
  let j: any = {};
  try {
    j = m ? JSON.parse(m[0]) : {};
  } catch {
    j = {};
  }
  const findings = (Array.isArray(j.findings) ? j.findings : [])
    .filter((f: any) => Array.isArray(f?.facts) && f.facts.length === 2 && f.facts.every((x: string) => ids.has(x)) && CLASSES.includes(f.class))
    .map((f: any) => ({ facts: [f.facts[0], f.facts[1]] as [string, string], class: f.class }));
  const clean = (o: any) => Object.fromEntries(c.conclusions.map((x) => [x.id, (Array.isArray(o?.[x.id]) ? o[x.id] : []).filter((s: string) => ids.has(s))]));
  return { findings, citations: clean(j.citations), dependencies: clean(j.dependencies) };
}

function llmConfig(env = process.env) {
  return { key: env.BENCH_LLM_API_KEY, model: env.BENCH_LLM_MODEL, base: env.BENCH_LLM_BASE_URL ?? 'https://api.openai.com/v1' };
}
const llmAvailability = () => {
  const c = llmConfig();
  if (!c.key) return { status: 'BLOCKED' as const, reason: 'no API key configured (BENCH_LLM_API_KEY unset); no call was made' };
  if (!c.model) return { status: 'BLOCKED' as const, reason: 'BENCH_LLM_MODEL unset' };
  return { status: 'READY' as const };
};

async function complete(prompt: string) {
  const c = llmConfig();
  const res = await fetch(`${c.base}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${c.key}` },
    body: JSON.stringify({ model: c.model, temperature: 0, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`LLM endpoint returned ${res.status}`);
  const j: any = await res.json();
  // Spend is recorded from token usage only when prices are supplied; otherwise left null in the report.
  const inP = Number(process.env.BENCH_LLM_USD_PER_1K_IN ?? NaN), outP = Number(process.env.BENCH_LLM_USD_PER_1K_OUT ?? NaN);
  const usd = j.usage && Number.isFinite(inP) && Number.isFinite(outP) ? (j.usage.prompt_tokens * inP + j.usage.completion_tokens * outP) / 1000 : NaN;
  return { text: String(j.choices?.[0]?.message?.content ?? ''), usd };
}

export const baselineA: Baseline = {
  id: 'A',
  name: 'Plain LLM: all documents in one prompt',
  produces: { findings: true, citations: true, dependencies: true },
  availability: llmAvailability,
  async run(c) {
    const t0 = performance.now();
    const r = await complete(buildPrompt(c));
    return { ...parseAnswer(r.text, c), ms: performance.now() - t0, usd: r.usd };
  },
};

/* BM25 retrieval over passages (deterministic, no network): the "R" of baseline B. */
const tok = (s: string) => s.toLowerCase().normalize('NFKC').match(/[a-z0-9$%.]+/g) ?? [];
export function bm25(spans: BenchCase['spans'], query: string, k = 8, k1 = 1.2, b = 0.75) {
  const docs = spans.map((s) => tok(s.text));
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
    return { span: spans[i], s };
  });
  return scored.filter((x) => x.s > 0).sort((x, y) => y.s - x.s || x.span.id.localeCompare(y.span.id)).slice(0, k).map((x) => x.span);
}

export const baselineB: Baseline = {
  id: 'B',
  name: 'RAG: BM25 top-8 passages per conclusion, then the LLM',
  produces: { findings: true, citations: true, dependencies: true },
  availability: llmAvailability,
  async run(c) {
    const t0 = performance.now();
    const ids = new Set<string>();
    for (const concl of c.conclusions) for (const s of bm25(c.spans, concl.text)) ids.add(s.id);
    const retrieved = c.spans.filter((s) => ids.has(s.id));
    const r = await complete(buildPrompt({ ...c, documents: [] }, retrieved));
    return { ...parseAnswer(r.text, c), ms: performance.now() - t0, usd: r.usd };
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

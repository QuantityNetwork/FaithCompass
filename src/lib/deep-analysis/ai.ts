/**
 * AI layer for Deep Analysis, behind a provider interface. The provider returns text; this module builds the
 * prompt, parses the JSON answer and hands it back for verification (analyze.ts): every quotation must occur in the
 * document verbatim or the finding citing it is dropped. Nothing here holds a key: the OpenAI provider reads
 * OPENAI_API_KEY from the server environment at call time and never returns or logs it.
 *
 * Spend guard: input is capped at AI_MAX_INPUT_CHARS (the rest is analysed by the deterministic layer only and the
 * report says so), output at AI_MAX_OUTPUT_TOKENS (which also stops runaway generations), one call per analysis,
 * a 120-second timeout and no retries beyond one for a 429/5xx.
 */
import { SECTIONS, SEVERITIES } from './schema';

export const AI_PROMPT_VERSION = 'deep-analysis-prompt/2';
export const AI_MAX_INPUT_CHARS = 60_000;
export const AI_MAX_OUTPUT_TOKENS = 8_000;

export interface AiUsage { inputTokens: number; outputTokens: number; usd: number }
export interface AiCompletion { text: string; usage: AiUsage | null; finishReason: string | null; model: string }

export interface DeepAiProvider {
  id: string;
  model: string;
  configured: boolean;
  complete(prompt: string): Promise<AiCompletion>;
}

export const NO_AI: DeepAiProvider = {
  id: 'none',
  model: 'none',
  configured: false,
  complete: async () => {
    throw new Error('AI layer not configured');
  },
};

/** USD per 1M tokens (input, output), list prices; used only to report the cost of a run. */
const PRICES: Record<string, [number, number]> = {
  'gpt-4.1': [2, 8],
  'gpt-4.1-mini': [0.4, 1.6],
  'gpt-4o-mini': [0.15, 0.6],
  'gpt-4o': [2.5, 10],
};
const priceOf = (model: string) => PRICES[Object.keys(PRICES).sort((a, b) => b.length - a.length).find((k) => model.startsWith(k)) ?? ''] ?? [2, 8];

export function openAiProvider(env: Record<string, string | undefined> = process.env, fetchImpl: typeof fetch = fetch): DeepAiProvider {
  const model = env.DEEP_ANALYSIS_MODEL || 'gpt-4.1';
  const configured = (env.AI_PROVIDER ?? 'openai').toLowerCase() === 'openai' && Boolean(env.OPENAI_API_KEY) && env.DEEP_ANALYSIS_AI !== 'off';
  return {
    id: 'openai',
    model,
    configured,
    async complete(prompt) {
      const key = env.OPENAI_API_KEY;
      if (!key) throw new Error('AI layer not configured');
      let res: Response | null = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 120_000);
        try {
          res = await fetchImpl('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
            body: JSON.stringify({ model, temperature: 0, seed: 20261021, max_completion_tokens: AI_MAX_OUTPUT_TOKENS, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: AI_INSTRUCTIONS }, { role: 'user', content: prompt }] }),
            signal: ctrl.signal,
          });
        } finally {
          clearTimeout(timer);
        }
        if (res.status !== 429 && res.status < 500) break;
        await new Promise((r) => setTimeout(r, 2500));
      }
      if (!res || !res.ok) throw new Error(`AI provider returned ${res?.status ?? 'no response'}`);
      const j = (await res.json()) as { model?: string; usage?: { prompt_tokens: number; completion_tokens: number }; choices?: { message?: { content?: string }; finish_reason?: string }[] };
      const [pin, pout] = priceOf(model);
      const usage = j.usage ? { inputTokens: j.usage.prompt_tokens, outputTokens: j.usage.completion_tokens, usd: (j.usage.prompt_tokens * pin + j.usage.completion_tokens * pout) / 1e6 } : null;
      return { text: String(j.choices?.[0]?.message?.content ?? ''), usage, finishReason: j.choices?.[0]?.finish_reason ?? null, model: j.model ?? model };
    },
  };
}

const AI_SECTIONS = SECTIONS.filter((s) => s !== 'contradiction' && s !== 'concern');

export const AI_INSTRUCTIONS = [
  'You are a meticulous contracts and business-document analyst. You analyse one document for a reader who must decide whether to sign, negotiate or act on it.',
  'Rules:',
  '- Work only from the document. Do not invent facts, parties, figures or clauses.',
  '- Every finding must quote the exact passage it rests on: copy 12 to 300 characters from the document character for character (same words, spelling, punctuation and numbers). Never paraphrase inside "quotes", never shorten a quote with "..." and never join two passages in one quote; cite them as separate quotes. A finding whose quote is not found verbatim in the document is discarded automatically.',
  '- Be specific and deep: name the party, the amount, the period, the condition and the consequence. Explain why something matters for each party.',
  '- Rate risks high / medium / low from the perspective of the party receiving the document, and say why in "reasoning".',
  '- "missing" findings describe a term a document of this type normally has but this one lacks; they may have an empty quotes list.',
  '- Do not give legal advice and do not claim certainty you do not have; point to what a lawyer should check.',
  'Answer with one JSON object only, with these keys:',
  '{"document_type":{"value":"...","quote":"..."},',
  ' "parties":[{"name":"...","role":"...","quote":"..."}],',
  ' "clauses":[{"clause":"C1","summary":"one or two sentences in plain language","quote":"..."}],',
  ` "findings":[{"section":"one of ${AI_SECTIONS.join('|')}","title":"short title","detail":"what it says and what it means","severity":"one of ${SEVERITIES.join('|')}","reasoning":"why this rating","party":"the party bound, for obligations","quotes":["..."]}],`,
  ' "contradictions":[{"quote_a":"...","quote_b":"...","explanation":"..."}],',
  ' "final_statement":{"overall":"a reasoned assessment in 4 to 8 sentences","overall_quotes":["..."],"rating":"one of acceptable|acceptable_with_changes|significant_concerns|insufficient_information","key_concerns":[{"title":"...","detail":"...","severity":"high|medium|low","quotes":["..."]}],"recommended_actions":[{"text":"...","quotes":["..."]}],"confidence":"high|moderate|low","confidence_reason":"..."}}',
  'Be exhaustive and deep: cover every clause in "clauses" (use the clause ids given) and give typically 25 to 45 findings. In "findings" cover: each party\'s obligations; deadlines; renewal and termination; payment terms; liability, indemnity, intellectual property, confidentiality, governing law and dispute resolution; risks; unusual terms; missing terms; and open questions the reader should ask the other party. Put passages that contradict each other in "contradictions", not in "findings".',
].join('\n');

export function aiPrompt(text: string, clauses: { id: string; heading: string; start: number; end: number }[]): { prompt: string; truncated: boolean } {
  const truncated = text.length > AI_MAX_INPUT_CHARS;
  const body = truncated ? text.slice(0, AI_MAX_INPUT_CHARS) : text;
  const list = clauses.filter((c) => c.start < body.length).map((c) => `${c.id}: ${c.heading}`).join('\n');
  return { prompt: `# Clause ids\n${list}\n\n# Document\n${body}${truncated ? '\n\n[The document continues; only the part above is given.]' : ''}`, truncated };
}

/* ------------------------------------------------------------- parsing */

export interface AiQuoted { quotes: string[] }
export interface AiAnswer {
  documentType: { value: string; quote: string } | null;
  parties: { name: string; role: string | null; quote: string }[];
  clauses: { clause: string; summary: string; quote: string }[];
  findings: { section: string; title: string; detail: string; severity: string | null; reasoning: string | null; party: string | null; quotes: string[] }[];
  contradictions: { quoteA: string; quoteB: string; explanation: string }[];
  finalStatement: {
    overall: string; overallQuotes: string[]; rating: string;
    keyConcerns: { title: string; detail: string; severity: string | null; quotes: string[] }[];
    recommendedActions: { text: string; quotes: string[] }[];
    confidence: string; confidenceReason: string;
  } | null;
}

const str = (v: unknown, max = 4000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const strs = (v: unknown) => (Array.isArray(v) ? v.map((x) => str(x, 600)).filter(Boolean).slice(0, 6) : []);
const arr = (v: unknown, max: number): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object').slice(0, max) : []);

/** Parse the model's JSON. Returns null when it is not JSON; malformed entries are skipped, not repaired. */
export function parseAiAnswer(raw: string): AiAnswer | null {
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    return null;
  }
  if (!j || typeof j !== 'object') return null;
  const dt = j.document_type as Record<string, unknown> | undefined;
  const fs = j.final_statement as Record<string, unknown> | undefined;
  return {
    documentType: dt && str(dt.value) ? { value: str(dt.value, 120), quote: str(dt.quote, 600) } : null,
    parties: arr(j.parties, 12).map((p) => ({ name: str(p.name, 200), role: str(p.role, 80) || null, quote: str(p.quote, 600) })).filter((p) => p.name),
    clauses: arr(j.clauses, 200).map((c) => ({ clause: str(c.clause, 20), summary: str(c.summary, 800), quote: str(c.quote, 600) })).filter((c) => c.clause && c.summary),
    findings: arr(j.findings, 150).map((f) => ({ section: str(f.section, 40), title: str(f.title, 200), detail: str(f.detail, 1500), severity: str(f.severity, 10) || null, reasoning: str(f.reasoning, 1000) || null, party: str(f.party, 80) || null, quotes: strs(f.quotes) })).filter((f) => f.title),
    contradictions: arr(j.contradictions, 30).map((c) => ({ quoteA: str(c.quote_a, 600), quoteB: str(c.quote_b, 600), explanation: str(c.explanation, 1000) })),
    finalStatement: fs
      ? {
          overall: str(fs.overall, 3000),
          overallQuotes: strs(fs.overall_quotes),
          rating: str(fs.rating, 40),
          keyConcerns: arr(fs.key_concerns, 10).map((k) => ({ title: str(k.title, 200), detail: str(k.detail, 1200), severity: str(k.severity, 10) || null, quotes: strs(k.quotes) })).filter((k) => k.title),
          recommendedActions: arr(fs.recommended_actions, 12).map((a) => ({ text: str(a.text, 600), quotes: strs(a.quotes) })).filter((a) => a.text),
          confidence: str(fs.confidence, 20),
          confidenceReason: str(fs.confidence_reason, 1000),
        }
      : null,
  };
}

/**
 * AI layer for Deep Analysis, behind a provider interface. The provider returns text; this module builds the
 * prompt, parses the JSON answer and hands it back for verification (analyze.ts): every quotation must occur in the
 * document verbatim or the finding citing it is dropped. Nothing here holds a key: the OpenAI provider reads
 * OPENAI_API_KEY from the server environment at call time and never returns or logs it.
 *
 * Model: DEEP_ANALYSIS_MODEL, default gpt-5.6-terra (mid-tier GPT-5.6 reasoning model, chosen for quality per
 * dollar; 1.05M-token context). gpt-5.6-luna is the budget option, gpt-5.6-sol the costly flagship.
 * Reasoning models (gpt-5*, o*) are called through the Responses API with reasoning effort
 * DEEP_ANALYSIS_REASONING_EFFORT (default medium); older chat models (gpt-4.1 etc.) through Chat Completions.
 *
 * Spend guard: input is capped at AI_MAX_INPUT_CHARS (the rest is analysed by the deterministic layer only and the
 * report says so), output (reasoning included) at AI_MAX_OUTPUT_TOKENS, one call per analysis, a timeout that fits
 * the route's maxDuration, and one retry for a 429/5xx only when there is time for it.
 */
import { SECTIONS, SEVERITIES } from './schema';

export const AI_PROMPT_VERSION = 'deep-analysis-prompt/3';
export const DEFAULT_MODEL = 'gpt-5.6-terra';
export const AI_MAX_INPUT_CHARS = 300_000;
export const AI_MAX_OUTPUT_TOKENS = 32_000;
/** One AI call may take this long; the route's maxDuration is 800 s (Vercel Pro with Fluid compute). */
export const AI_TIMEOUT_MS = 690_000;
const EFFORTS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;

export interface AiUsage { inputTokens: number; outputTokens: number; usd: number; reasoningTokens?: number }
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

/** USD per 1M tokens (input, output), standard list prices for prompts up to 272k tokens; used only to report cost. */
const PRICES: Record<string, [number, number]> = {
  'gpt-5.6-sol': [4, 20],
  'gpt-5.6-terra': [2, 12],
  'gpt-5.6-luna': [0.2, 1.2],
  'gpt-5.5': [5, 30],
  'gpt-5.4': [2.5, 15],
  'gpt-4.1': [2, 8],
  'gpt-4.1-mini': [0.4, 1.6],
  'gpt-4o-mini': [0.15, 0.6],
  'gpt-4o': [2.5, 10],
};
const priceOf = (model: string) => PRICES[Object.keys(PRICES).sort((a, b) => b.length - a.length).find((k) => model.startsWith(k)) ?? ''] ?? [4, 20];
export const isReasoningModel = (model: string) => /^(gpt-5|o\d)/.test(model);
export const reasoningEffort = (env: Record<string, string | undefined> = process.env) => {
  const e = (env.DEEP_ANALYSIS_REASONING_EFFORT ?? '').toLowerCase();
  return (EFFORTS as readonly string[]).includes(e) ? e : 'medium';
};

type ResponsesAnswer = {
  model?: string;
  status?: string;
  incomplete_details?: { reason?: string } | null;
  output?: { type?: string; content?: { type?: string; text?: string }[] }[];
  output_text?: string;
  usage?: { input_tokens: number; output_tokens: number; output_tokens_details?: { reasoning_tokens?: number } };
};
type ChatAnswer = { model?: string; usage?: { prompt_tokens: number; completion_tokens: number }; choices?: { message?: { content?: string }; finish_reason?: string }[] };

/** Request body and answer parser for the model's API. Exported for tests. */
export function openAiRequest(model: string, prompt: string, effort: string) {
  if (isReasoningModel(model))
    return {
      url: 'https://api.openai.com/v1/responses',
      body: { model, store: false, instructions: AI_INSTRUCTIONS, input: prompt, reasoning: { effort }, max_output_tokens: AI_MAX_OUTPUT_TOKENS, text: { format: { type: 'json_object' } } },
    };
  return {
    url: 'https://api.openai.com/v1/chat/completions',
    body: { model, store: false, temperature: 0, seed: 20261021, max_completion_tokens: Math.min(AI_MAX_OUTPUT_TOKENS, 32_000), response_format: { type: 'json_object' }, messages: [{ role: 'system', content: AI_INSTRUCTIONS }, { role: 'user', content: prompt }] },
  };
}

export function readOpenAiAnswer(model: string, j: unknown): AiCompletion {
  const [pin, pout] = priceOf(model);
  if (isReasoningModel(model)) {
    const r = j as ResponsesAnswer;
    const text = r.output_text ?? (r.output ?? []).filter((o) => o.type === 'message').flatMap((o) => o.content ?? []).filter((c) => c.type === 'output_text').map((c) => c.text ?? '').join('');
    const u = r.usage;
    const usage = u ? { inputTokens: u.input_tokens, outputTokens: u.output_tokens, reasoningTokens: u.output_tokens_details?.reasoning_tokens ?? 0, usd: (u.input_tokens * pin + u.output_tokens * pout) / 1e6 } : null;
    const finishReason = r.status === 'incomplete' ? (r.incomplete_details?.reason === 'max_output_tokens' ? 'length' : r.incomplete_details?.reason ?? 'incomplete') : r.status === 'completed' ? 'stop' : r.status ?? null;
    return { text, usage, finishReason, model: r.model ?? model };
  }
  const c = j as ChatAnswer;
  const usage = c.usage ? { inputTokens: c.usage.prompt_tokens, outputTokens: c.usage.completion_tokens, usd: (c.usage.prompt_tokens * pin + c.usage.completion_tokens * pout) / 1e6 } : null;
  return { text: String(c.choices?.[0]?.message?.content ?? ''), usage, finishReason: c.choices?.[0]?.finish_reason ?? null, model: c.model ?? model };
}

export function openAiProvider(env: Record<string, string | undefined> = process.env, fetchImpl: typeof fetch = fetch): DeepAiProvider {
  const model = env.DEEP_ANALYSIS_MODEL || DEFAULT_MODEL;
  const configured = (env.AI_PROVIDER ?? 'openai').toLowerCase() === 'openai' && Boolean(env.OPENAI_API_KEY) && env.DEEP_ANALYSIS_AI !== 'off';
  return {
    id: 'openai',
    model,
    configured,
    async complete(prompt) {
      const key = env.OPENAI_API_KEY;
      if (!key) throw new Error('AI layer not configured');
      const req = openAiRequest(model, prompt, reasoningEffort(env));
      const started = Date.now();
      let res: Response | null = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), Math.max(10_000, AI_TIMEOUT_MS - (Date.now() - started)));
        try {
          res = await fetchImpl(req.url, {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
            body: JSON.stringify(req.body),
            signal: ctrl.signal,
          });
        } finally {
          clearTimeout(timer);
        }
        // Retry once on 429/5xx, and only while most of the time budget is left.
        if (res.status !== 429 && res.status < 500) break;
        if (Date.now() - started > AI_TIMEOUT_MS / 3) break;
        await new Promise((r) => setTimeout(r, 2500));
      }
      if (!res || !res.ok) throw new Error(`AI provider returned ${res?.status ?? 'no response'}`);
      return readOpenAiAnswer(model, await res.json());
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
  'Be exhaustive and deep: cover every clause in "clauses" (use the clause ids given) and give typically 30 to 60 findings; reason carefully about how clauses interact (definitions, cross-references, exceptions, survival, order of precedence) before you answer. In "findings" cover: each party\'s obligations; deadlines; renewal and termination; payment terms; liability, indemnity, intellectual property, confidentiality, governing law and dispute resolution; risks; unusual terms; missing terms; and open questions the reader should ask the other party. Put passages that contradict each other in "contradictions", not in "findings".',
].join('\n');

export function aiPrompt(text: string, clauses: { id: string; heading: string; start: number; end: number }[]): { prompt: string; truncated: boolean } {
  const truncated = text.length > AI_MAX_INPUT_CHARS;
  const body = truncated ? text.slice(0, AI_MAX_INPUT_CHARS) : text;
  const list = clauses.filter((c) => c.start < body.length).map((c) => `${c.id}: ${c.heading}`).join('\n');
  return { prompt: `Analyse the document below and answer with the single JSON object described in your instructions.\n\n# Clause ids\n${list}\n\n# Document\n${body}${truncated ? '\n\n[The document continues; only the part above is given.]' : ''}`, truncated };
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

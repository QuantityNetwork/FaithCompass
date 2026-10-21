/**
 * AI-candidate layer: a language model reads the span-labelled documents and proposes (1) pairs of statements in
 * tension and (2) the statements each conclusion rests on. Everything it returns is a proposal: `combineLayers`
 * caps its classes at POTENTIAL_CONFLICT, marks them for human review and lets the deterministic layer veto pairs it
 * can show to be consistent; the case pipeline records its evidence links as unreviewed.
 *
 * The model call is injected (`complete`), so this module holds no key and makes no call by itself. The production
 * deployment configures no provider (no model key is stored in Vercel). The instructions are the prompt frozen as
 * `dev-validated-2` for baseline A of decision-evidence-v1, unchanged, so the layer's behaviour is the measured one.
 */
import type { Candidate, CandidateContext, CandidateSource, ContradictionClass } from './detect';
import { CLASSES } from './detect';
import type { Fact } from './normalize';

export const AI_LAYER_PROMPT_VERSION = 'dev-validated-2';

export const AI_LAYER_INSTRUCTIONS = [
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

/** Documents with each span label inserted immediately before the span. */
export function labelDocuments(ctx: Pick<CandidateContext, 'documents' | 'spans'>): string[] {
  return (ctx.documents ?? []).map((d) => {
    let text = d.text;
    for (const s of [...(ctx.spans ?? [])].filter((x) => x.doc === d.id).sort((a, b) => b.start - a.start)) text = `${text.slice(0, s.start)}[${s.id}] ${text.slice(s.start)}`;
    return `## ${d.id} ${d.title}\n${text}`;
  });
}

export function aiLayerPrompt(ctx: CandidateContext): string {
  return [AI_LAYER_INSTRUCTIONS, '', '# Documents', labelDocuments(ctx).join('\n\n'), '', '# Conclusions', ...(ctx.conclusions ?? []).map((x) => `${x.id}: ${x.text}`)].join('\n');
}

export interface AiReading {
  candidates: Candidate[];
  citations: Record<string, string[]>;
  dependencies: Record<string, string[]>;
  parseOk: boolean;
  /** Proposals dropped because they named unknown statements, a self-pair or an unknown class. */
  dropped: number;
}

/** Parse a model answer; anything that does not name known statements is dropped, never repaired. */
export function parseAiReading(text: string, spanIds: ReadonlySet<string>, conclusionIds: readonly string[]): AiReading {
  const m = text.match(/\{[\s\S]*\}/);
  let j: any = null;
  try {
    j = m ? JSON.parse(m[0]) : null;
  } catch {
    j = null;
  }
  const raw: any[] = Array.isArray(j?.findings) ? j.findings : [];
  const ok = (f: any) => Array.isArray(f?.facts) && f.facts.length === 2 && f.facts[0] !== f.facts[1] && f.facts.every((x: unknown) => typeof x === 'string' && spanIds.has(x)) && (CLASSES as readonly string[]).includes(f.class);
  const candidates = raw.filter(ok).map((f) => ({ facts: [f.facts[0], f.facts[1]], class: f.class as ContradictionClass, rationale: 'proposed by the AI-candidate layer' }));
  const clean = (o: any) => Object.fromEntries(conclusionIds.map((id) => [id, [...new Set<string>((Array.isArray(o?.[id]) ? o[id] : []).filter((s: unknown) => typeof s === 'string' && spanIds.has(s)))]]));
  return { candidates, citations: clean(j?.citations), dependencies: clean(j?.dependencies), parseOk: j !== null, dropped: raw.length - candidates.length };
}

/**
 * A model reader: one call per context, shared by the candidate source and the evidence links. `complete` takes
 * the prompt and returns the model's text.
 */
export function createAiReader(id: string, complete: (prompt: string) => Promise<string>) {
  const memo = new Map<string, Promise<AiReading>>();
  const read = (ctx: CandidateContext): Promise<AiReading> => {
    const prompt = aiLayerPrompt(ctx);
    if (!memo.has(prompt)) memo.set(prompt, complete(prompt).then((t) => parseAiReading(t, new Set((ctx.spans ?? []).map((s) => s.id)), (ctx.conclusions ?? []).map((c) => c.id))));
    return memo.get(prompt)!;
  };
  const source: CandidateSource = {
    id,
    configured: true,
    async propose(_facts: readonly Fact[], ctx?: CandidateContext) {
      return ctx?.documents?.length ? (await read(ctx)).candidates : [];
    },
  };
  return { source, read };
}

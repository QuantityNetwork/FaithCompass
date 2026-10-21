/**
 * Deep Analysis report (schema abrahammoses-deep-analysis/1.0.0). Every finding cites hash-anchored spans of the
 * analysed text, as SDEP EvidenceSpans do: character offsets into the normalised text, the verbatim quote and the
 * SHA-256 of the quote. A finding states which layer produced it: the deterministic rules or the AI layer. AI
 * findings survive only when every span they cite exists verbatim in the text (see spans.ts).
 */
import { z } from 'zod';

export const REPORT_SCHEMA = 'abrahammoses-deep-analysis/1.0.0';
export const ENGINE_VERSION = 'deep-analysis/1.0.0';
export const DISCLAIMER = 'Not legal advice; not reviewed by a lawyer.';

const Sha256 = z.string().regex(/^[0-9a-f]{64}$/);

export const SpanSchema = z
  .object({
    id: z.string().regex(/^S\d+$/),
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
    quote: z.string().min(1),
    sha256: Sha256,
    /** Clause the span sits in (id), or null for text outside any clause. */
    clause: z.string().nullable(),
  })
  .strict()
  .refine((s) => s.end > s.start, 'end must be after start');
export type Span = z.infer<typeof SpanSchema>;

export const LAYERS = ['deterministic', 'ai'] as const;
export type Layer = (typeof LAYERS)[number];

export const SECTIONS = [
  'obligation',
  'deadline',
  'renewal_termination',
  'payment',
  'liability',
  'indemnity',
  'ip',
  'confidentiality',
  'governing_law',
  'dispute_resolution',
  'data_protection',
  'risk',
  'contradiction',
  'missing',
  'unusual',
  'open_question',
  'concern',
] as const;
export type Section = (typeof SECTIONS)[number];

export const SEVERITIES = ['high', 'medium', 'low', 'info'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const FindingSchema = z
  .object({
    id: z.string().min(1),
    section: z.enum(SECTIONS),
    layer: z.enum(LAYERS),
    title: z.string().min(1),
    detail: z.string(),
    /** For risks and concerns: the rating and the reasoning behind it. */
    severity: z.enum(SEVERITIES).optional(),
    reasoning: z.string().optional(),
    /** For obligations: the party bound (a defined role such as "Supplier") or "Both parties". */
    party: z.string().optional(),
    /** For contradictions: the engine's class and rule. */
    contradictionClass: z.string().optional(),
    rule: z.string().optional(),
    /** Span ids. Empty only for an absence finding, which reports that no passage matched (see `absence`). */
    spans: z.array(z.string()),
    /** An absence finding: what was searched for across the whole text, anchored to the text's hash. */
    absence: z.object({ searched: z.string(), textSha256: Sha256 }).optional(),
    requiresHumanReview: z.boolean(),
  })
  .strict()
  .refine((f) => f.spans.length > 0 || f.absence !== undefined, 'a finding cites at least one span unless it is an absence finding');
export type Finding = z.infer<typeof FindingSchema>;

export const ClauseSchema = z
  .object({
    id: z.string(),
    number: z.string().nullable(),
    heading: z.string(),
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
    sha256: Sha256,
    topics: z.array(z.string()),
    /** Deterministic key terms found in the clause (amounts, durations, dates, percentages). */
    keyTerms: z.array(z.string()),
    /** Plain-language summary from the AI layer, with the span it rests on; null without AI. */
    summary: z.object({ text: z.string(), spans: z.array(z.string()) }).nullable(),
  })
  .strict();
export type Clause = z.infer<typeof ClauseSchema>;

const Fact = z.object({ value: z.string(), spans: z.array(z.string()).min(1), layer: z.enum(LAYERS) }).strict();

export const ReportSchema = z
  .object({
    schema: z.literal(REPORT_SCHEMA),
    disclaimer: z.literal(DISCLAIMER),
    generatedAt: z.string(),
    document: z
      .object({
        filename: z.string(),
        format: z.enum(['pdf', 'docx', 'txt', 'md']),
        bytes: z.number().int().nonnegative(),
        bytesSha256: Sha256,
        textSha256: Sha256,
        chars: z.number().int().nonnegative(),
        pages: z.number().int().positive().nullable(),
        sample: z.boolean(),
        /** 'browser': a large file read in the user's browser; only its text reached the server. */
        extraction: z.enum(['server', 'browser']).optional(),
      })
      .strict(),
    /** The normalised text all spans point into. */
    text: z.string(),
    engine: z
      .object({
        version: z.literal(ENGINE_VERSION),
        ai: z
          .object({
            status: z.enum(['used', 'not_configured', 'not_permitted', 'failed']),
            note: z.string(),
            provider: z.string().nullable(),
            model: z.string().nullable(),
            promptVersion: z.string().nullable(),
            proposed: z.number().int().nonnegative(),
            dropped: z.number().int().nonnegative(),
            vetoed: z.number().int().nonnegative(),
            droppedExamples: z.array(z.string()),
            usage: z.object({ inputTokens: z.number(), outputTokens: z.number(), usd: z.number(), reasoningTokens: z.number().optional() }).nullable(),
            truncated: z.boolean(),
          })
          .strict(),
      })
      .strict(),
    overview: z
      .object({
        title: z.string(),
        type: Fact.nullable(),
        parties: z.array(z.object({ name: z.string(), role: z.string().nullable(), spans: z.array(z.string()).min(1), layer: z.enum(LAYERS) }).strict()),
        dates: z.array(Fact),
        amounts: z.array(Fact),
        durations: z.array(Fact),
        governingLaw: Fact.nullable(),
      })
      .strict(),
    clauses: z.array(ClauseSchema),
    spans: z.array(SpanSchema),
    findings: z.array(FindingSchema),
    finalStatement: z
      .object({
        overall: z.string(),
        overallSpans: z.array(z.string()),
        rating: z.enum(['acceptable', 'acceptable_with_changes', 'significant_concerns', 'insufficient_information']),
        keyConcerns: z.array(z.string()),
        recommendedActions: z.array(z.object({ text: z.string(), spans: z.array(z.string()) }).strict()),
        confidence: z.enum(['high', 'moderate', 'low']),
        confidenceReason: z.string(),
        limitations: z.array(z.string()),
        layer: z.enum(LAYERS),
      })
      .strict(),
    seal: z
      .object({
        algorithm: z.literal('SHA-256'),
        canonicalization: z.string(),
        reportSha256: Sha256,
      })
      .strict(),
  })
  .strict();
export type Report = z.infer<typeof ReportSchema>;
export type UnsealedReport = Omit<Report, 'seal'>;

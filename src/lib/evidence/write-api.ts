/**
 * Request contracts for the Evidence Intelligence write endpoints.
 *
 * Shared by the route handlers and the OpenAPI document, so the published
 * contract and the enforced one cannot drift. All bodies are strict: unknown
 * fields (a `role`, an `approved` flag) are rejected, never ignored.
 */
import { z } from 'zod';
import { PassageReferenceSchema } from './schema';

export const AnalyzeBodySchema = z.strictObject({
  query: z.string().min(1).max(2000),
  reference: PassageReferenceSchema.nullable().optional(),
  passageText: z.string().max(20000).nullable().optional(),
  lens: z
    .object({
      primarySourcesOnly: z.boolean().optional(),
      beforeYear: z.number().int().optional(),
      historicalOnly: z.boolean().optional(),
      scriptureOnly: z.boolean().optional(),
      note: z.string().max(300).optional(),
    })
    .strict()
    .optional(),
});

export const ChallengeBodySchema = z.object({ note: z.string().max(2000).optional() }).strict();

export const DecisionBodySchema = z
  .object({
    decision: z.enum(['approve', 'reject']),
    reason: z.string().trim().min(10).max(2000),
  })
  .strict();

export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
export const CLAIM_ID_PATTERN = /^[A-Za-z0-9._:-]{1,200}$/;

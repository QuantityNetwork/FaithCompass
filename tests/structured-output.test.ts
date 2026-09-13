import { describe, expect, it } from 'vitest';
import {
  ChallengeResultSchema,
  ClaimAssessmentResultSchema,
  ClaimExtractionResultSchema,
  StructuredOutputError,
  parseStructured,
} from '@/lib/evidence/schema';
import { extractJson } from '@/lib/evidence/providers/anthropic';
import { DANIEL_12_1 } from '@/lib/evidence/seed/daniel-12-1';

/**
 * The boundary between a reasoning model and the database. Nothing that fails
 * these schemas may be persisted, rendered, or partially salvaged.
 */
describe('structured output validation', () => {
  it('accepts a well-formed extraction', () => {
    const value = {
      claims: [
        { statement: 'x', claimType: 'TEXTUAL', scope: 'y', rationale: 'z' },
      ],
    };
    expect(parseStructured('t', ClaimExtractionResultSchema, value).claims).toHaveLength(1);
  });

  it('rejects an unknown claim type rather than coercing it', () => {
    expect(() =>
      parseStructured('t', ClaimExtractionResultSchema, {
        claims: [{ statement: 'x', claimType: 'VIBES', scope: 'y', rationale: 'z' }],
      }),
    ).toThrow(StructuredOutputError);
  });

  it('rejects an extraction with no claims', () => {
    expect(() => parseStructured('t', ClaimExtractionResultSchema, { claims: [] })).toThrow(
      StructuredOutputError,
    );
  });

  it('reports the stage and the offending path so a failure is diagnosable', () => {
    try {
      parseStructured('extractClaims', ClaimExtractionResultSchema, { claims: [{}] });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(StructuredOutputError);
      const e = err as StructuredOutputError;
      expect(e.stage).toBe('extractClaims');
      expect(e.message).toContain('claims.0.statement');
    }
  });

  it('has no place for a model to return a score', () => {
    const shape = ClaimAssessmentResultSchema.shape;
    for (const forbidden of ['score', 'confidence', 'overallConfidence', 'probability']) {
      expect(Object.keys(shape)).not.toContain(forbidden);
    }
  });

  it('bounds a challenge so one pass cannot swing an assessment wildly', () => {
    const base = {
      weakestAssumptions: ['a'],
      strongestOpposingCase: 'b',
      counterEvidenceFound: [],
      sourceQualityFindings: [],
      comparison: 'c',
      challengeReasoning: 'd',
    };
    expect(() =>
      parseStructured('challenge', ChallengeResultSchema, {
        ...base,
        supportDelta: 0.9,
        penaltyDelta: 0,
      }),
    ).toThrow(StructuredOutputError);

    expect(
      parseStructured('challenge', ChallengeResultSchema, {
        ...base,
        supportDelta: 0.2,
        penaltyDelta: -0.1,
      }).supportDelta,
    ).toBe(0.2);
  });

  it('rejects a unit value outside 0–1', () => {
    const assessment = structuredClone(DANIEL_12_1.claims[0].assessment) as Record<string, unknown>;
    (assessment.evidence as Array<Record<string, unknown>>)[0].relevance = 1.4;
    expect(() => parseStructured('assess', ClaimAssessmentResultSchema, assessment)).toThrow(
      StructuredOutputError,
    );
  });

  it('validates every curated demonstration against the same schema a model must satisfy', () => {
    for (const claim of DANIEL_12_1.claims) {
      expect(() =>
        parseStructured('seed', ClaimAssessmentResultSchema, claim.assessment),
      ).not.toThrow();
    }
  });
});

describe('recovering JSON from a model response', () => {
  it('parses a bare object', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('parses a fenced block', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('parses an object preceded by preamble prose', () => {
    expect(extractJson('Here is the analysis:\n{"a":1}')).toEqual({ a: 1 });
  });

  it('raises rather than guessing when there is no parseable object', () => {
    expect(() => extractJson('I was unable to complete this analysis.')).toThrow();
  });
});

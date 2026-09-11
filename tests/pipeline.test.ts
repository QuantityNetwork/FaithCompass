import { beforeEach, describe, expect, it } from 'vitest';
import { runAnalysis } from '@/lib/evidence/pipeline';
import { challengeClaim } from '@/lib/evidence/challenge';
import { CorpusReasoningProvider } from '@/lib/evidence/providers/corpus';
import { NoAnalysisAvailableError } from '@/lib/evidence/providers/types';
import { setStore } from '@/lib/evidence/store';
import { DANIEL_12_1 } from '@/lib/evidence/seed/daniel-12-1';
import { BOOK_OF_MORMON_MIGRATION } from '@/lib/evidence/seed/book-of-mormon';
import { PONTIUS_PILATE } from '@/lib/evidence/seed/pontius-pilate';
import { MemoryStore } from './helpers/memory-store';

const provider = new CorpusReasoningProvider();

async function analyse(subject: typeof DANIEL_12_1, persist = false) {
  const result = await runAnalysis(
    {
      query: subject.aliases[0],
      reference: subject.reference,
      passageText: subject.passageText,
      persist,
    },
    provider,
  );
  if (!result.analysis) throw new Error('expected an analysis');
  return result;
}

beforeEach(() => setStore(new MemoryStore()));

describe('Daniel 12:1 — the flagship demonstration', () => {
  it('separates the verse into claims of different types', async () => {
    const { analysis } = await analyse(DANIEL_12_1);
    const types = new Set(analysis!.claims.map((c) => c.claimType));
    expect(analysis!.claims.length).toBeGreaterThanOrEqual(5);
    expect(types.has('TEXTUAL')).toBe(true);
    expect(types.has('INTERPRETIVE')).toBe(true);
    expect(types.has('THEOLOGICAL')).toBe(true);
  });

  it('scores the claims at genuinely different levels rather than as one object', async () => {
    const { analysis } = await analyse(DANIEL_12_1);
    const scores = analysis!.claims
      .map((c) => c.overallConfidence)
      .filter((s): s is number => s !== null);
    expect(Math.max(...scores) - Math.min(...scores)).toBeGreaterThan(40);
  });

  it('establishes the wording while holding the christological reading well below it', async () => {
    const { analysis } = await analyse(DANIEL_12_1);
    const textual = analysis!.claims.find((c) => c.claimType === 'TEXTUAL')!;
    const christ = analysis!.claims.find((c) => /Jesus Christ/.test(c.statement))!;

    expect(textual.confidenceLabel).toBe('VERY HIGH');
    expect(christ.overallConfidence!).toBeLessThan(40);
    expect(christ.positionNote).toBe('Minority theological interpretation.');
  });

  it('does not report the weakly-supported reading as false or contradicted', async () => {
    const { analysis } = await analyse(DANIEL_12_1);
    const christ = analysis!.claims.find((c) => /Jesus Christ/.test(c.statement))!;
    expect(christ.certainty).not.toBe('CONTRADICTED');
    expect(christ.whyThisScore.conclusion).toContain('not a verdict');
  });

  it('states the minority reading in its own strongest terms alongside the majority one', async () => {
    const { analysis } = await analyse(DANIEL_12_1);
    const christ = analysis!.claims.find((c) => /Jesus Christ/.test(c.statement))!;
    expect(christ.interpretations).toHaveLength(2);
    for (const interp of christ.interpretations) {
      expect(interp.directTextualSupport.length).toBeGreaterThan(20);
      expect(interp.assumptionsRequired.length).toBeGreaterThan(0);
      expect(interp.counterarguments.length).toBeGreaterThan(0);
    }
  });

  it('gives every claim a route to changing its own assessment', async () => {
    const { analysis } = await analyse(DANIEL_12_1);
    for (const claim of analysis!.claims) {
      expect(claim.whatWouldChangeThis.length, claim.statement).toBeGreaterThan(0);
    }
  });

  it('marks historical corroboration inapplicable rather than scoring it zero', async () => {
    const { analysis } = await analyse(DANIEL_12_1);
    const textual = analysis!.claims.find((c) => c.claimType === 'TEXTUAL')!;
    const historical = textual.primaryProfile.find((p) => p.dimension === 'historical')!;
    expect(historical.applicable).toBe(false);
    expect(historical.score).toBeNull();
  });
});

describe('cross-tradition assessment', () => {
  it('never produces a single verdict for the corpus as a whole', async () => {
    const { analysis } = await analyse(BOOK_OF_MORMON_MIGRATION);
    // Three claims, three very different outcomes: a documentary fact, a weakly
    // corroborated historical proposition, and a claim outside the method.
    const textual = analysis!.claims.find((c) => c.claimType === 'TEXTUAL')!;
    const historical = analysis!.claims.find((c) => c.claimType === 'HISTORICAL')!;
    const metaphysical = analysis!.claims.find((c) => c.claimType === 'METAPHYSICAL')!;

    expect(textual.overallConfidence!).toBeGreaterThan(60);
    expect(historical.overallConfidence!).toBeLessThan(40);
    expect(metaphysical.overallConfidence).toBeNull();
  });

  it('reports weak corroboration without declaring the tradition false', async () => {
    const { analysis } = await analyse(BOOK_OF_MORMON_MIGRATION);
    const historical = analysis!.claims.find((c) => c.claimType === 'HISTORICAL')!;
    expect(historical.whyThisScore.conclusion).toMatch(/not a statement that the tradition is false/);
    expect(historical.positionNote).toMatch(/not a verdict on a religious tradition/);
  });

  it('cites the tradition’s own scholarly response rather than summarising it away', async () => {
    const { analysis } = await analyse(BOOK_OF_MORMON_MIGRATION);
    const perspectives = analysis!.sources.map((s) => s.traditionPerspective);
    expect(perspectives).toContain('LATTER_DAY_SAINT');
    expect(perspectives).toContain('SECULAR_HISTORICAL_CRITICAL');
  });

  it('runs the absence framework rather than asserting the absence', async () => {
    const { analysis } = await analyse(BOOK_OF_MORMON_MIGRATION);
    const historical = analysis!.claims.find((c) => c.claimType === 'HISTORICAL')!;
    expect(historical.absence).not.toBeNull();
    expect(historical.absence!.verdict).toBe('EXPECTED_EVIDENCE_CONSPICUOUSLY_ABSENT');
    expect(historical.absence!.excavationCoverage.length).toBeGreaterThan(20);
  });
});

describe('category boundaries end to end', () => {
  it('keeps a strong historical result from transferring to a theological one', async () => {
    const { analysis } = await analyse(PONTIUS_PILATE);
    const historical = analysis!.claims.find((c) => c.claimType === 'HISTORICAL')!;
    const metaphysical = analysis!.claims.find((c) => c.claimType === 'METAPHYSICAL')!;

    expect(historical.overallConfidence!).toBeGreaterThan(85);
    expect(metaphysical.overallConfidence).toBeNull();
    expect(metaphysical.confidenceLabel).toBe('NOT DIRECTLY SCORABLE');
    expect(metaphysical.metaphysical?.historicalReach).toBeTruthy();
  });

  it('marks every primary dimension of a metaphysical claim inapplicable', async () => {
    const { analysis } = await analyse(PONTIUS_PILATE);
    const metaphysical = analysis!.claims.find((c) => c.claimType === 'METAPHYSICAL')!;
    expect(metaphysical.primaryProfile.every((p) => !p.applicable)).toBe(true);
  });
});

describe('citation handling in the pipeline', () => {
  it('cites only corpus-resident sources', async () => {
    const { analysis } = await analyse(DANIEL_12_1);
    const sourceIds = new Set(analysis!.sources.map((s) => s.id));
    for (const item of analysis!.evidence) {
      expect(sourceIds.has(item.sourceId), item.sourceId).toBe(true);
    }
  });

  it('caps an item’s independence at what the corpus dependency graph allows', async () => {
    const { analysis } = await analyse(DANIEL_12_1);
    for (const item of analysis!.evidence) {
      expect(item.independence).toBeLessThanOrEqual(1);
      expect(item.independence).toBeGreaterThanOrEqual(0);
    }
  });

  it('carries an unverified source through with its state intact', async () => {
    const { analysis } = await analyse(BOOK_OF_MORMON_MIGRATION);
    const unverified = analysis!.sources.filter((s) => s.verified === 'UNVERIFIED');
    expect(unverified.length).toBeGreaterThan(0);
    expect(unverified[0].reliabilityAssessment).toMatch(/UNVERIFIED|not been reconciled/);
  });
});

describe('guardrails in the pipeline', () => {
  it('returns a redirection instead of an analysis for a tradition-score request', async () => {
    const result = await runAnalysis({ query: 'Give Islam a truth score', persist: false }, provider);
    expect(result.analysis).toBeNull();
    expect(result.guardrail?.kind).toBe('TRADITION_SCORE');
  });
});

describe('the curated provider refuses rather than inventing', () => {
  it('raises when no curated analysis exists for the subject', async () => {
    await expect(
      runAnalysis({ query: 'the Epic of Gilgamesh flood narrative', persist: false }, provider),
    ).rejects.toBeInstanceOf(NoAnalysisAvailableError);
  });
});

describe('persistence and audit', () => {
  it('persists the analysis with the model and prompt versions that produced it', async () => {
    const store = new MemoryStore();
    setStore(store);
    const { analysis } = await analyse(DANIEL_12_1, true);

    const saved = await store.getAnalysis(analysis!.id);
    expect(saved).not.toBeNull();
    expect(saved!.modelProvider).toBe('corpus');
    expect(saved!.promptVersion).toBeTruthy();

    const audit = await store.listAudit(analysis!.id);
    expect(audit.some((r) => r.changeType === 'CREATED')).toBe(true);
    expect(audit[0].promptVersion).toBe(saved!.promptVersion);
  });

  it('resolves a persisted analysis by its passage slug', async () => {
    const store = new MemoryStore();
    setStore(store);
    await analyse(DANIEL_12_1, true);
    expect(await store.getAnalysisBySlug('daniel/12/1')).not.toBeNull();
  });
});

describe('challenge assessment', () => {
  it('records the previous score alongside the revised one', async () => {
    const store = new MemoryStore();
    setStore(store);
    const { analysis } = await analyse(DANIEL_12_1, true);
    const claim = analysis!.claims[0];

    const outcome = await challengeClaim(claim.id, provider);
    expect(outcome).not.toBeNull();
    expect(outcome!.challenge.previousScore).toBe(claim.overallConfidence);
    expect(outcome!.challenge.previousLabel).toBe(claim.confidenceLabel);
    expect(['LOWERED', 'RAISED', 'UNCHANGED']).toContain(outcome!.challenge.outcome);
  });

  it('writes the revision back to the claim and into the audit trail', async () => {
    const store = new MemoryStore();
    setStore(store);
    const { analysis } = await analyse(DANIEL_12_1, true);
    const claim = analysis!.claims[0];

    const outcome = await challengeClaim(claim.id, provider);
    const updated = await store.getAnalysis(analysis!.id);
    expect(updated!.claims[0].overallConfidence).toBe(outcome!.challenge.revisedScore);

    const audit = await store.listAudit(claim.id);
    const challenged = audit.find((r) => r.changeType === 'CHALLENGED')!;
    expect(challenged).toBeDefined();
    expect(challenged.oldValue).toEqual({
      score: claim.overallConfidence,
      label: claim.confidenceLabel,
    });
  });

  it('names the strongest opposing case and the weakest assumptions', async () => {
    const store = new MemoryStore();
    setStore(store);
    const { analysis } = await analyse(DANIEL_12_1, true);
    const christ = analysis!.claims.find((c) => /Jesus Christ/.test(c.statement))!;

    const outcome = await challengeClaim(christ.id, provider);
    expect(outcome!.challenge.weakestAssumptions.length).toBeGreaterThan(0);
    expect(outcome!.challenge.strongestOpposingCase.length).toBeGreaterThan(40);
  });

  it('keeps an unscorable claim unscorable through a challenge', async () => {
    const store = new MemoryStore();
    setStore(store);
    const { analysis } = await analyse(PONTIUS_PILATE, true);
    const metaphysical = analysis!.claims.find((c) => c.claimType === 'METAPHYSICAL')!;

    const outcome = await challengeClaim(metaphysical.id, provider);
    expect(outcome!.challenge.revisedScore).toBeNull();
    expect(outcome!.updatedClaim.confidenceLabel).toBe('NOT DIRECTLY SCORABLE');
  });

  it('returns null for a claim that does not exist', async () => {
    setStore(new MemoryStore());
    expect(await challengeClaim('no-such-claim', provider)).toBeNull();
  });
});

describe('coherence between a claim and its headline dimensions', () => {
  /**
   * A claim may legitimately score above every individual dimension: five
   * independent lines of moderate evidence converge to something stronger than
   * any one of them, which is what convergent evidence means. So there is no
   * general "claim <= best dimension" invariant to assert.
   *
   * What must hold is that the calibration floor applies consistently. Before
   * it did, a claim could be floored up to LOW while the single dimension it
   * was scored from still read VERY LOW — a headline figure contradicting the
   * only measurement behind it.
   */
  it('holds a headline dimension to the same calibration floor as its claim', async () => {
    const { analysis } = await analyse(DANIEL_12_1);
    const christ = analysis!.claims.find((c) => /Jesus Christ/.test(c.statement))!;
    const interpretive = christ.primaryProfile.find((p) => p.dimension === 'interpretive')!;

    expect(interpretive.score!).toBeGreaterThanOrEqual(christ.overallConfidence! - 8);
    expect(interpretive.confidenceLabel).toBe(christ.confidenceLabel);
  });

  it('applies the floor to every scored dimension of every claim', async () => {
    for (const subject of [DANIEL_12_1, PONTIUS_PILATE, BOOK_OF_MORMON_MIGRATION]) {
      const { analysis } = await analyse(subject);
      for (const claim of analysis!.claims) {
        if (claim.overallConfidence === null) continue;
        for (const p of claim.primaryProfile) {
          if (!p.applicable || p.score === null) continue;
          // A dimension may sit below its claim, but never so far below that
          // the claim's own floor would have lifted it.
          expect(
            p.score,
            `${claim.statement} — ${p.dimension} sits below the claim's floor`,
          ).toBeGreaterThanOrEqual(Math.min(claim.overallConfidence, 35) - 1);
        }
      }
    }
  });
});

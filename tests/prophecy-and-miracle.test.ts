import { beforeEach, describe, expect, it } from 'vitest';
import { runAnalysis } from '@/lib/evidence/pipeline';
import { CorpusReasoningProvider } from '@/lib/evidence/providers/corpus';
import { setStore } from '@/lib/evidence/store';
import { SEEDED_SUBJECTS, seededByClaimStatement } from '@/lib/evidence/seed';
import { DANIEL_9_SEVENTY_WEEKS } from '@/lib/evidence/seed/daniel-9-seventy-weeks';
import { RESURRECTION } from '@/lib/evidence/seed/resurrection';
import { EVIDENCE_DIMENSIONS, isDimensionAdmissible } from '@/lib/evidence/taxonomy';
import { MemoryStore } from './helpers/memory-store';

const provider = new CorpusReasoningProvider();

async function analyse(subject: typeof RESURRECTION) {
  const result = await runAnalysis(
    {
      query: subject.aliases[0],
      reference: subject.reference,
      passageText: subject.passageText,
      persist: false,
    },
    provider,
  );
  if (!result.analysis) throw new Error('expected an analysis');
  return result;
}

beforeEach(() => setStore(new MemoryStore()));

describe('prophetic framework (Daniel 9:24–27)', () => {
  it('assesses a fulfilment claim through the framework rather than asserting it', async () => {
    const { analysis } = await analyse(DANIEL_9_SEVENTY_WEEKS);
    const prophetic = analysis!.claims.find((c) => c.claimType === 'PROPHETIC')!;

    expect(prophetic.prophetic).not.toBeNull();
    const p = prophetic.prophetic!;
    expect(p.compositionDate.length).toBeGreaterThan(40);
    expect(p.earliestManuscriptEvidence.length).toBeGreaterThan(40);
    expect(p.specificity.length).toBeGreaterThan(20);
    expect(p.ambiguity.length).toBeGreaterThan(20);
    expect(p.retrospectiveCompositionRisk.length).toBeGreaterThan(20);
    expect(p.historicalCorrespondence.length).toBeGreaterThan(20);
  });

  it('counts the interpretive assumptions a fulfilment requires', async () => {
    const { analysis } = await analyse(DANIEL_9_SEVENTY_WEEKS);
    const prophetic = analysis!.claims.find((c) => c.claimType === 'PROPHETIC')!;
    expect(prophetic.prophetic!.interpretiveAssumptionCount).toBeGreaterThan(0);
    expect(prophetic.assumptions.length).toBe(
      prophetic.prophetic!.interpretiveAssumptionCount,
    );
  });

  it('names competing fulfilment candidates rather than one', async () => {
    const { analysis } = await analyse(DANIEL_9_SEVENTY_WEEKS);
    const prophetic = analysis!.claims.find((c) => c.claimType === 'PROPHETIC')!;
    expect(prophetic.prophetic!.alternativeFulfilmentCandidates.length).toBeGreaterThanOrEqual(3);
  });

  it('does not report a contested fulfilment as established', async () => {
    const { analysis } = await analyse(DANIEL_9_SEVENTY_WEEKS);
    const prophetic = analysis!.claims.find((c) => c.claimType === 'PROPHETIC')!;
    expect(prophetic.overallConfidence!).toBeLessThan(40);
    expect(prophetic.scholarlyPosition).toBe('SIGNIFICANTLY_DISPUTED');
    expect(prophetic.certainty).not.toBe('ESTABLISHED');
  });

  it('presents the competing readings without dismissing any of them', async () => {
    const { analysis } = await analyse(DANIEL_9_SEVENTY_WEEKS);
    const prophetic = analysis!.claims.find((c) => c.claimType === 'PROPHETIC')!;
    expect(prophetic.interpretations.length).toBeGreaterThanOrEqual(3);
    for (const interp of prophetic.interpretations) {
      expect(interp.directTextualSupport.length).toBeGreaterThan(20);
      expect(interp.counterarguments.length).toBeGreaterThan(0);
    }
  });

  it('lets the dating dispute reach the assessment instead of excluding it', async () => {
    // The conservative linguistic objection is a CHALLENGES item on a
    // chronological claim. Before linguistic_fit was admissible for that claim
    // type it was silently dropped as a category error.
    const { analysis, citationFlags } = await analyse(DANIEL_9_SEVENTY_WEEKS);
    expect(citationFlags).toHaveLength(0);

    const dating = analysis!.claims.find((c) => c.claimType === 'CHRONOLOGICAL')!;
    const linguistic = analysis!.evidence.filter(
      (e) => e.claimId === dating.id && e.dimension === 'linguistic_fit',
    );
    expect(linguistic.length).toBeGreaterThan(0);
    expect(linguistic.some((e) => e.relationship === 'CHALLENGES')).toBe(true);
  });

  it('weights a source that survives only through a hostile intermediary very low', async () => {
    const { analysis } = await analyse(DANIEL_9_SEVENTY_WEEKS);
    const porphyry = analysis!.evidence.find((e) => e.sourceId === 'anc.porphyry-via-jerome')!;
    expect(porphyry).toBeDefined();
    expect(porphyry.independence).toBeLessThan(0.4);
    // Jerome is cited in the same analysis, and Porphyry depends on him.
    expect(analysis!.sources.map((s) => s.id)).toContain('anc.jerome-daniel');
  });
});

describe('miracle framework (the resurrection)', () => {
  it('separates the historical claims from the metaphysical one', async () => {
    const { analysis } = await analyse(RESURRECTION);
    const crucifixion = analysis!.claims.find((c) => c.claimType === 'BIOGRAPHICAL')!;
    const metaphysical = analysis!.claims.find((c) => c.claimType === 'METAPHYSICAL')!;

    expect(crucifixion.overallConfidence!).toBeGreaterThan(85);
    expect(metaphysical.overallConfidence).toBeNull();
    expect(metaphysical.confidenceLabel).toBe('NOT DIRECTLY SCORABLE');
  });

  it('does not let a very strong historical result transfer to the theological claim', async () => {
    const { analysis } = await analyse(RESURRECTION);
    const metaphysical = analysis!.claims.find((c) => c.claimType === 'METAPHYSICAL')!;

    expect(metaphysical.primaryProfile.every((p) => !p.applicable)).toBe(true);
    expect(metaphysical.metaphysical!.historicalReach).toMatch(/stops|cannot|not a hypothesis/i);
    expect(metaphysical.whyThisScore.conclusion).toMatch(/does not transfer|stops where it stops/i);
  });

  it('distinguishes early belief from the truth of what was believed', async () => {
    const { analysis } = await analyse(RESURRECTION);
    const belief = analysis!.claims.find((c) => /convinced they had encountered/.test(c.statement))!;
    expect(belief.overallConfidence!).toBeGreaterThan(80);
    expect(belief.whyThisScore.conclusion).toMatch(/about what people believed/i);
  });

  it('reports the disputed claim as disputed rather than resolving it', async () => {
    const { analysis } = await analyse(RESURRECTION);
    const tomb = analysis!.claims.find((c) => /tomb/.test(c.statement))!;
    expect(tomb.scholarlyPosition).toBe('SIGNIFICANTLY_DISPUTED');
    expect(tomb.overallConfidence!).toBeLessThan(
      analysis!.claims.find((c) => c.claimType === 'BIOGRAPHICAL')!.overallConfidence!,
    );
  });

  it('cites a sceptical source as support where it concedes the datum', async () => {
    const { analysis } = await analyse(RESURRECTION);
    const belief = analysis!.claims.find((c) => /convinced they had encountered/.test(c.statement))!;
    const sceptical = analysis!.evidence.find(
      (e) => e.claimId === belief.id && e.sourceId === 'sch.ehrman-how-jesus-became-god',
    );
    expect(sceptical?.relationship).toBe('SUPPORTS');
  });

  it('treats an absence that predicts nothing as carrying no penalty', async () => {
    const { analysis } = await analyse(RESURRECTION);
    const tomb = analysis!.claims.find((c) => /tomb/.test(c.statement))!;
    expect(tomb.absence!.verdict).toBe('NO_EVIDENCE_DISCOVERED');
    expect(tomb.absence!.penalty).toBe(0);

    const metaphysical = analysis!.claims.find((c) => c.claimType === 'METAPHYSICAL')!;
    expect(metaphysical.absence!.verdict).toBe('NOT_APPLICABLE');
    expect(metaphysical.absence!.penalty).toBe(0);
  });
});

describe('claim resolution', () => {
  it('resolves a claim by exact statement, not by whatever subject its wording mentions', () => {
    // Regression: this claim names Pontius Pilate and previously resolved to
    // the Pilate subject, so it was assessed against the wrong material.
    const statement = 'Jesus of Nazareth was crucified under the authority of Pontius Pilate.';
    expect(seededByClaimStatement(statement)?.id).toBe(RESURRECTION.id);
  });

  it('keeps claim statements unique across subjects, since they are lookup keys', () => {
    const seen = new Set<string>();
    for (const subject of SEEDED_SUBJECTS) {
      for (const claim of subject.claims) {
        expect(seen.has(claim.statement), `duplicate: ${claim.statement}`).toBe(false);
        seen.add(claim.statement);
      }
    }
  });
});

describe('taxonomy coverage', () => {
  it('exercises every evidence dimension in at least one curated analysis', () => {
    const used = new Set<string>();
    for (const subject of SEEDED_SUBJECTS) {
      for (const claim of subject.claims) {
        for (const e of claim.assessment.evidence) used.add(e.dimension);
        for (const d of claim.assessment.dimensionReasoning) used.add(d.dimensionType);
      }
    }
    const unexercised = EVIDENCE_DIMENSIONS.filter((d) => !used.has(d));
    expect(unexercised, `unexercised dimensions: ${unexercised.join(', ')}`).toHaveLength(0);
  });

  it('admits the standard arguments for dating a text to a chronological claim', () => {
    // Linguistic profile and first attestation are how texts are actually
    // dated; ruling them inadmissible would exclude the whole argument.
    expect(isDimensionAdmissible('CHRONOLOGICAL', 'linguistic_fit')).toBe(true);
    expect(isDimensionAdmissible('CHRONOLOGICAL', 'ancient_reception')).toBe(true);
    expect(isDimensionAdmissible('CHRONOLOGICAL', 'authorship_confidence')).toBe(true);
  });

  it('admits what a prediction’s words can bear to a prophetic claim', () => {
    expect(isDimensionAdmissible('PROPHETIC', 'linguistic_fit')).toBe(true);
    expect(isDimensionAdmissible('PROPHETIC', 'source_dependence')).toBe(true);
  });

  it('admits manuscript transmission to a historical claim', () => {
    // An event known only from a passage absent in the best manuscripts is less
    // well evidenced than one that is not.
    expect(isDimensionAdmissible('HISTORICAL', 'manuscript_attestation')).toBe(true);
  });

  it('still refuses every empirical dimension to a metaphysical claim', () => {
    for (const d of ['manuscript_attestation', 'archaeological_correspondence', 'independent_sources'] as const) {
      expect(isDimensionAdmissible('METAPHYSICAL', d)).toBe(false);
    }
  });
});

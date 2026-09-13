import { describe, expect, it } from 'vitest';
import {
  applyCalibration,
  computeScore,
  itemWeight,
  rollUpPrimary,
  scoreDimension,
  type ScorableEvidence,
} from '@/lib/evidence/scoring';
import type { EvidenceDimensionType } from '@/lib/evidence/taxonomy';

const NO_PENALTIES = {
  missingEvidence: 0,
  sourceDependence: 0,
  chronologyUncertainty: 0,
  interpretiveAmbiguity: 0,
  scholarlyDisagreement: 0,
};

function item(over: Partial<ScorableEvidence> = {}): ScorableEvidence {
  return {
    relationship: 'SUPPORTS',
    dimension: 'manuscript_attestation',
    qualityTier: 'A',
    directness: 0.9,
    relevance: 0.9,
    independence: 0.9,
    ...over,
  };
}

describe('itemWeight', () => {
  it('is conjunctive: a superb but irrelevant source is weak evidence for this claim', () => {
    const superb = item({ relevance: 0.1 });
    const modest = item({ qualityTier: 'C', relevance: 0.9 });
    expect(itemWeight(superb)).toBeLessThan(itemWeight(modest));
  });

  it('discounts a source that is not independent of others already cited', () => {
    expect(itemWeight(item({ independence: 0.2 }))).toBeLessThan(
      itemWeight(item({ independence: 1 })),
    );
  });
});

describe('computeScore', () => {
  it('gives diminishing returns: a fifth corroborating source adds less than the second', () => {
    const score = (n: number) =>
      computeScore({
        claimType: 'TEXTUAL',
        evidence: Array.from({ length: n }, () => item()),
        penalties: NO_PENALTIES,
        scholarlyPosition: 'PLURALITY_POSITION',
      }).score!;

    const secondGain = score(2) - score(1);
    const fifthGain = score(5) - score(4);
    expect(fifthGain).toBeLessThan(secondGain);
  });

  it('excludes evidence from a dimension that cannot bear on the claim type', () => {
    const result = computeScore({
      claimType: 'METAPHYSICAL',
      evidence: [item({ dimension: 'archaeological_correspondence' })],
      penalties: NO_PENALTIES,
      scholarlyPosition: 'PLURALITY_POSITION',
    });
    expect(result.calibrationNotes.join(' ')).toContain('inadmissible');
  });

  it('issues no number for a claim historical method cannot adjudicate', () => {
    const result = computeScore({
      claimType: 'METAPHYSICAL',
      evidence: [item({ dimension: 'canonical_correspondence' })],
      penalties: NO_PENALTIES,
      scholarlyPosition: 'INSUFFICIENT_LITERATURE',
    });
    expect(result.score).toBeNull();
    expect(result.scorable).toBe(false);
    expect(result.confidenceLabel).toBe('NOT DIRECTLY SCORABLE');
    expect(result.certainty).toBe('NOT_DIRECTLY_SCORABLE');
  });

  it('does not report CONTRADICTED merely because support is weak', () => {
    const result = computeScore({
      claimType: 'HISTORICAL',
      evidence: [
        item({ relationship: 'WEAKLY_SUPPORTS', dimension: 'independent_sources' }),
        item({ relationship: 'CHALLENGES', dimension: 'independent_sources' }),
        item({ relationship: 'CHALLENGES', dimension: 'archaeological_correspondence' }),
      ],
      penalties: NO_PENALTIES,
      scholarlyPosition: 'BROAD_CONSENSUS',
    });
    expect(result.certainty).not.toBe('CONTRADICTED');
  });

  it('reports CONTRADICTED when evidence actually conflicts with the claim', () => {
    const result = computeScore({
      claimType: 'HISTORICAL',
      evidence: [
        item({ relationship: 'WEAKLY_SUPPORTS', dimension: 'independent_sources' }),
        item({ relationship: 'CONTRADICTS', dimension: 'archaeological_correspondence' }),
      ],
      penalties: NO_PENALTIES,
      scholarlyPosition: 'BROAD_CONSENSUS',
    });
    expect(result.certainty).toBe('CONTRADICTED');
  });

  it('treats recovered conflicting evidence differently from an argument from silence', () => {
    const base = {
      claimType: 'HISTORICAL' as const,
      evidence: [item({ dimension: 'external_historical_corroboration' })],
      penalties: NO_PENALTIES,
      scholarlyPosition: 'PLURALITY_POSITION' as const,
    };
    expect(computeScore({ ...base, absencePenalty: 0.8 }).certainty).not.toBe('CONTRADICTED');
    expect(computeScore({ ...base, evidenceInconsistent: true }).certainty).toBe('CONTRADICTED');
  });

  it('lets counter-evidence weigh more against a thin base than against a strong one', () => {
    const challenge = item({ relationship: 'CHALLENGES' });
    const thin = computeScore({
      claimType: 'TEXTUAL',
      evidence: [item(), challenge],
      penalties: NO_PENALTIES,
      scholarlyPosition: 'PLURALITY_POSITION',
    }).score!;
    const strongBase = computeScore({
      claimType: 'TEXTUAL',
      evidence: [item(), item(), item(), item(), challenge],
      penalties: NO_PENALTIES,
      scholarlyPosition: 'PLURALITY_POSITION',
    }).score!;
    expect(strongBase).toBeGreaterThan(thin);
  });

  it('records the consensus adjustment separately rather than treating it as proof', () => {
    const disputed = computeScore({
      claimType: 'TEXTUAL',
      evidence: [item(), item()],
      penalties: NO_PENALTIES,
      scholarlyPosition: 'SIGNIFICANTLY_DISPUTED',
    });
    const agreed = computeScore({
      claimType: 'TEXTUAL',
      evidence: [item(), item()],
      penalties: NO_PENALTIES,
      scholarlyPosition: 'BROAD_CONSENSUS',
    });
    expect(agreed.score!).toBeGreaterThan(disputed.score!);
    // Bounded: consensus nudges, it does not decide.
    expect(agreed.score! - disputed.score!).toBeLessThanOrEqual(8);
    expect(agreed.calibrationNotes.join(' ')).toContain('never treated as proof');
  });

  it('applies penalties without letting them drive a well-evidenced claim to the floor', () => {
    const result = computeScore({
      claimType: 'TEXTUAL',
      evidence: [item(), item(), item()],
      penalties: {
        missingEvidence: 1,
        sourceDependence: 1,
        chronologyUncertainty: 1,
        interpretiveAmbiguity: 1,
        scholarlyDisagreement: 1,
      },
      scholarlyPosition: 'PLURALITY_POSITION',
    });
    expect(result.score!).toBeGreaterThan(20);
  });
});

describe('calibration', () => {
  it('caps above 95 unless three independent primary sources carry the claim', () => {
    const notes: string[] = [];
    const capped = applyCalibration(99, {
      claimType: 'HISTORICAL',
      evidence: [item({ qualityTier: 'A' }), item({ qualityTier: 'B' })],
      support: 0.99,
      challenge: 0,
      notes,
    });
    expect(capped).toBe(95);
    expect(notes.join(' ')).toContain('three independent Tier A');
  });

  it('allows above 95 where three independent primary sources do carry it', () => {
    const notes: string[] = [];
    expect(
      applyCalibration(97, {
        claimType: 'HISTORICAL',
        evidence: [item(), item(), item()],
        support: 0.99,
        challenge: 0,
        notes,
      }),
    ).toBe(97);
  });

  it('holds a claim resting only on general secondary material below High', () => {
    const notes: string[] = [];
    expect(
      applyCalibration(88, {
        claimType: 'HISTORICAL',
        evidence: [item({ qualityTier: 'D' }), item({ qualityTier: 'E' })],
        support: 0.9,
        challenge: 0,
        notes,
      }),
    ).toBe(69);
  });

  it('caps interpretive and theological readings below the top band', () => {
    const notes: string[] = [];
    expect(
      applyCalibration(97, {
        claimType: 'INTERPRETIVE',
        evidence: [item(), item(), item()],
        support: 0.99,
        challenge: 0,
        notes,
      }),
    ).toBe(92);
  });

  it('floors a claim at the level its own supporting evidence sustains', () => {
    const notes: string[] = [];
    const floored = applyCalibration(2, {
      claimType: 'THEOLOGICAL',
      evidence: [item({ qualityTier: 'C' })],
      support: 0.4,
      challenge: 0.9,
      notes,
    });
    expect(floored).toBeGreaterThanOrEqual(12);
    expect(notes.join(' ')).toContain(
      'Very low scores are reserved for claims with no meaningful evidential support',
    );
  });

  it('does not floor a claim with no meaningful supporting evidence', () => {
    const notes: string[] = [];
    expect(
      applyCalibration(3, {
        claimType: 'HISTORICAL',
        evidence: [],
        support: 0,
        challenge: 0.9,
        notes,
      }),
    ).toBe(3);
  });
});

describe('primary dimension roll-up', () => {
  const evidenced = new Set<EvidenceDimensionType>([
    'manuscript_attestation',
    'transmission_stability',
  ]);

  it('summarises only dimensions the evidence ledger actually reached', () => {
    const rolled = rollUpPrimary('textual', {
      claimType: 'TEXTUAL',
      dimensionScores: {
        manuscript_attestation: 90,
        transmission_stability: 88,
        // Asserted but uncited: must not drag the headline figure down.
        dating_confidence: 20,
      },
      evidencedDimensions: evidenced,
    });
    expect(rolled).toBeGreaterThan(85);
  });

  it('returns null rather than zero when no admissible dimension was evidenced', () => {
    expect(
      rollUpPrimary('historical', {
        claimType: 'METAPHYSICAL',
        dimensionScores: {},
        evidencedDimensions: new Set(),
      }),
    ).toBeNull();
  });

  it('is pulled down by its weakest evidenced contributor', () => {
    const even = rollUpPrimary('textual', {
      claimType: 'TEXTUAL',
      dimensionScores: { manuscript_attestation: 80, transmission_stability: 80 },
      evidencedDimensions: evidenced,
    })!;
    const uneven = rollUpPrimary('textual', {
      claimType: 'TEXTUAL',
      dimensionScores: { manuscript_attestation: 100, transmission_stability: 60 },
      evidencedDimensions: evidenced,
    })!;
    expect(uneven).toBeLessThan(even);
  });
});

describe('scoreDimension', () => {
  it('scores an inadmissible dimension at zero rather than guessing', () => {
    expect(scoreDimension('archaeological_correspondence', 'METAPHYSICAL', [], 0.9)).toBe(0);
  });

  it('discounts a dimension the model asserts but cites nothing for', () => {
    const cited = scoreDimension('manuscript_attestation', 'TEXTUAL', [item()], 0.9);
    const asserted = scoreDimension('manuscript_attestation', 'TEXTUAL', [], 0.9);
    expect(asserted).toBeLessThan(cited);
  });

  it('lets the cited items outweigh the model’s own read of the dimension', () => {
    const optimistic = scoreDimension(
      'manuscript_attestation',
      'TEXTUAL',
      [item({ relationship: 'CHALLENGES' })],
      1,
    );
    expect(optimistic).toBeLessThan(50);
  });
});

describe('floor consistency between a claim and its dimensions', () => {
  it('reports the floor its supporting evidence sustains', () => {
    const result = computeScore({
      claimType: 'THEOLOGICAL',
      evidence: [
        item({ qualityTier: 'C', dimension: 'ancient_reception', relationship: 'WEAKLY_SUPPORTS' }),
        item({ dimension: 'canonical_correspondence', relationship: 'CHALLENGES' }),
        item({ dimension: 'ancient_reception', relationship: 'CHALLENGES' }),
      ],
      penalties: NO_PENALTIES,
      scholarlyPosition: 'MINORITY_POSITION',
    });
    expect(result.floor).not.toBeNull();
    expect(result.score!).toBeGreaterThanOrEqual(result.floor!);
  });

  it('reports no floor where there is no meaningful supporting evidence', () => {
    const result = computeScore({
      claimType: 'HISTORICAL',
      evidence: [item({ relationship: 'CHALLENGES', dimension: 'independent_sources' })],
      penalties: NO_PENALTIES,
      scholarlyPosition: 'BROAD_CONSENSUS',
    });
    expect(result.floor).toBeNull();
  });

  it('reports no floor for a claim that receives no number at all', () => {
    const result = computeScore({
      claimType: 'METAPHYSICAL',
      evidence: [item({ dimension: 'canonical_correspondence' })],
      penalties: NO_PENALTIES,
      scholarlyPosition: 'INSUFFICIENT_LITERATURE',
    });
    expect(result.floor).toBeNull();
  });
});

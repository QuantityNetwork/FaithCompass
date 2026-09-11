import { describe, expect, it } from 'vitest';
import {
  ADMISSIBLE_DIMENSIONS,
  CLAIM_TYPES,
  EVIDENCE_DIMENSIONS,
  certaintyFor,
  confidenceLabelFor,
  isDimensionAdmissible,
} from '@/lib/evidence/taxonomy';

describe('confidence label mapping', () => {
  const cases: Array<[number, string]> = [
    [100, 'EXCEPTIONAL'],
    [95, 'EXCEPTIONAL'],
    [94, 'VERY HIGH'],
    [85, 'VERY HIGH'],
    [84, 'HIGH'],
    [70, 'HIGH'],
    [69, 'MODERATE'],
    [55, 'MODERATE'],
    [54, 'LIMITED'],
    [40, 'LIMITED'],
    [39, 'LOW'],
    [20, 'LOW'],
    [19, 'VERY LOW'],
    [0, 'VERY LOW'],
  ];

  for (const [score, label] of cases) {
    it(`maps ${score} to ${label}`, () => {
      expect(confidenceLabelFor(score)).toBe(label);
    });
  }

  it('rejects a score outside the scale rather than clamping silently', () => {
    expect(() => confidenceLabelFor(101)).toThrow(RangeError);
    expect(() => confidenceLabelFor(-1)).toThrow(RangeError);
    expect(() => confidenceLabelFor(Number.NaN)).toThrow(RangeError);
  });
});

describe('certainty derivation', () => {
  it('never returns CONTRADICTED for a merely weak claim', () => {
    expect(certaintyFor(4)).toBe('UNSUPPORTED');
    expect(certaintyFor(25)).toBe('SPECULATIVE');
  });

  it('returns CONTRADICTED only on an explicit finding of conflicting evidence', () => {
    expect(certaintyFor(70, { evidenceConflicts: true })).toBe('CONTRADICTED');
  });

  it('marks an unscorable claim rather than assigning it a level', () => {
    expect(certaintyFor(0, { scorable: false })).toBe('NOT_DIRECTLY_SCORABLE');
    // Even a high score cannot override unscorability.
    expect(certaintyFor(95, { scorable: false })).toBe('NOT_DIRECTLY_SCORABLE');
  });
});

describe('category boundaries', () => {
  it('does not let archaeology bear on a metaphysical claim', () => {
    expect(isDimensionAdmissible('METAPHYSICAL', 'archaeological_correspondence')).toBe(false);
    expect(isDimensionAdmissible('METAPHYSICAL', 'material_culture')).toBe(false);
    expect(isDimensionAdmissible('METAPHYSICAL', 'independent_sources')).toBe(false);
  });

  it('does not let manuscript counts bear on a metaphysical claim', () => {
    expect(isDimensionAdmissible('METAPHYSICAL', 'manuscript_attestation')).toBe(false);
  });

  it('lets a metaphysical claim be assessed for canonical grounding and reception', () => {
    expect(isDimensionAdmissible('METAPHYSICAL', 'canonical_correspondence')).toBe(true);
    expect(isDimensionAdmissible('METAPHYSICAL', 'ancient_reception')).toBe(true);
  });

  it('lets archaeology bear on historical and archaeological claims', () => {
    expect(isDimensionAdmissible('HISTORICAL', 'archaeological_correspondence')).toBe(true);
    expect(isDimensionAdmissible('ARCHAEOLOGICAL', 'material_culture')).toBe(true);
  });

  it('gives every claim type a non-empty, well-formed admissible set', () => {
    for (const type of CLAIM_TYPES) {
      const dims = ADMISSIBLE_DIMENSIONS[type];
      expect(dims.length, `${type} has no admissible dimensions`).toBeGreaterThan(0);
      for (const d of dims) {
        expect(EVIDENCE_DIMENSIONS, `${type} references unknown dimension ${d}`).toContain(d);
      }
      expect(new Set(dims).size, `${type} lists a dimension twice`).toBe(dims.length);
    }
  });
});

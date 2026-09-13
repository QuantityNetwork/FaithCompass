import { describe, expect, it } from 'vitest';
import { absenceVerdict, absenceWeight, buildAbsenceAssessment } from '@/lib/evidence/absence';

const PROSE = {
  wouldEvidenceSurvive: 'x',
  excavationCoverage: 'x',
  expectedMaterialFootprint: 'x',
  datingPrecision: 'x',
  materialCultureDistinctiveness: 'x',
};

const STRONG = {
  survivalLikelihood: 0.9,
  excavationCoverage: 0.9,
  expectedFootprint: 0.9,
  datingPrecision: 0.9,
  materialDistinctiveness: 0.9,
  conflictingEvidenceFound: false,
  predictsMaterialEvidence: true,
};

describe('absence of evidence', () => {
  it('carries weight when all five conditions hold', () => {
    expect(absenceWeight(STRONG)).toBeGreaterThan(0.35);
    expect(absenceVerdict(STRONG)).toBe('EXPECTED_EVIDENCE_CONSPICUOUSLY_ABSENT');
  });

  it('carries almost none when the evidence would not survive', () => {
    const perishable = { ...STRONG, survivalLikelihood: 0.05 };
    expect(absenceWeight(perishable)).toBeLessThan(0.1);
    expect(absenceVerdict(perishable)).toBe('NO_EVIDENCE_DISCOVERED');
  });

  it('carries almost none when nobody has excavated', () => {
    const unexcavated = { ...STRONG, excavationCoverage: 0.05 };
    expect(absenceVerdict(unexcavated)).toBe('NO_EVIDENCE_DISCOVERED');
  });

  it('is defeated by any single failing condition, not averaged away', () => {
    // Four excellent conditions cannot rescue an inference the fifth defeats.
    const oneFailure = { ...STRONG, materialDistinctiveness: 0.02 };
    expect(absenceWeight(oneFailure)).toBeLessThan(absenceWeight(STRONG) * 0.1);
  });

  it('distinguishes recovered conflicting evidence from silence', () => {
    const conflicting = { ...STRONG, conflictingEvidenceFound: true };
    expect(absenceVerdict(conflicting)).toBe('EVIDENCE_INCONSISTENT_WITH_CLAIM');
    expect(buildAbsenceAssessment(conflicting, PROSE).penalty).toBeGreaterThanOrEqual(0.6);
  });

  it('is not applicable to a claim that predicts no material evidence', () => {
    const metaphysical = { ...STRONG, predictsMaterialEvidence: false };
    expect(absenceVerdict(metaphysical)).toBe('NOT_APPLICABLE');
    expect(buildAbsenceAssessment(metaphysical, PROSE).penalty).toBe(0);
  });

  it('penalises mere non-discovery far less than a conspicuous absence', () => {
    const quiet = { ...STRONG, excavationCoverage: 0.1 };
    expect(buildAbsenceAssessment(quiet, PROSE).penalty).toBeLessThan(
      buildAbsenceAssessment(STRONG, PROSE).penalty,
    );
  });
});

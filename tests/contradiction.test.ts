import { describe, expect, it } from 'vitest';
import { normalizeDate, normalizeEntity, normalizeFact, normalizePeriod, normalizeUnit, periodsDisjoint } from '@/lib/contradiction/normalize';
import { NO_AI_CANDIDATES, combineLayers, compareFacts, detectDeterministic, type CandidateSource } from '@/lib/contradiction/detect';
import { decisionTwinFacts } from '@/lib/contradiction/decision-twin';
import { CONTRADICTIONS } from '@/lib/decision/engines/v1/contradictions';

const f = (over: Record<string, unknown>) => ({ id: 'a', entity: 'Acme Ltd', concept: 'total_debt', value: 100, unit: '$M', period: 'FY2025', basis: 'Reported', ...over });

describe('context normalisation', () => {
  it('entity, period, unit, date', () => {
    expect(normalizeEntity('Acme Holdings, Inc.')).toBe(normalizeEntity('ACME holdings'));
    expect(normalizePeriod('FY 2025')).toBe('FY2025');
    expect(normalizePeriod('2025 FY')).toBe('FY2025');
    expect(normalizePeriod('LTM to 30 Jun 2026')).toBe('LTM:2026-06-30');
    expect(normalizePeriod('Q1 2027')).toBe('2027-Q1');
    expect(normalizeDate('June 30, 2026')).toBe('2026-06-30');
    expect(normalizeUnit('USD m').unit).toBe('USD_M');
    expect(normalizeFact(f({ value: 0.124, unit: '$B' })).canonicalValue).toBe(124);
    expect(normalizeFact(f({ value: 124000, unit: '$K' })).canonicalValue).toBe(124);
    expect(periodsDisjoint('FY2025', 'FY2026')).toBe(true);
    expect(periodsDisjoint('FY2025', 'LTM:2026-06-30')).toBe(false);
  });
});

describe('deterministic layer', () => {
  it('same context, different values: CONFIRMED_CONFLICT; equal after unit scaling: no finding', () => {
    expect(compareFacts(f({}), f({ id: 'b', value: 110 }))?.class).toBe('CONFIRMED_CONFLICT');
    expect(compareFacts(f({}), f({ id: 'b', value: 0.1, unit: '$B' }))).toBeNull();
    expect(compareFacts(f({}), f({ id: 'b', value: 100.3 }))).toBeNull(); // within 0.5% rounding tolerance
  });

  it('basis, definition or scope differ: DIFFERENT_REPORTING_BASIS, with the dimensions named', () => {
    expect(compareFacts(f({}), f({ id: 'b', value: 120, basis: 'Adjusted' }))).toMatchObject({ class: 'DIFFERENT_REPORTING_BASIS', differs: ['basis'] });
    expect(compareFacts(f({ scope: 'consolidated' }), f({ id: 'b', value: 80, scope: 'opco' }))?.differs).toEqual(['scope']);
    expect(compareFacts(f({ definition: 'gross' }), f({ id: 'b', value: 80, definition: 'net' }))?.class).toBe('DIFFERENT_REPORTING_BASIS');
  });

  it('different period, version or effective date alone: two facts, not a conflict', () => {
    expect(compareFacts(f({}), f({ id: 'b', value: 120, period: 'FY2026' }))).toBeNull();
    expect(compareFacts(f({ version: 'v1', period: null }), f({ id: 'b', value: 120, version: 'v2', period: null }))).toBeNull();
    expect(compareFacts(f({ effectiveDate: '2026-01-01', period: null }), f({ id: 'b', value: 120, effectiveDate: '1 Jul 2026', period: null }))).toBeNull();
  });

  it('missing value, incomplete context, different entity, incompatible units', () => {
    expect(compareFacts(f({}), f({ id: 'b', value: null }))?.class).toBe('MISSING_EVIDENCE');
    expect(compareFacts(f({}), f({ id: 'b', value: 120, basis: null }))).toMatchObject({ class: 'POTENTIAL_CONFLICT', unknown: ['basis'] });
    expect(compareFacts(f({}), f({ id: 'b', value: 120, entity: 'Other Co' }))).toBeNull();
    expect(compareFacts(f({}), f({ id: 'b', value: 12, unit: '%' }))).toBeNull();
  });

  it('text values and mutual exclusivity', () => {
    expect(compareFacts(f({ value: 'None', unit: 'text' }), f({ id: 'b', value: '10% of EBITDA', unit: 'text' }))?.class).toBe('UNRESOLVED_INTERPRETATION');
    const g = { concept: 'renewal', unit: 'text', exclusiveGroup: 'top customer renewal' };
    expect(compareFacts(f({ ...g, value: 'renews' }), f({ ...g, id: 'b', concept: 'renewal_intent', value: 'does not renew' }))).toMatchObject({ class: 'CONFIRMED_CONFLICT', rule: 'mutually exclusive options asserted together' });
    expect(compareFacts(f({ ...g, value: 'renews' }), f({ ...g, id: 'b', value: 'Renews' }))).toBeNull();
  });

  it('on the Decision Twin documents: finds the curated X-01, X-03 and X-05 with their classes, nothing in conflict with the map', () => {
    const found = detectDeterministic(decisionTwinFacts());
    const key = (a: string, b: string) => [a, b].sort().join('|');
    const byPair = new Map(found.map((x) => [key(...x.facts), x.class]));
    const matched = CONTRADICTIONS.filter((c) => c.b && byPair.get(key(`span:${c.a.doc}#${c.a.field}`, `span:${c.b.doc}#${c.b.field}`)) === c.class).map((c) => c.id);
    expect(matched).toEqual(['X-01', 'X-03', 'X-05']);
    // The one finding outside the map: DOC-09 restates DOC-01's reported EBITDA, so it differs from the memo's adjusted LTM figure the same way.
    expect(found.map((x) => key(...x.facts)).filter((k) => !CONTRADICTIONS.some((c) => c.b && key(`span:${c.a.doc}#${c.a.field}`, `span:${c.b.doc}#${c.b.field}`) === k))).toEqual([
      key('span:DOC-04#adj_ebitda_ltm', 'span:DOC-09#ebitda_fy2025'),
    ]);
  });
});

describe('AI-candidate layer (interface only, no AI call)', () => {
  it('ships no provider and returns no candidates', async () => {
    const r = await combineLayers(decisionTwinFacts());
    expect(NO_AI_CANDIDATES.configured).toBe(false);
    expect(r.candidates).toEqual([]);
    expect(r.candidateSource).toEqual({ id: 'none', configured: false });
    expect(r.deterministic).toHaveLength(4);
  });

  it('a configured source stays separate: capped at POTENTIAL_CONFLICT, human review, unknown refs dropped, deterministic untouched', async () => {
    const facts = decisionTwinFacts();
    const fake: CandidateSource = {
      id: 'fixture',
      configured: true,
      propose: async () => [
        { class: 'CONFIRMED_CONFLICT', facts: ['span:DOC-02#top_customer_volume_growth', 'span:DOC-07#renewal_risk'], rationale: 'fixture' },
        { class: 'POTENTIAL_CONFLICT', facts: ['span:nowhere'], rationale: 'fixture' },
      ],
    };
    const r = await combineLayers(facts, fake);
    expect(r.deterministic).toEqual(detectDeterministic(facts));
    expect(r.candidates).toEqual([expect.objectContaining({ class: 'POTENTIAL_CONFLICT', layer: 'ai_candidate', source: 'fixture', requiresHumanReview: true })]);
  });
});

import { describe, expect, it } from 'vitest';
import { createAiReader, parseAiReading } from '@/lib/contradiction/ai-candidates';
import { combineLayers, compareFacts, deterministicVeto, supersedes } from '@/lib/contradiction/detect';
import { legalFormOf, normalizeUnit } from '@/lib/contradiction/normalize';
import { runCasePipeline } from '@/lib/evidence-graph/case-pipeline';

const f = (over: Record<string, unknown>) => ({ id: 'a', entity: 'Acme Holdings', concept: 'revenue', value: 100, unit: '$m', period: 'FY2025', basis: 'reported', ...over }) as any;

describe('deterministic rules added 2026-10-21 (v1 failure analysis)', () => {
  it('legal forms: different forms are different entities, spelling variants are one', () => {
    expect(legalFormOf('Tamsin AB')).toBe('AB');
    expect(legalFormOf('Tamsin Limited')).toBe(legalFormOf('Tamsin Ltd'));
    expect(compareFacts(f({ entity: 'Tamsin AB' }), f({ id: 'b', entity: 'Tamsin Ltd', value: 120 }))).toBeNull();
    expect(compareFacts(f({ entity: 'Tamsin Ltd' }), f({ id: 'b', entity: 'Tamsin Limited', value: 120 }))?.class).toBe('CONFIRMED_CONFLICT');
  });
  it('a stated approximation widens the tolerance to 5%, not more', () => {
    expect(compareFacts(f({}), f({ id: 'b', value: 97, qualifier: 'approximately' }))).toBeNull();
    expect(compareFacts(f({}), f({ id: 'b', value: 90, qualifier: 'approximately' }))?.class).toBe('CONFIRMED_CONFLICT');
    expect(compareFacts(f({}), f({ id: 'b', value: 97 }))?.class).toBe('CONFIRMED_CONFLICT');
  });
  it('currency unit words', () => {
    expect(normalizeUnit('USD million')).toMatchObject({ unit: 'USD_M', factor: 1 });
    expect(normalizeUnit('EUR m')).toMatchObject({ unit: 'EUR_M', factor: 1 });
    expect(normalizeUnit('SEK thousand')).toMatchObject({ unit: 'SEK_M', factor: 1e-3 });
    expect(normalizeUnit('€bn')).toMatchObject({ unit: 'EUR_M', factor: 1e3 });
    expect(normalizeUnit('$m')).toMatchObject({ unit: 'USD_M', factor: 1 });
    expect(normalizeUnit('days').unit).toBe('DAYS');
  });
  it('veto only where the rules can read the pair', () => {
    expect(deterministicVeto(f({}), f({ id: 'b', value: 100.2 }))).toMatch(/rounding/);
    expect(deterministicVeto(f({}), f({ id: 'b', value: 120, period: 'FY2024' }))).toMatch(/periods/);
    expect(deterministicVeto(f({ version: 'original' }), f({ id: 'b', value: 120, version: 'amendment no. 1' }))).toMatch(/versions/);
    expect(deterministicVeto(f({ entity: 'Acme AB' }), f({ id: 'b', entity: 'Acme GmbH', value: 120 }))).toMatch(/legal/);
    // Blind spots: a different name may be an alias or synonym defined in the text, so no veto.
    expect(deterministicVeto(f({}), f({ id: 'b', entity: 'AHX', value: 120 }))).toBeNull();
    expect(deterministicVeto(f({}), f({ id: 'b', concept: 'net_sales', value: 120 }))).toBeNull();
    expect(deterministicVeto(f({}), f({ id: 'b', value: 120 }))).toBeNull();
  });
  it('version precedence', () => {
    expect(supersedes(f({ version: 'original agreement' }), f({ id: 'b', version: 'amendment no. 1 (supersedes)' }))).toBe('b');
    expect(supersedes(f({ version: 'draft' }), f({ id: 'b', version: 'final' }))).toBeNull();
  });
});

describe('AI-candidate layer', () => {
  const facts = [f({ id: 'D1#s1' }), f({ id: 'D2#s1', value: 100.1 }), f({ id: 'D2#s2', entity: 'AHX', value: 130 })];
  const src = (answer: string) => createAiReader('test', async () => answer);
  it('candidates are capped, marked for review, vetoed where the deterministic layer shows consistency', async () => {
    const r = await combineLayers(facts, src('{"findings":[{"facts":["D1#s1","D2#s1"],"class":"CONFIRMED_CONFLICT"},{"facts":["D1#s1","D2#s2"],"class":"CONFIRMED_CONFLICT"},{"facts":["D1#s1","X"],"class":"CONFIRMED_CONFLICT"}]}').source, { documents: [{ id: 'D1', title: 't', text: 'x' }], spans: [{ id: 'D1#s1', doc: 'D1', start: 0, end: 1, text: 'x' }, { id: 'D2#s1', doc: 'D1', start: 0, end: 1, text: 'x' }, { id: 'D2#s2', doc: 'D1', start: 0, end: 1, text: 'x' }] });
    expect(r.deterministic).toHaveLength(0);
    expect(r.candidates).toEqual([expect.objectContaining({ facts: ['D1#s1', 'D2#s2'], class: 'POTENTIAL_CONFLICT', requiresHumanReview: true })]);
    expect(r.vetoed).toEqual([expect.objectContaining({ facts: ['D1#s1', 'D2#s1'], vetoReason: expect.stringMatching(/rounding/) })]);
  });
  it('parsing drops what does not name known statements', () => {
    const p = parseAiReading('noise {"findings":[{"facts":["a","a"],"class":"CONFIRMED_CONFLICT"},{"facts":["a","b"],"class":"MADE_UP"}],"citations":{"C1":["a","zz"]}}', new Set(['a', 'b']), ['C1']);
    expect(p).toMatchObject({ candidates: [], dropped: 2, citations: { C1: ['a'] }, parseOk: true });
  });
});

describe('case pipeline', () => {
  const text = 'Acme Holdings reports revenue of $100m for FY2025 under the original agreement. Acme Holdings reports revenue of $90m for FY2025 under the amendment (supersedes).';
  const input = {
    id: 'demo', question: 'q', tenant: 't1',
    documents: [{ id: 'D1', title: 'Doc', text }],
    spans: [{ id: 'D1#s1', doc: 'D1', start: 0, end: 80, text: text.slice(0, 80) }, { id: 'D1#s2', doc: 'D1', start: 81, end: text.length, text: text.slice(81) }],
    facts: [f({ id: 'D1#s1', version: 'original agreement' }), f({ id: 'D1#s2', value: 90, version: 'amendment (supersedes)' })],
    conclusions: [{ id: 'C1', text: 'Revenue supports approval' }],
  };
  it('builds a graph that passes the integrity checker, replaces superseded evidence and seals deterministically', async () => {
    const reader = () => createAiReader('test', async () => '{"findings":[],"citations":{"C1":["D1#s1"]},"dependencies":{"C1":["D1#s1"]}}');
    const r = await runCasePipeline(input, { reader: reader() });
    expect(r.integrity.findings.filter((x) => x.severity === 'error')).toEqual([]);
    expect(r.dependencies.C1).toEqual(['D1#s2']);
    expect(r.citations.C1).toEqual(['D1#s2']);
    expect((await runCasePipeline(input, { reader: reader() })).sha256).toBe(r.sha256);
    expect(r.sdep.nodes.every((n) => n.tenant === 't1')).toBe(true);
  });
  it('without an AI layer: no call, conclusions unlinked and reported as resting on no evidence', async () => {
    const r = await runCasePipeline(input);
    expect(r.ai.used).toBe(false);
    expect(r.integrity.findings.map((x) => x.code)).toContain('MISSING_EVIDENCE');
  });
});

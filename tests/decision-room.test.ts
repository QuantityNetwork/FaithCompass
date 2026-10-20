/**
 * Decision Room acceptance tests (Master Prompt 4, tests F, G, H, I).
 * F: Decision Twin is deterministic and only dependents change.
 * G: Adversarial Chamber recomputes when a premise is rejected, with an audit trace.
 * H: Contradiction classes, including a reporting-basis difference that is not a conflict.
 * I: A Decision Passport reproduces identically from its ID, in every export.
 */
import { describe, expect, it } from 'vitest';
import { CASE, DOCUMENTS, documentHash, sourceInventory } from '@/lib/decision/case';
import { canonicalJson } from '@/lib/decision/canonical';
import { chamber } from '@/lib/decision/chamber';
import { CONTRADICTIONS, CONTRADICTION_CLASSES, contradictionsView, isConflict } from '@/lib/decision/contradictions';
import {
  CONTROLS,
  DEFAULT_ASSUMPTIONS,
  GRAPH,
  NODE_IDS,
  assumptionsQuery,
  dependentsOf,
  evaluate,
  fingerprint,
  parseAssumptions,
  traceFromDefaults,
  type Assumptions,
} from '@/lib/decision/engine';
import { PassportIdError, REVIEWER_NONE, buildPassport, decodePassportId, encodePassportId, passportMarkdown, verifyPassport } from '@/lib/decision/passport';
import { caseHandler, contradictionsHandler, scenarioHandler, verifyHandler } from '@/lib/decision/api';
import { openApiDocument } from '@/lib/api/v1';

const T = new Date('2026-10-20T16:00:00.000Z');
const with_ = (p: Partial<Assumptions>): Assumptions => ({ ...DEFAULT_ASSUMPTIONS, ...p });

describe('synthetic case', () => {
  it('has ten documents with stable IDs and reproducible content hashes', () => {
    expect(DOCUMENTS.map((d) => d.id)).toEqual(['DOC-01', 'DOC-02', 'DOC-03', 'DOC-04', 'DOC-05', 'DOC-06', 'DOC-07', 'DOC-08', 'DOC-09', 'DOC-10']);
    for (const d of DOCUMENTS) expect(documentHash(d)).toMatch(/^[0-9a-f]{64}$/);
    expect(sourceInventory()).toEqual(sourceInventory());
    expect(new Set(DOCUMENTS.map(documentHash)).size).toBe(10);
  });
  it('is labelled synthetic and never asks the engine to approve', () => {
    expect(CASE.label).toMatch(/synthetic/i);
    expect(evaluate(DEFAULT_ASSUMPTIONS).conclusion.display).toMatch(/No approval is made here/);
  });
});

describe('F: Decision Twin calculations', () => {
  const ev = evaluate(DEFAULT_ASSUMPTIONS);
  it('computes the documented formulas from the case defaults', () => {
    // Revenue 260 × 1.12 = 291.2; EBITDA × 17.5% = 50.96; Debt/EBITDA 124 / 50.96; coverage 50.96 / 10.5
    expect(ev['m.revenue'].value).toBeCloseTo(291.2, 4);
    expect(ev['m.ebitda'].value).toBeCloseTo(50.96, 4);
    expect(ev['m.leverage'].value).toBeCloseTo(124 / 50.96, 4);
    expect(ev['m.coverage'].value).toBeCloseTo(50.96 / 10.5, 4);
    expect(ev['m.liquidityHeadroom'].value).toBe(25);
    expect(ev['m.covenantHeadroom'].value).toBeCloseTo(((3.5 - 124 / 50.96) / 3.5) * 100, 2);
    expect(ev['m.stressLeverage'].value).toBeCloseTo(124 / (50.96 * 0.8), 4);
    for (const n of Object.values(ev).filter((x) => x.kind === 'metric')) expect(n.formula, n.id).toBeTruthy();
  });
  it('is deterministic: the same inputs give byte-identical output', () => {
    expect(canonicalJson(evaluate(DEFAULT_ASSUMPTIONS))).toBe(canonicalJson(evaluate({ ...DEFAULT_ASSUMPTIONS })));
  });
  it('reports conditions as met / not met / needs judgment / evidence missing, never an approval', () => {
    const statuses = Object.values(ev).filter((n) => n.kind === 'condition').map((n) => n.status);
    expect(new Set(statuses)).toEqual(new Set(['MET', 'NOT_MET', 'NEEDS_HUMAN_JUDGMENT', 'EVIDENCE_MISSING']));
    expect(JSON.stringify(ev)).not.toMatch(/\bapproved\b|APPROVE/);
  });

  // For each control: change it, and check that every node outside its dependents is unchanged.
  const changes: Array<[string, Partial<Assumptions>]> = [
    ['in.growth', { growth: 3 }],
    ['in.margin', { margin: 12 }],
    ['in.debt', { debt: 160 }],
    ['in.interest', { interest: 20 }],
    ['in.covMax', { covMax: 2.5 }],
    ['in.minLiq', { minLiq: 40 }],
    ['in.concentration', { concentration: 40 }],
    ['in.verified', { verified: ['DOC-01', 'DOC-03', 'DOC-05'] }],
    ['prem.P3', { rejected: ['P3'] }],
  ];
  it.each(changes)('changing %s changes only its dependents', (input, change) => {
    const base = evaluate(DEFAULT_ASSUMPTIONS);
    const cur = evaluate(with_(change));
    const allowed = new Set([input, ...dependentsOf([input])]);
    const changed = NODE_IDS.filter((id) => fingerprint(base[id]) !== fingerprint(cur[id]));
    expect(changed.length).toBeGreaterThan(1);
    for (const id of changed) expect(allowed.has(id), `${id} changed but does not depend on ${input}`).toBe(true);
  });
  it('leaves liquidity untouched by revenue assumptions, and revenue untouched by liquidity', () => {
    const a = evaluate(with_({ growth: -10, margin: 8 }));
    expect(a['m.liquidityHeadroom'].value).toBe(25);
    expect(a['k.liquidity'].status).toBe('MET');
    const b = evaluate(with_({ minLiq: 40 }));
    expect(b['m.revenue'].value).toBe(evaluate(DEFAULT_ASSUMPTIONS)['m.revenue'].value);
    expect(b['k.liquidity'].status).toBe('NOT_MET');
  });
  it('has an acyclic graph whose edges point only to earlier nodes', () => {
    NODE_IDS.forEach((id, i) => {
      for (const d of GRAPH[id]) expect(NODE_IDS.indexOf(d), `${id} -> ${d}`).toBeLessThan(i);
    });
  });
  it('round-trips assumptions through the URL query, and ignores out-of-range values', () => {
    const a = with_({ growth: 6.5, debt: 118, rejected: ['P2'], verified: [] });
    expect(parseAssumptions(Object.fromEntries(new URLSearchParams(assumptionsQuery(a))))).toEqual(parseAssumptions(Object.fromEntries(new URLSearchParams(assumptionsQuery(a)))));
    expect(parseAssumptions(Object.fromEntries(new URLSearchParams(assumptionsQuery(a)))).debt).toBe(118);
    expect(parseAssumptions({ g: '999' }).growth).toBe(DEFAULT_ASSUMPTIONS.growth);
    expect(parseAssumptions({ vset: '1' }).verified).toEqual([]);
    expect(parseAssumptions({ r: ['P1', 'P3'] }).rejected).toEqual(['P1', 'P3']);
    expect(assumptionsQuery(DEFAULT_ASSUMPTIONS)).toBe('');
    for (const c of CONTROLS) expect(DEFAULT_ASSUMPTIONS[c.key]).toBe(c.default);
  });
});

describe('G: Adversarial Chamber and premise rejection', () => {
  it('has three deterministic sides, each argument linked to nodes or documents', () => {
    const args = chamber(evaluate(DEFAULT_ASSUMPTIONS), DEFAULT_ASSUMPTIONS);
    expect(new Set(args.map((a) => a.side))).toEqual(new Set(['SUPPORTING', 'OPPOSING', 'AUDITOR']));
    for (const a of args) expect(a.nodes.length + a.docs.length, a.id).toBeGreaterThan(0);
    expect(canonicalJson(args)).toBe(canonicalJson(chamber(evaluate(DEFAULT_ASSUMPTIONS), DEFAULT_ASSUMPTIONS)));
  });
  it('rejecting P1 and P2 recalculates dependents, flips the stress condition and records the trace', () => {
    const a = with_({ rejected: ['P1', 'P2'] });
    const ev = evaluate(a);
    expect(ev['e.growth'].value).toBe(4);
    expect(ev['e.margin'].value).toBe(16);
    expect(ev['k.stress'].status).toBe('NOT_MET');
    expect(evaluate(DEFAULT_ASSUMPTIONS)['k.stress'].status).toBe('MET');

    const trace = traceFromDefaults(a);
    expect(trace.changes.map((c) => c.input)).toEqual(['prem.P1', 'prem.P2']);
    expect(trace.changes[0]).toMatchObject({ from: 'Accepted', to: 'Rejected' });
    expect(trace.affected).toEqual(expect.arrayContaining(['m.ebitda', 'm.leverage', 'k.stress', 'conclusion']));
    for (const id of trace.affected) expect(trace.dependents).toContain(id);
    expect(trace.affected).not.toContain('m.liquidityHeadroom');
    expect(trace.affected).not.toContain('k.concentration');

    const sides = chamber(ev, a);
    expect(sides.find((x) => x.id === 'O-prem.P1')).toBeDefined();
    expect(sides.find((x) => x.id === 'S-prem.P1')).toBeUndefined();
    expect(sides.find((x) => x.id === 'O-k.stress')).toBeDefined();
  });
  it('flags unverified key documents in the auditor, and stops when they are verified', () => {
    const unverified = chamber(evaluate(DEFAULT_ASSUMPTIONS), DEFAULT_ASSUMPTIONS).filter((x) => x.rule === 'unverified-document');
    expect(unverified.map((x) => x.docs[0])).toEqual(['DOC-03', 'DOC-05']);
    const a = with_({ verified: ['DOC-01', 'DOC-03', 'DOC-05', 'DOC-10'] });
    expect(chamber(evaluate(a), a).filter((x) => x.rule === 'unverified-document')).toHaveLength(0);
  });
});

describe('H: Contradiction Map', () => {
  it('uses each of the five classes', () => {
    expect(new Set(CONTRADICTIONS.map((c) => c.class))).toEqual(new Set(CONTRADICTION_CLASSES));
  });
  it('does not count a different reporting basis as a conflict', () => {
    const basis = contradictionsView().find((c) => c.class === 'DIFFERENT_REPORTING_BASIS')!;
    expect(basis.conflict).toBe(false);
    expect(isConflict('DIFFERENT_REPORTING_BASIS')).toBe(false);
    expect(basis.a.period).not.toBe(basis.b!.period);
    expect(basis.a.basis).not.toBe(basis.b!.basis);
    expect(basis.affects).toEqual([]);
  });
  it('a confirmed conflict compares the same measure, period and basis with different values', () => {
    const c = contradictionsView().find((x) => x.class === 'CONFIRMED_CONFLICT')!;
    expect(c.conflict).toBe(true);
    expect(c.a.label).toBe(c.b!.label);
    expect(c.a.period).toBe(c.b!.period);
    expect(c.a.basis).toBe(c.b!.basis);
    expect(c.a.value).not.toBe(c.b!.value);
  });
  it('every side-by-side reference resolves to a real document field, and affected nodes exist', () => {
    for (const c of contradictionsView()) for (const id of c.affects) expect(NODE_IDS).toContain(id);
  });
});

describe('I: Decision Passport', () => {
  const a = with_({ growth: 8, rejected: ['P3'] });
  const id = encodePassportId(a, T);
  it('reloads identically from its ID with no stored state', () => {
    const p1 = buildPassport(id);
    const p2 = buildPassport(id);
    expect(canonicalJson(p1)).toBe(canonicalJson(p2));
    expect(p1.generated_at).toBe('2026-10-20T16:00:00Z');
    expect(decodePassportId(id).a).toEqual(parseAssumptions(Object.fromEntries(new URLSearchParams(assumptionsQuery(a)))));
  });
  it('carries every required field, the simulated reviewer, versions and the integrity hash', () => {
    const p = buildPassport(id);
    for (const k of ['id', 'title', 'generated_at', 'case', 'sources', 'claims', 'assumptions', 'scenarios', 'conflicts', 'open_questions', 'calculations', 'reviewer', 'status', 'versions', 'reproducibility', 'audit_history', 'integrity']) {
      expect(p, k).toHaveProperty(k);
    }
    expect(p.reviewer).toBe(REVIEWER_NONE);
    expect(p.reviewer).toBe('none (simulated decision)');
    expect(p.status).toMatch(/SIMULATED/);
    expect(p.integrity_note).toMatch(/not .*correct/);
    expect(p.sources).toHaveLength(10);
    expect(p.audit_history.map((h) => h.event)).toEqual(['passport_generated', 'input_changed', 'input_changed', 'conclusions_affected']);
    const { integrity, ...content } = p;
    expect(integrity.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyPassport(id, integrity.sha256).valid).toBe(true);
    expect(canonicalJson(content)).toContain(p.id);
  });
  it('exports JSON and Markdown that carry the same ID and hash', () => {
    const p = buildPassport(id);
    const json = JSON.parse(JSON.stringify(p));
    expect(json.integrity.sha256).toBe(p.integrity.sha256);
    const md = passportMarkdown(p);
    expect(md).toContain(p.id);
    expect(md).toContain(p.integrity.sha256);
    expect(md).toContain('none (simulated decision)');
  });
  it('detects a changed hash and rejects forged or non-canonical IDs', () => {
    expect(verifyPassport(id, '0'.repeat(64)).valid).toBe(false);
    expect(() => decodePassportId('DP1-not-base64-json')).toThrow(PassportIdError);
    expect(() => decodePassportId('XX-' + id.slice(4))).toThrow(PassportIdError);
    const tampered = JSON.parse(Buffer.from(id.slice(4), 'base64url').toString());
    tampered.a.growth = 99;
    expect(() => decodePassportId('DP1-' + Buffer.from(JSON.stringify(tampered)).toString('base64url'))).toThrow(PassportIdError);
    const reordered = { ...tampered, a: { ...tampered.a, growth: 8, rejected: ['P3'], verified: ['DOC-10', 'DOC-01'] } };
    expect(() => decodePassportId('DP1-' + Buffer.from(JSON.stringify(reordered)).toString('base64url'))).toThrow(PassportIdError);
  });
  it('a different input gives a different passport and hash', () => {
    expect(buildPassport(encodePassportId(with_({ growth: 9, rejected: ['P3'] }), T)).integrity.sha256).not.toBe(buildPassport(id).integrity.sha256);
  });
});

describe('demonstration API', () => {
  const get = (h: (r: Request) => Promise<Response>, url: string) => h(new Request(`http://localhost${url}`));
  it('serves the case, scenarios and contradictions read-only', async () => {
    const c = await get(caseHandler, '/api/institutional/decision-room/case');
    expect(c.status).toBe(200);
    expect((await c.json()).documents).toHaveLength(10);
    const s = await get(scenarioHandler, '/api/institutional/decision-room/scenario?r=P1,P2');
    const body = await s.json();
    expect(s.status).toBe(200);
    expect(body.nodes.find((n: { id: string }) => n.id === 'k.stress').status).toBe('NOT_MET');
    expect(body.trace.changes).toHaveLength(2);
    const x = await (await get(contradictionsHandler, '/api/institutional/decision-room/contradictions')).json();
    expect(x.contradictions).toHaveLength(5);
  });
  it('answers 400 for unknown parameters and out-of-range values instead of guessing', async () => {
    expect((await get(scenarioHandler, '/api/institutional/decision-room/scenario?g=999')).status).toBe(400);
    expect((await get(scenarioHandler, '/api/institutional/decision-room/scenario?approve=1')).status).toBe(400);
    expect((await get(scenarioHandler, '/api/institutional/decision-room/scenario?r=P9')).status).toBe(400);
  });
  it('verifies passports', async () => {
    const id = encodePassportId(DEFAULT_ASSUMPTIONS, T);
    const hash = buildPassport(id).integrity.sha256;
    const ok = await (await get(verifyHandler, `/api/institutional/decision-room/passport/verify?id=${id}&sha256=${hash}`)).json();
    expect(ok.valid).toBe(true);
    const bad = await (await get(verifyHandler, `/api/institutional/decision-room/passport/verify?id=${id}&sha256=${'a'.repeat(64)}`)).json();
    expect(bad.valid).toBe(false);
    expect((await get(verifyHandler, `/api/institutional/decision-room/passport/verify?id=DP1-x&sha256=${hash}`)).status).toBe(404);
  });
  it('is described in OpenAPI under its own tag', () => {
    const doc = openApiDocument() as unknown as { paths: Record<string, { get?: { tags: string[] } }> };
    const demo = Object.entries(doc.paths).filter(([p]) => p.startsWith('/api/institutional/'));
    expect(demo.map(([p]) => p).sort()).toEqual([
      '/api/institutional/decision-room/case',
      '/api/institutional/decision-room/contradictions',
      '/api/institutional/decision-room/passport/verify',
      '/api/institutional/decision-room/scenario',
    ]);
    for (const [, op] of demo) expect(op.get!.tags).toEqual(['institutional-demo']);
  });
});

import { describe, expect, it } from 'vitest';
import { decisionTwinSdep, controlField } from '@/lib/evidence-graph/decision-twin';
import { answerCoverage, checkIntegrity, conclusionsDependingOn, dependenciesOf, parseSdep, rootSources, sdepDigest } from '@/lib/evidence-graph/integrity';
import { EDGE_RULES, EDGE_TYPES, NODE_KINDS, SDEP_QUESTIONS, type SdepDocument, type SdepNode } from '@/lib/evidence-graph/schema';
import { CONTROLS } from '@/lib/decision/engines/v1/engine';
import { CONTRADICTIONS } from '@/lib/decision/engines/v1/contradictions';
import { DOCUMENTS } from '@/lib/decision/engines/v1/case';
import { ENGINES } from '@/lib/decision/engines';

const base = decisionTwinSdep();
const clone = (): SdepDocument => structuredClone(base);
const node = (d: SdepDocument, id: string) => d.nodes.find((n) => n.id === id)!;
const codes = (d: unknown) => checkIntegrity(d).findings.map((f) => f.code);
const errors = (d: unknown) => checkIntegrity(d).findings.filter((f) => f.severity === 'error').map((f) => f.code);

describe('SDEP schema', () => {
  it('every edge type has a rule over known node kinds', () => {
    for (const t of EDGE_TYPES) {
      const r = EDGE_RULES[t];
      for (const k of [...r.from, ...r.to]) expect(NODE_KINDS).toContain(k);
    }
    expect(SDEP_QUESTIONS).toHaveLength(14);
  });

  it('rejects an unsupported protocol version before reading anything else', () => {
    const d = { ...clone(), version: '9.0.0' };
    const r = checkIntegrity(d);
    expect(r.ok).toBe(false);
    expect(r.sha256).toBeNull();
    expect(r.findings.map((f) => f.code)).toEqual(['UNSUPPORTED_VERSION']);
  });

  it('rejects malformed documents (unknown kind, unknown field, inverted char locator)', () => {
    const a = clone();
    (a.nodes[0] as { kind: string }).kind = 'Opinion';
    expect(errors(a)).toContain('SCHEMA_INVALID');
    const b = clone();
    (b.nodes[0] as Record<string, unknown>).confidence = 0.9;
    expect(errors(b)).toContain('SCHEMA_INVALID');
    const c = clone();
    node(c, 'span:DOC-03#total_debt').provenance!.locator = { type: 'chars', start: 10, end: 4 };
    expect(errors(c)).toContain('SCHEMA_INVALID');
    expect(parseSdep(null).ok).toBe(false);
  });
});

describe('Decision Twin as SDEP (adapter over the frozen engine, no duplication)', () => {
  it('is a valid SDEP document with no findings', () => {
    const r = checkIntegrity(base);
    expect(r.findings).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.sha256).toBe(sdepDigest(base));
  });

  it('is deterministic and cites the frozen engine', () => {
    expect(sdepDigest(decisionTwinSdep())).toBe(sdepDigest(base));
    expect(base.software.engine).toEqual({ version: ENGINES['1.0.0'].version, sha256: ENGINES['1.0.0'].sha256 });
    expect(base.software.model).toBeNull();
  });

  it('anchors every control to exactly one field of its source document', () => {
    for (const c of CONTROLS) expect(controlField(c.source, c.default), c.key).toHaveLength(1);
  });

  it('carries every document field and every contradiction', () => {
    const spans = base.nodes.filter((n) => n.kind === 'EvidenceSpan');
    expect(spans).toHaveLength(DOCUMENTS.reduce((s, d) => s + d.fields.length, 0));
    expect(base.nodes.filter((n) => n.kind === 'Contradiction')).toHaveLength(CONTRADICTIONS.length);
    expect(base.nodes.some((n) => n.kind === 'HumanAttestation')).toBe(false);
  });

  it('isolates impact: a debt figure reaches the leverage conclusion, an unrelated field does not', () => {
    const debt = conclusionsDependingOn(base, 'span:DOC-03#total_debt');
    expect(debt.conclusions).toEqual(['dt:conclusion']);
    expect(debt.conditions).toEqual(expect.arrayContaining(['dt:k.leverage', 'dt:k.stress', 'dt:k.debtReconciled']));
    expect(debt.conditions).not.toContain('dt:k.concentration');
    // The customer share feeds revenue (engine node m.revenue), so it legitimately reaches leverage too.
    expect(conclusionsDependingOn(base, 'span:DOC-07#top_customer_share').conditions).toEqual(expect.arrayContaining(['dt:k.concentration', 'dt:k.leverage']));
    const liq = conclusionsDependingOn(base, 'span:DOC-05#min_liquidity');
    expect(liq.conditions).toContain('dt:k.liquidity');
    expect(liq.conditions).not.toContain('dt:k.leverage');
    expect(liq.conditions).not.toContain('dt:k.debtReconciled');
  });

  it('graph-derived impact covers what the Contradiction Map declares as affected', () => {
    const x = CONTRADICTIONS.find((c) => c.affects.includes('k.leverage'))!;
    const impact = conclusionsDependingOn(base, `span:${x.a.doc}#${x.a.field}`);
    for (const id of x.affects.filter((a) => a.startsWith('k.'))) expect(impact.conditions).toContain(`dt:${id}`);
  });

  it('traces a conclusion back to source documents', () => {
    expect(rootSources(base, 'dt:conclusion')).toEqual(expect.arrayContaining(['doc:DOC-03', 'doc:DOC-05']));
    expect(dependenciesOf(base, 'dt:conclusion')).toContain('span:DOC-03#total_debt');
  });

  it('reports which of the 14 questions it answers, without filling the gaps', () => {
    const cov = answerCoverage(base);
    expect(cov).toHaveLength(14);
    const answered = Object.fromEntries(cov.map((q) => [q.id, q.answered]));
    expect(answered.Q10).toBe(false); // who authorized: no attestation exists
    expect(answered.Q12).toBe(true); // software + rules
  });
});

describe('integrity checks (one mutation each)', () => {
  it('missing evidence: a MET condition and the conclusion cut off from all evidence', () => {
    const d = clone();
    d.edges = d.edges.filter((e) => e.from !== 'dt:conclusion');
    expect(errors(d)).toContain('MISSING_EVIDENCE');
    const v = clone();
    v.nodes.push({ id: 'claim:x', kind: 'VerifiedClaim', label: 'Unsupported', tenant: null });
    expect(errors(v)).toContain('MISSING_EVIDENCE');
  });

  it('duplicate evidence and duplicate ids', () => {
    const d = clone();
    const s = node(d, 'span:DOC-03#total_debt');
    d.nodes.push({ ...structuredClone(s), id: 'span:copy' });
    d.edges.push({ from: 'span:copy', to: 'ver:DOC-03@1.0.0', type: 'Quotes' });
    expect(codes(d)).toContain('DUPLICATE_EVIDENCE');
    const e = clone();
    e.nodes.push(structuredClone(e.nodes[0]));
    expect(errors(e)).toContain('DUPLICATE_NODE_ID');
  });

  it('shared ancestry: two supports from one document are not corroboration', () => {
    const d = clone();
    d.nodes.push({ id: 'claim:debt', kind: 'ExtractedClaim', label: 'Debt is as stated', tenant: null });
    d.edges.push({ from: 'span:DOC-03#total_debt', to: 'claim:debt', type: 'Supports' }, { from: 'span:DOC-03#interest_expense', to: 'claim:debt', type: 'Supports' });
    expect(codes(d)).toContain('SHARED_ANCESTRY');
    const ind = clone();
    ind.nodes.push({ id: 'claim:debt', kind: 'ExtractedClaim', label: 'Debt is as stated', tenant: null });
    ind.edges.push({ from: 'span:DOC-03#total_debt', to: 'claim:debt', type: 'Supports' }, { from: 'span:DOC-05#max_leverage', to: 'claim:debt', type: 'Supports' });
    expect(codes(ind)).not.toContain('SHARED_ANCESTRY');
  });

  it('contradictory fields: removing a recorded contradiction surfaces it', () => {
    const debtX = CONTRADICTIONS.find((c) => c.a.field === 'total_debt' && c.b?.field === 'total_debt')!;
    const d = clone();
    d.nodes = d.nodes.filter((n) => n.id !== `contradiction:${debtX.id}`);
    d.edges = d.edges.filter((e) => e.from !== `contradiction:${debtX.id}`);
    expect(errors(d)).toContain('UNRECORDED_CONTRADICTION');
    const t = clone();
    t.edges = t.edges.filter((e) => e.from !== `contradiction:${debtX.id}`);
    expect(errors(t)).toContain('CONTRADICTION_WITHOUT_TARGETS');
  });

  it('version mismatch: a span taken from different content than the version it quotes', () => {
    const d = clone();
    node(d, 'span:DOC-03#total_debt').sourceSha256 = 'f'.repeat(64);
    expect(errors(d)).toContain('VERSION_MISMATCH');
    const u = clone();
    u.edges = u.edges.filter((e) => !(e.from === 'span:DOC-03#total_debt' && e.type === 'Quotes'));
    expect(errors(u)).toContain('UNANCHORED_EVIDENCE');
    const w = clone();
    w.edges = w.edges.filter((e) => !(e.from === 'ver:DOC-03@1.0.0' && e.type === 'DerivedFrom'));
    expect(errors(w)).toContain('VERSION_WITHOUT_DOCUMENT');
  });

  it('dependency cycles and self-edges', () => {
    const d = clone();
    d.edges.push({ from: 'dt:in.debt', to: 'dt:conclusion', type: 'DependsOn' });
    const r = checkIntegrity(d);
    expect(r.findings.map((f) => f.code)).toContain('DEPENDENCY_CYCLE');
    const s = clone();
    s.edges.push({ from: 'dt:conclusion', to: 'dt:conclusion', type: 'DependsOn' });
    expect(errors(s)).toContain('SELF_EDGE');
  });

  it('broken references and disallowed edge kinds', () => {
    const d = clone();
    d.edges.push({ from: 'dt:conclusion', to: 'span:nowhere', type: 'DependsOn' });
    expect(errors(d)).toContain('BROKEN_REF');
    const k = clone();
    k.edges.push({ from: 'doc:DOC-01', to: 'dt:conclusion', type: 'Quotes' });
    expect(errors(k)).toContain('EDGE_KIND_NOT_ALLOWED');
  });

  it('cross-tenant and private-in-public dependencies', () => {
    const d = clone();
    const priv: SdepNode = { ...structuredClone(node(d, 'span:DOC-03#total_debt')), id: 'span:private', tenant: 'tenant-a' };
    d.nodes.push(priv, { id: 'calc:b', kind: 'Calculation', label: 'Tenant B calc', tenant: 'tenant-b', formula: 'x' });
    d.edges.push({ from: 'calc:b', to: 'span:private', type: 'ComputedUsing' }, { from: 'dt:conclusion', to: 'span:private', type: 'DependsOn' });
    const c = codes(d);
    expect(c).toContain('CROSS_TENANT_EDGE');
    expect(c).toContain('PRIVATE_DEPENDENCY_IN_PUBLIC_NODE');
  });

  it('required fields per kind, and superseded evidence still in use', () => {
    const d = clone();
    delete node(d, 'dt:m.leverage').formula;
    expect(errors(d)).toContain('MISSING_FIELD');
    const s = clone();
    s.nodes.push({ ...structuredClone(node(s, 'span:DOC-03#total_debt')), id: 'span:DOC-03#total_debt@2' });
    s.edges.push({ from: 'span:DOC-03#total_debt@2', to: 'ver:DOC-03@1.0.0', type: 'Quotes' }, { from: 'span:DOC-03#total_debt@2', to: 'span:DOC-03#total_debt', type: 'Supersedes' });
    expect(codes(s)).toContain('SUPERSEDED_IN_USE');
  });
});

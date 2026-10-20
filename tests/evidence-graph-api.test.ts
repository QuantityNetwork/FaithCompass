import { describe, expect, it } from 'vitest';
import { dispatchV1 } from '@/lib/api/v1';
import { handleMessage } from '@/lib/mcp/server';
import { dependencyPaths } from '@/lib/evidence-graph/integrity';
import { decisionTwinSdep } from '@/lib/evidence-graph/decision-twin';

const get = async (path: string) => {
  const [p, q] = path.split('?');
  const res = await dispatchV1(new Request(`https://example.test/api/v1/${path}`, { headers: { 'x-forwarded-for': `t-${Math.random()}` } }), p);
  void q;
  return { status: res.status, body: (await res.json()) as Record<string, any> };
};

describe('evidence graph REST v1', () => {
  it('GET /evidence-graph returns the SDEP document with a clean integrity report', async () => {
    const r = await get('evidence-graph');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ object: 'evidence_graph', counts: { nodes: 103, edges: 166 }, integrity: { ok: true, findings: [] } });
    expect(r.body.passages).toContain('span:DOC-03#total_debt');
  });

  it('GET /evidence-graph/impact: every conclusion depending on a passage, with paths', async () => {
    const r = await get('evidence-graph/impact?passage=span%3ADOC-03%23total_debt&paths=3');
    expect(r.status).toBe(200);
    expect(r.body.conclusions.map((c: any) => c.id)).toEqual(['dt:conclusion']);
    const leverage = r.body.conditions.find((c: any) => c.id === 'dt:k.leverage');
    expect(leverage.paths[0].map((s: any) => s.node)).toEqual(['span:DOC-03#total_debt', 'dt:in.debt', 'dt:m.leverage', 'dt:k.leverage']);
    expect(leverage.paths[0].map((s: any) => s.via)).toEqual([null, 'DerivedFrom', 'UsesAssumption', 'DependsOn']);
    expect(leverage.total).toBeGreaterThanOrEqual(1);
    expect(r.body.conclusions[0].paths.length).toBeLessThanOrEqual(3);
  });

  it('unknown passage is a 404; a bad paths value is a 400', async () => {
    expect((await get('evidence-graph/impact?passage=span%3Anowhere')).status).toBe(404);
    expect((await get('evidence-graph/impact?passage=span%3ADOC-03%23total_debt&paths=999')).status).toBe(400);
  });

  it('path counting agrees with enumeration when all paths fit', () => {
    const doc = decisionTwinSdep();
    const r = dependencyPaths(doc, 'span:DOC-03#total_debt', 'dt:conclusion', 1000);
    expect(r.paths).toHaveLength(r.total);
    expect(new Set(r.paths.map((p) => p.map((s) => s.node).join('>'))).size).toBe(r.total);
    for (const p of r.paths) expect(p[p.length - 1].node).toBe('dt:conclusion');
  });
});

describe('MCP tool evidence_impact', () => {
  it('answers the same query', async () => {
    const res = (await handleMessage({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'evidence_impact', arguments: { passage: 'span:DOC-05#min_liquidity' } } })) as any;
    const out = res.result.structuredContent ?? JSON.parse(res.result.content[0].text);
    expect(out.conditions.map((c: any) => c.id)).toContain('dt:k.liquidity');
    expect(out.conditions.map((c: any) => c.id)).not.toContain('dt:k.leverage');
  });
});

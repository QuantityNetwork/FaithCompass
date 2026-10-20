/** The published developer contract must match what the server does. */
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { openApiDocument } from '@/lib/api/v1';
import { EVIDENCE_ENDPOINTS } from '@/lib/api/evidence-openapi';
import { AnalyzeBodySchema, ChallengeBodySchema, DecisionBodySchema } from '@/lib/evidence/write-api';
import { GET as v1Get, HEAD as v1Head } from '@/app/api/v1/[[...path]]/route';
import { HEAD as legacyHead } from '@/app/api/public/[...path]/route';

type Op = {
  requestBody?: {
    content: {
      'application/json': {
        schema: {
          properties: Record<string, unknown>;
          additionalProperties: boolean;
        };
      };
    };
  };
  responses: Record<string, unknown>;
};

const doc = openApiDocument() as unknown as {
  paths: Record<string, Record<string, Op>>;
  tags: Array<{ name: string }>;
};

describe('OpenAPI: Evidence Intelligence endpoints', () => {
  it('documents every evidence route, and every documented route exists', () => {
    for (const e of EVIDENCE_ENDPOINTS) {
      expect(doc.paths[e.path]?.[e.method.toLowerCase()], e.path).toBeDefined();
      const dir = e.path.replace(/^\/api/, 'src/app/api').replace(/\{(\w+)\}/g, '[$1]');
      expect(existsSync(`${dir}/route.ts`), dir).toBe(true);
    }
    expect(doc.tags.map((t) => t.name)).toContain('evidence');
  });

  it('states the honest outcomes: drafts and proposals 202, no database 503, anonymous decide 401', () => {
    const r = (p: string) => Object.keys(doc.paths[p].post.responses);
    expect(r('/api/evidence/ask')).toEqual(['200', '400']);
    expect(r('/api/evidence/analyze')).toEqual(expect.arrayContaining(['202', '503', '415', '403']));
    expect(r('/api/evidence/claims/{id}/challenge')).toEqual(expect.arrayContaining(['202', '503', '409']));
    expect(r('/api/evidence/proposals/{id}/decision')).toEqual(expect.arrayContaining(['401', '403', '409']));
  });

  it('publishes request bodies with the same fields the routes enforce, and no extra fields allowed', () => {
    const body = (p: string) => doc.paths[p].post.requestBody!.content['application/json'].schema;
    for (const [p, schema] of [
      ['/api/evidence/analyze', AnalyzeBodySchema],
      ['/api/evidence/claims/{id}/challenge', ChallengeBodySchema],
      ['/api/evidence/proposals/{id}/decision', DecisionBodySchema],
    ] as const) {
      expect(Object.keys(body(p).properties).sort(), p).toEqual(Object.keys(schema.shape).sort());
      expect(body(p).additionalProperties).toBe(false);
      expect(
        schema.safeParse({
          ...(p.endsWith('decision')
            ? { decision: 'approve', reason: 'long enough reason' }
            : p.endsWith('analyze')
              ? { query: 'x' }
              : {}),
          role: 'editorial_admin',
        }).success,
      ).toBe(false);
    }
  });
});

describe('HEAD on the APIs', () => {
  const ctx = (path: string[]) => ({ params: Promise.resolve({ path }) });
  it('answers HEAD like GET, without a body', async () => {
    const url = 'http://localhost/api/v1/claims/AM-CLAIM-000184';
    const get = await v1Get(new Request(url), ctx(['claims', 'AM-CLAIM-000184']));
    const head = await v1Head(new Request(url, { method: 'HEAD' }), ctx(['claims', 'AM-CLAIM-000184']));
    expect(head.status).toBe(200);
    expect(head.headers.get('etag')).toBe(get.headers.get('etag'));
    expect(await head.text()).toBe('');
    const legacy = await legacyHead(
      new Request('http://localhost/api/public/claims', { method: 'HEAD' }),
      ctx(['claims']),
    );
    expect(legacy.status).toBe(200);
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetRateLimits } from '@/lib/api/http';
import { dispatchLegacy } from '@/lib/api/legacy';
import { ENDPOINTS_V1, dispatchV1, openApiDocument } from '@/lib/api/v1';
import { ErrorV1 } from '@/lib/api/views';
import { getRecord } from '@/lib/record/record';
import { canonicalOrigin, canonicalOriginSource } from '@/lib/site/config';

const ORIGIN = 'https://am.example.test';
const fixture = (name: string) => JSON.parse(readFileSync(join(__dirname, 'fixtures/live', name), 'utf8'));

function req(path: string, init: RequestInit = {}) {
  return new Request(`${ORIGIN}${path}`, { ...init, headers: { 'x-forwarded-for': `test-${Math.random()}`, ...(init.headers ?? {}) } });
}

async function v1(path: string, init: RequestInit = {}) {
  const [p] = path.split('?');
  const res = await dispatchV1(req(`/api/v1${path}`, init), p);
  const text = await res.text();
  return { res, body: text ? JSON.parse(text) : null };
}

async function legacy(path: string, init: RequestInit = {}) {
  const [p] = path.split('?');
  const res = await dispatchLegacy(req(`/api/public/${path}`, init), p);
  const text = await res.text();
  return { res, body: text ? JSON.parse(text) : null };
}

beforeEach(() => {
  process.env.ABRAHAMMOSES_PUBLIC_ORIGIN = ORIGIN;
  resetRateLimits();
});
afterEach(() => {
  delete process.env.ABRAHAMMOSES_PUBLIC_ORIGIN;
  delete process.env.API_RATE_LIMIT_PER_MINUTE;
});

describe('REST v1 — contract', () => {
  it('serves every documented endpoint, and every response matches its published schema', async () => {
    for (const e of ENDPOINTS_V1) {
      const init: RequestInit =
        e.method === 'POST'
          ? { method: 'POST', body: JSON.stringify({ reject_axioms: ['AM-AX-002'] }), headers: { 'content-type': 'application/json' } }
          : {};
      const { res, body } = await v1(e.example, init);
      expect(res.status, `${e.method} ${e.example}`).toBe(200);
      const parsed = e.response.schema.safeParse(body);
      expect(parsed.success, `${e.name}: ${parsed.success ? '' : JSON.stringify(parsed.error.issues.slice(0, 3))}`).toBe(true);
    }
  });

  it('documents every endpoint in the OpenAPI document', () => {
    const doc = openApiDocument();
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.servers[0].url).toBe(ORIGIN);
    for (const e of ENDPOINTS_V1) {
      const path = `/api/v1${e.path === '/' ? '' : e.path}`;
      expect(doc.paths[path]?.[e.method.toLowerCase()], `${e.method} ${path}`).toBeDefined();
    }
  });

  it('returns the full §5A metadata for a claim', async () => {
    const { body } = await v1('/claims/AM-CLAIM-000191');
    expect(body.code).toBe('AM-CLAIM-000191');
    expect(body.revisions.map((r: { rev: number }) => r.rev)).toEqual([1, 2]);
    expect(body.last_verified_revision).toBe(1);
    expect(body.editions.length).toBeGreaterThan(0);
    expect(Object.keys(body.confidence)).toEqual(['textual', 'philological', 'historical', 'inferential']);
    expect(body.acceptance.length).toBeGreaterThan(5);
    expect(body.counter_models.length).toBeGreaterThan(0);
    expect(body.derivations.map((d: { code: string }) => d.code)).toEqual(['AM-DRV-0006', 'AM-DRV-0007']);
    expect(body.machine_involvement.level).toBe('assisted');
    expect(body.citation.url).toBe(`${ORIGIN}/claims/AM-CLAIM-000191?rev=2`);
  });

  it('serves any revision, so a citation keeps pointing at what was cited', async () => {
    const { body } = await v1('/claims/AM-CLAIM-000191?rev=1');
    expect(body.revision).toBe(1);
    expect(body.status).toBe('published');
    expect(body.confidence).toBeNull();
    const missing = await v1('/claims/AM-CLAIM-000191?rev=9');
    expect(missing.res.status).toBe(404);
  });

  it('generates a provenance chain for every claim, including those published without one', async () => {
    for (const claim of getRecord().data.claims) {
      const { body } = await v1(`/claims/${claim.code}/provenance`);
      expect(body.steps.length, claim.code).toBe(8);
    }
  });

  it('gives the same simulation by GET and by POST', async () => {
    const get = await v1('/simulate?reject_axioms=AM-AX-002,AM-AX-005');
    const post = await v1('/simulate', {
      method: 'POST',
      body: JSON.stringify({ reject_axioms: ['AM-AX-002', 'AM-AX-005'] }),
      headers: { 'content-type': 'application/json' },
    });
    expect(post.body).toEqual(get.body);
    expect(get.body.notice).toMatch(/Nothing in the record has been changed/);
  });
});

describe('REST v1 — errors, headers and limits', () => {
  it('uses one error envelope with stable codes', async () => {
    const cases: Array<[string, RequestInit, number, string]> = [
      ['/claims/AM-CLAIM-999999', {}, 404, 'not_found'],
      ['/claims/not-a-code', {}, 400, 'invalid_parameter'],
      ['/claims?limit=1000', {}, 400, 'invalid_parameter'],
      ['/simulate?reject_axioms=AM-AX-999', {}, 400, 'invalid_parameter'],
      ['/simulate', { method: 'POST', body: '{not json', headers: { 'content-type': 'application/json' } }, 400, 'invalid_json'],
      ['/claims', { method: 'PUT' }, 405, 'method_not_allowed'],
      ['/no-such-endpoint', {}, 404, 'not_found'],
    ];
    for (const [path, init, status, code] of cases) {
      const { res, body } = await v1(path, init);
      expect(res.status, path).toBe(status);
      expect(ErrorV1.safeParse(body).success, path).toBe(true);
      expect(body.error.code, path).toBe(code);
      expect(body.error.docs).toBe(`${ORIGIN}/developers#error-${code}`);
    }
  });

  it('answers CORS preflight and exposes version headers', async () => {
    const pre = await dispatchV1(req('/api/v1/claims', { method: 'OPTIONS' }), 'claims');
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-origin')).toBe('*');
    const { res } = await v1('/claims/AM-CLAIM-000184');
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('x-abrahammoses-api-version')).toBe('1.0');
    expect(res.headers.get('x-record-version')).toBe(getRecord().version);
    expect(res.headers.get('ratelimit-limit')).toBe('120');
  });

  it('supports conditional requests', async () => {
    const first = await dispatchV1(req('/api/v1/claims/AM-CLAIM-000184'), 'claims/AM-CLAIM-000184');
    const etag = first.headers.get('etag')!;
    const second = await dispatchV1(req('/api/v1/claims/AM-CLAIM-000184', { headers: { 'if-none-match': etag } }), 'claims/AM-CLAIM-000184');
    expect(second.status).toBe(304);
  });

  it('rate-limits per client and says when to retry', async () => {
    process.env.API_RATE_LIMIT_PER_MINUTE = '3';
    const make = () => dispatchV1(new Request(`${ORIGIN}/api/v1/claims`, { headers: { 'x-forwarded-for': '203.0.113.9' } }), 'claims');
    for (let i = 0; i < 3; i++) expect((await make()).status).toBe(200);
    const limited = await make();
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
    expect((await limited.json()).error.code).toBe('rate_limited');
  });

  it('documents one host only — the canonical origin', async () => {
    const { body } = await v1('/');
    const text = JSON.stringify(body) + JSON.stringify((await legacy('mcp')).body) + JSON.stringify((await legacy('connect')).body);
    expect(text).toContain(ORIGIN);
    expect(text).not.toContain('abrahammoses.org');
  });

  it('names a Vercel preview by its own URL, never the production domain', () => {
    const saved = { ...process.env };
    try {
      delete process.env.ABRAHAMMOSES_PUBLIC_ORIGIN;
      Object.assign(process.env, {
        VERCEL_PROJECT_PRODUCTION_URL: 'production.example.test',
        VERCEL_URL: 'app-abc123.vercel.app',
        VERCEL_BRANCH_URL: 'app-git-feature.vercel.app',
      });
      process.env.VERCEL_ENV = 'preview';
      expect([canonicalOrigin(), canonicalOriginSource()]).toEqual(['https://app-git-feature.vercel.app', 'vercel-preview']);
      delete process.env.VERCEL_BRANCH_URL;
      expect(canonicalOrigin()).toBe('https://app-abc123.vercel.app');
      process.env.VERCEL_ENV = 'production';
      expect([canonicalOrigin(), canonicalOriginSource()]).toEqual(['https://production.example.test', 'vercel-production']);
      process.env.VERCEL_ENV = 'preview';
      process.env.ABRAHAMMOSES_PUBLIC_ORIGIN = ORIGIN;
      expect([canonicalOrigin(), canonicalOriginSource()]).toEqual([ORIGIN, 'configured']);
    } finally {
      for (const key of ['VERCEL_ENV', 'VERCEL_URL', 'VERCEL_BRANCH_URL', 'VERCEL_PROJECT_PRODUCTION_URL']) {
        if (saved[key] === undefined) delete process.env[key];
        else process.env[key] = saved[key];
      }
    }
  });
});

describe('legacy /api/public — backward compatibility with the published service', () => {
  /** Every key the live service returned is still returned, with the same JSON type. */
  function expectSuperset(ours: unknown, live: unknown, path = '$') {
    if (Array.isArray(live)) {
      expect(Array.isArray(ours), path).toBe(true);
      if (live.length > 0 && (ours as unknown[]).length > 0) expectSuperset((ours as unknown[])[0], live[0], `${path}[0]`);
      return;
    }
    if (live && typeof live === 'object') {
      expect(ours && typeof ours === 'object', path).toBeTruthy();
      for (const key of Object.keys(live)) {
        expect(Object.keys(ours as object), `${path}.${key}`).toContain(key);
        expectSuperset((ours as Record<string, unknown>)[key], (live as Record<string, unknown>)[key], `${path}.${key}`);
      }
      return;
    }
    if (live !== null) expect(typeof ours, path).toBe(typeof live);
  }

  const pairs: Array<[string, string]> = [
    ['claims?limit=3', 'claims.json'],
    ['claims/AM-CLAIM-000184', 'claim_AM-CLAIM-000184.json'],
    ['covenants', 'covenants.json'],
    ['doctrine', 'doctrine.json'],
    ['provenance?claim=AM-CLAIM-000184', 'prov_AM-CLAIM-000184.json'],
    ['dependencies?claim=AM-CLAIM-000191', 'dependencies_191.json'],
    ['dependencies', 'dependencies.json'],
    ['hermeneutics', 'hermeneutics.json'],
    ['hermeneutics?reject=AM-AX-002', 'hermeneutics_reject_AX002.json'],
    ['connect', 'connect.json'],
    ['mcp', 'manifest.json'],
    ['agents', 'agents.json'],
    ['agents?audit=1', 'agents_audit.json'],
  ];

  for (const [path, file] of pairs) {
    it(`GET /api/public/${path} keeps the published shape`, async () => {
      const { res, body } = await legacy(path);
      expect(res.status).toBe(200);
      expectSuperset(body, fixture(file));
    });
  }

  it('returns the published claims unchanged in content', async () => {
    const { body } = await legacy('claims?limit=200');
    for (const live of fixture('claims.json').data as Array<Record<string, unknown>>) {
      const ours = body.data.find((c: { code: string }) => c.code === live.code);
      expect(ours.statement).toBe(live.statement);
      expect(ours.sources).toEqual(live.sources);
      expect(ours.claim_type).toBe(live.claim_type);
    }
  });

  it('accepts MCP JSON-RPC at the published manifest URL', async () => {
    const res = await dispatchLegacy(
      req('/api/public/mcp', {
        method: 'POST',
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      }),
      'mcp',
    );
    expect(res.status).toBe(200);
    expect((await res.json()).result.tools.length).toBeGreaterThan(10);
  });

  it('refuses agent actions without credentials, as the published service did', async () => {
    const { res, body } = await legacy('agent/act', { method: 'POST', body: '{}' });
    expect(res.status).toBe(401);
    expect(body.error.code).toBe('unauthorized');
  });
});

/**
 * Evidence workspaces: document import, the record builder, the passport bundle and its offline verification.
 * The Firestore workflow and rules are tested against the emulator in tests/firestore/workspace.test.ts.
 * Signing tests use a throwaway key pair generated in memory.
 */
import { createHash, generateKeyPairSync } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sha256 } from '@/lib/decision/canonical';
import { ENGINES, engineSourceHash } from '@/lib/decision/engines';
import { signerFrom } from '@/lib/decision/signing';
import { verifyBundle, type PinnedEngine } from '@/lib/passport-bundle/verify';
import { ImportError, htmlToText, parseImport, passagesOf, tenantRoles, MAX_IMPORT_BYTES } from '@/lib/workspace/model';
import { buildWorkspaceBundle, workspaceBundleFileName, WORKSPACE_ENGINE_KEY } from '@/lib/workspace/passport';
import { workspaceFixtures } from '../scripts/workspace-fixtures';
import { SAMPLE_AUDIT, SAMPLE_DECISION, SAMPLE_DOC } from './fixtures/workspace-sample';

const enc = (s: string) => new TextEncoder().encode(s);
const engines: PinnedEngine[] = Object.values(ENGINES).map((e) => ({ version: e.version, sha256: e.sha256 }));
const input = { tenant: 'sample-tenant', decision: SAMPLE_DECISION, documents: [SAMPLE_DOC], audit: SAMPLE_AUDIT };

describe('document import', () => {
  it('hashes the exact bytes received, normalises the text and numbers its passages', () => {
    const bytes = enc('\uFEFFTitle line\r\n\r\nSecond  paragraph.\r\nstill second.\r\n\r\n\r\nThird.');
    const p = parseImport({ filename: 'a.txt', bytes });
    expect(p.fileSha256).toBe(createHash('sha256').update(bytes).digest('hex'));
    expect(p.text).toBe('Title line\n\nSecond  paragraph.\nstill second.\n\nThird.');
    expect(p.textSha256).toBe(sha256(p.text));
    expect(p.passages.map((x) => x.n)).toEqual([1, 2, 3]);
    expect(p.passages[1]).toEqual({ n: 2, text: 'Second  paragraph.\nstill second.', sha256: sha256('Second  paragraph.\nstill second.') });
    expect(p.title).toBe('a');
    expect(p.mediaType).toBe('text/plain');
  });

  it('accepts Markdown, CSV (one passage per row), JSON and HTML (tags and scripts removed)', () => {
    expect(parseImport({ filename: 'x.csv', bytes: enc('a,b\n1,2\n3,4') }).passages.map((p) => p.text)).toEqual(['a,b', '1,2', '3,4']);
    expect(parseImport({ filename: 'x.json', bytes: enc('{"a":1}') }).mediaType).toBe('application/json');
    const h = parseImport({ filename: 'x.html', bytes: enc('<h1>Head</h1><script>alert(1)</script><p>One &amp; two</p><p>Three</p>') });
    expect(h.passages.map((p) => p.text)).toEqual(['Head', 'One & two', 'Three']);
    expect(htmlToText('<style>p{}</style>x')).toBe('x');
  });

  it('refuses unsupported types, invalid UTF-8, invalid JSON, empty and oversized files', () => {
    const err = (f: () => unknown) => {
      try {
        f();
      } catch (e) {
        return e instanceof ImportError ? e.status : -1;
      }
      return 0;
    };
    expect(err(() => parseImport({ filename: 'x.pdf', bytes: enc('%PDF') }))).toBe(415);
    expect(err(() => parseImport({ filename: 'x.txt', bytes: new Uint8Array([0xff, 0xfe, 0xfd]) }))).toBe(415);
    expect(err(() => parseImport({ filename: 'x.json', bytes: enc('{nope') }))).toBe(400);
    expect(err(() => parseImport({ filename: 'x.txt', bytes: new Uint8Array() }))).toBe(400);
    expect(err(() => parseImport({ filename: 'x.txt', bytes: enc('   \n  ') }))).toBe(400);
    expect(err(() => parseImport({ filename: 'x.txt', bytes: new Uint8Array(MAX_IMPORT_BYTES + 1).fill(65) }))).toBe(413);
  });

  it('splits long paragraphs and keeps every passage within the limit', () => {
    const long = Array.from({ length: 200 }, (_, i) => `Sentence number ${i} is here.`).join(' ');
    const ps = passagesOf(long, 'text/plain');
    expect(ps.length).toBeGreaterThan(2);
    expect(ps.every((p) => p.text.length <= 1800)).toBe(true);
    expect(ps.map((p) => p.text).join(' ').replace(/\s+/g, ' ')).toBe(long);
  });
});

describe('workspace roles claim', () => {
  it('keeps only valid tenant ids and the roles member and editor', () => {
    expect(tenantRoles({ 'am-pilot': 'editor', b2: 'member', 'Bad Id': 'editor', c3: 'owner', d4: 1 })).toEqual({ 'am-pilot': 'editor', b2: 'member' });
    expect(tenantRoles(undefined)).toEqual({});
    expect(tenantRoles(['x'])).toEqual({});
  });
});

describe('workspace passport bundle', () => {
  it('pins the source hash of the frozen record builder (any edit to record/v1 fails here)', () => {
    const e = ENGINES[WORKSPACE_ENGINE_KEY];
    const dir = join(process.cwd(), e.source);
    const files = Object.fromEntries(readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => [f, readFileSync(join(dir, f), 'utf8')]));
    expect(Object.keys(files)).toEqual(['build.ts']);
    expect(engineSourceHash(files, sha256)).toBe(e.sha256);
    expect(e.version).toBe('am-workspace-record-1.0.0');
    for (const m of files['build.ts'].matchAll(/from '([^']+)'/g)) expect(m[1]).toBe('../../../decision/canonical');
  });

  it('verifies VALID (unsigned) with the TypeScript verifier, with every source document recomputed', () => {
    const b = buildWorkspaceBundle({ ...input, signer: { status: 'unsigned' } });
    const r = verifyBundle(b, { keys: [], engines });
    expect(r.result).toBe('VALID');
    expect(r.signature).toBe('unsigned');
    expect(r.uncheckable).toEqual([]);
    expect(r.checks.find((c) => c.id === 'engine_known')?.status).toBe('pass');
    expect(r.checks.find((c) => c.id === 'source_documents')?.status).toBe('pass');
    expect(b.passport_id.startsWith('DP1-')).toBe(true);
    expect(workspaceBundleFileName(b)).toMatch(/^workspace-decision-[0-9a-f]{12}\.bundle\.json$/);
  });

  it('records the review: proposer, a different reviewer, the cited passage text and the audit trail without exports', () => {
    const p = buildWorkspaceBundle({ ...input, signer: { status: 'unsigned' } }).artifacts.passport;
    expect(p.status).toBe('approved');
    expect(p.proposer).toEqual({ id: 'uid-proposer', email: 'proposer@example.invalid' });
    expect(p.reviewer).toEqual({ id: 'uid-editor', email: 'editor@example.invalid' });
    expect(p.decision.evidence[0].quote).toBe('Section 2. A proposal is accepted only when two members have read the cited sources.');
    expect(p.audit.map((a) => a.change)).toEqual(['IMPORTED', 'PROPOSED', 'APPROVED']);
    expect(p.generated_at).toBe(SAMPLE_DECISION.decidedAt);
  });

  it('is deterministic: the same stored record exports to the same hash (e.g. after a redeploy)', () => {
    const a = buildWorkspaceBundle({ ...input, signer: { status: 'unsigned' } });
    const b = buildWorkspaceBundle({ ...input, audit: [...SAMPLE_AUDIT].reverse(), signer: { status: 'unsigned' } });
    expect(b.integrity).toEqual(a.integrity);
  });

  it('a redacted export withholds the documents; the verifier reports them uncheckable', () => {
    const b = buildWorkspaceBundle({ ...input, redacted: true, signer: { status: 'unsigned' } });
    expect(b.artifacts.sources.documents).toBeNull();
    expect(verifyBundle(b, { keys: [], engines }).uncheckable).toEqual(['source_documents']);
  });

  it('a tampered document, conclusion or reviewer is detected', () => {
    const base = buildWorkspaceBundle({ ...input, signer: { status: 'unsigned' } });
    const t1 = JSON.parse(JSON.stringify(base));
    t1.artifacts.sources.documents[0].text = t1.artifacts.sources.documents[0].text.replace('two members', 'one member');
    expect(verifyBundle(t1, { keys: [], engines }).failed).toEqual(expect.arrayContaining(['source_documents']));
    const t2 = JSON.parse(JSON.stringify(base));
    t2.artifacts.review.reviewer = { id: 'uid-proposer', email: 'proposer@example.invalid' };
    expect(verifyBundle(t2, { keys: [], engines }).failed).toEqual(expect.arrayContaining(['ref:review']));
  });

  it('is signed at issuance when a key is configured, and the signature verifies against the published key', () => {
    const { privateKey } = generateKeyPairSync('ed25519');
    const state = signerFrom(privateKey.export({ format: 'pem', type: 'pkcs8' }).toString());
    if (state.status !== 'signing') throw new Error('no signer');
    const b = buildWorkspaceBundle({ ...input, signer: state });
    const keys = [{ kid: state.signer.keyId, x: state.signer.x, status: 'active' as const, not_before: null, not_after: null }];
    const r = verifyBundle(b, { keys, engines });
    expect(r.result).toBe('VALID');
    expect(r.signature).toBe('valid');
    expect(b.artifacts.crypto.signature?.issued_at).toBe(SAMPLE_DECISION.decidedAt);
  });

  it('the conformance fixtures on disk are the ones the script generates (Go verifier runs them offline in CI)', () => {
    const dir = join(process.cwd(), 'packages/decision-verifier/conformance');
    for (const [name, , bundle] of workspaceFixtures()) {
      expect(JSON.parse(readFileSync(join(dir, 'fixtures', `${name}.json`), 'utf8'))).toEqual(JSON.parse(JSON.stringify(bundle)));
    }
  });
});

describe('workspace routes (no database needed)', async () => {
  const { setWorkspaceVerifier } = await import('@/lib/workspace/access');
  const whoami = await import('@/app/api/workspaces/route');
  const documents = await import('@/app/api/workspaces/[t]/documents/route');
  const env = { ...process.env };
  const req = (url: string, init: RequestInit = {}) => new Request(`https://abrahammoses.test${url}`, init);
  const p = (t: string) => ({ params: Promise.resolve({ t }) });
  const tok = { authorization: `Bearer ${'x'.repeat(40)}` };

  it('answers 503 when Firebase Auth is not the identity provider, 401 without a token', async () => {
    delete process.env.AUTH_PROVIDER;
    expect((await whoami.GET(req('/api/workspaces'))).status).toBe(503);
    process.env.AUTH_PROVIDER = 'firebase';
    process.env.FIREBASE_PROJECT_ID = 'abrahammoses-a0a26';
    expect((await whoami.GET(req('/api/workspaces'))).status).toBe(401);
    setWorkspaceVerifier(async () => null);
    expect((await whoami.GET(req('/api/workspaces', { headers: tok }))).status).toBe(401);
  });

  it('lists the workspaces the token grants; refuses non-members and cross-origin writes before touching the database', async () => {
    process.env.AUTH_PROVIDER = 'firebase';
    process.env.FIREBASE_PROJECT_ID = 'abrahammoses-a0a26';
    setWorkspaceVerifier(async () => ({ id: 'u1', email: 'u1@example.invalid', tenants: { 'ws-a': 'editor', 'BAD ID': 'editor' } }));
    const r = await whoami.GET(req('/api/workspaces', { headers: tok }));
    expect(await r.json()).toEqual({ user: { uid: 'u1', email: 'u1@example.invalid' }, workspaces: [{ id: 'ws-a', role: 'editor' }] });
    expect(r.headers.get('cache-control')).toBe('no-store');
    const other = await documents.GET(req('/api/workspaces/ws-b/documents', { headers: tok }), p('ws-b'));
    expect(other.status).toBe(403);
    expect((await other.json()).code).toBe('NOT_A_MEMBER');
    const cross = await documents.POST(req('/api/workspaces/ws-a/documents', { method: 'POST', headers: { ...tok, origin: 'https://evil.example', 'content-type': 'application/json' }, body: '{}' }), p('ws-a'));
    expect(cross.status).toBe(403);
    const bad = await documents.POST(req('/api/workspaces/ws-a/documents', { method: 'POST', headers: { ...tok, 'content-type': 'application/json' }, body: JSON.stringify({ filename: 'x.pdf', contentBase64: 'JVBERg==' }) }), p('ws-a'));
    expect(bad.status).toBe(415);
    process.env.VERCEL_ENV = 'preview';
    const pv = await documents.POST(req('/api/workspaces/ws-a/documents', { method: 'POST', headers: { ...tok, 'content-type': 'application/json' }, body: '{}' }), p('ws-a'));
    expect(pv.status).toBe(503);
    expect((await pv.json()).code).toBe('PREVIEW_WRITES_DISABLED');
    const { previewWriteBlock } = await import('@/lib/workspace/access');
    expect(previewWriteBlock({ VERCEL_ENV: 'preview', WORKSPACE_PREVIEW_WRITES: 'default-db' })).toBeNull();
    expect(previewWriteBlock({ VERCEL_ENV: 'preview', FIRESTORE_DATABASE_ID: 'preview' })).toBeNull();
    expect(previewWriteBlock({ VERCEL_ENV: 'production' })).toBeNull();
    setWorkspaceVerifier(null);
    process.env = env;
  });
});

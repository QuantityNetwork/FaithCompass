import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { verifyBundle, type PinnedEngine, type PinnedKey } from '@/lib/passport-bundle/verify';
import { buildBundle, bundleFileName } from '@/lib/passport-bundle/bundle';
import { buildPassport, encodePassportId } from '@/lib/decision/passport';
import { DEFAULT_ASSUMPTIONS } from '@/lib/decision/engine';
import { ENGINES } from '@/lib/decision/engines';
import { FORMAT3_GOLDEN } from './fixtures/passport-golden';
import { canonicalJson } from '@/lib/decision/canonical';
import { bundleHandler } from '@/lib/decision/api';

const DIR = join(process.cwd(), 'packages/decision-verifier/conformance');
const read = (p: string) => JSON.parse(readFileSync(join(DIR, p), 'utf8'));
const keys: PinnedKey[] = read('keys.json').keys;
const engines: PinnedEngine[] = read('engines.json').engines;
const expected: { name: string; result: string; signature: string; failed: string[]; uncheckable: string[] }[] = read('expected.json').fixtures;

describe('shared conformance fixtures (TypeScript reference verifier)', () => {
  it('covers valid, tampered, unknown-version, revoked and unsigned cases', () => {
    expect(expected.map((e) => e.name)).toEqual(
      expect.arrayContaining(['valid-signed', 'valid-unsigned', 'valid-redacted', 'tampered-assumption', 'tampered-source-hash', 'tampered-attestation', 'unknown-version', 'revoked-key']),
    );
  });
  for (const e of expected) {
    it(e.name, () => {
      const r = verifyBundle(read(`fixtures/${e.name}.json`), { keys, engines });
      expect({ result: r.result, signature: r.signature, failed: r.failed, uncheckable: r.uncheckable }).toEqual({ result: e.result, signature: e.signature, failed: e.failed, uncheckable: e.uncheckable });
    });
  }

  it('the pinned engines file matches the registry', () => {
    expect(engines).toEqual(Object.values(ENGINES).map((e) => ({ version: e.version, sha256: e.sha256 })));
  });

  it('the legacy fixture carries the production hash 0f1ee5e…; an expected hash is enforced when given', () => {
    const legacy = read('fixtures/valid-legacy-format1.json');
    expect(legacy.integrity.passport_sha256).toBe('0f1ee5eedbcf922571819886b1600321f7252c3525bd85cdb679d8ecee09e59b');
    expect(verifyBundle(legacy, { keys, engines, expectedSha256: '0f1ee5eedbcf922571819886b1600321f7252c3525bd85cdb679d8ecee09e59b' }).result).toBe('VALID');
    expect(verifyBundle(legacy, { keys, engines, expectedSha256: 'a'.repeat(64) }).failed).toEqual(['expected_hash']);
  });
});

describe('canonical JSON vectors (shared with the Go verifier)', () => {
  it('reproduces every vector', () => {
    const v: { input: string; canonical: string }[] = read('canonical-vectors.json').vectors;
    expect(v.length).toBeGreaterThanOrEqual(20);
    for (const x of v) expect(canonicalJson(JSON.parse(x.input)), x.input).toBe(x.canonical);
  });
});

describe('bundle export', () => {
  it('a fresh bundle verifies and its passport hash equals the passport integrity hash', () => {
    const [id, sha] = FORMAT3_GOLDEN;
    const bundle = buildBundle(id);
    expect(bundle.integrity.passport_sha256).toBe(sha);
    expect(buildPassport(id).integrity.sha256).toBe(sha);
    const r = verifyBundle(JSON.parse(JSON.stringify(bundle)), { keys: [], engines });
    expect(r).toMatchObject({ result: 'VALID', signature: 'unsigned', failed: [] });
    expect(bundleFileName(bundle)).toBe(`decision-passport-${sha.slice(0, 12)}.bundle.json`);
  });

  it('the redacted export omits the documents and keeps everything else verifiable', () => {
    const full = buildBundle(encodePassportId(DEFAULT_ASSUMPTIONS, new Date('2026-10-20T18:00:00Z')));
    const red = buildBundle(full.passport_id, { redacted: true });
    expect(red.artifacts.sources.documents).toBeNull();
    expect(full.artifacts.sources.documents).toHaveLength(10);
    expect(red.integrity.passport_sha256).toBe(full.integrity.passport_sha256);
    expect(verifyBundle(red, { keys: [], engines }).uncheckable).toEqual(['source_documents']);
  });

  it('the reference verifier does not import the passport builder', () => {
    const src = readFileSync(join(process.cwd(), 'src/lib/passport-bundle/verify.ts'), 'utf8');
    const imports = [...src.matchAll(/^import[^;]*?from '([^']+)'/gm)].map((m) => m[1]);
    expect(imports.sort()).toEqual(['@/lib/decision/canonical', 'node:crypto']);
  });
});

describe('bundle API', () => {
  const get = (url: string) => bundleHandler(new Request(`http://localhost/api/institutional/decision-room/passport/bundle${url}`));
  it('serves a bundle the reference verifier accepts, a redacted variant, and rejects bad input', async () => {
    const id = encodePassportId(DEFAULT_ASSUMPTIONS, new Date('2026-10-20T18:00:00Z'));
    const ok = await get(`?id=${id}`);
    expect(ok.status).toBe(200);
    const b = await ok.json();
    const engines: PinnedEngine[] = Object.values(ENGINES).map((e) => ({ version: e.version, sha256: e.sha256 }));
    expect(verifyBundle(b, { keys: [], engines }).result).toBe('VALID');
    const red = await (await get(`?id=${id}&redacted=1`)).json();
    expect(red.artifacts.sources.documents).toBeNull();
    expect((await get(`?id=DP1-x`)).status).toBe(404);
    expect((await get(``)).status).toBe(400);
    expect((await get(`?id=${id}&foo=1`)).status).toBe(400);
  });
});

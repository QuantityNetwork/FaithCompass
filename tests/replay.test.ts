import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPLAY_MANIFEST, deterministicReplay, historicalAiReview, replayUnderEngine, verifyOperation, type EngineRelease } from '@/lib/replay';
import { RELEASE_V1, RELEASE_V1_1, activeRelease } from '@/lib/replay/releases';
import { CASE_ARCHIVE, buildPassport, encodePassportId, PASSPORT_PREFIX, type CaseArchive } from '@/lib/decision/passport';
import { canonicalJson, hashOf } from '@/lib/decision/canonical';
import { DEFAULT_ASSUMPTIONS, normalise } from '@/lib/decision/engine';
import { FORMAT2_GOLDEN, FORMAT3_GOLDEN } from './fixtures/passport-golden';

/** Format 1 passport issued by production 690beea, and the hash production returned for it. */
const OLD_ID =
  'DP1-eyJhIjp7ImNvbmNlbnRyYXRpb24iOjIyLCJjb3ZNYXgiOjMuNSwiZGVidCI6MTI0LCJncm93dGgiOjEyLCJpbnRlcmVzdCI6MTAuNSwibWFyZ2luIjoxNy41LCJtaW5MaXEiOjEwLCJyZWplY3RlZCI6WyJQMSIsIlAyIl0sInZlcmlmaWVkIjpbIkRPQy0wMSIsIkRPQy0xMCJdfSwiY2FzZSI6IkRULVBDLTAwMSIsImNhc2VWZXJzaW9uIjoiMS4wLjAiLCJ0IjoiMjAyNi0xMC0yMFQxNjowMDowMFoiLCJ2IjoxfQ';
const OLD_SHA = '0f1ee5eedbcf922571819886b1600321f7252c3525bd85cdb679d8ecee09e59b';

const dir = join(process.cwd(), 'src/lib/decision/engines/v1');
const v1Files = Object.fromEntries(readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => [f, readFileSync(join(dir, f), 'utf8')]));
const env = { engineSources: { '1.0.0': v1Files } };
const ACTIVE = activeRelease(readFileSync(join(process.cwd(), 'src/lib/decision/engine.ts'), 'utf8'));

function withData(mutate: (d: CaseArchive['versions'][string]['data']) => CaseArchive['versions'][string]['data']): CaseArchive {
  const v = CASE_ARCHIVE.versions['1.0.0'];
  return { ...CASE_ARCHIVE, versions: { '1.0.0': { ...v, data: mutate(structuredClone(v.data)) } } };
}

describe('three distinct operations', () => {
  it('verify: the old (format 1) passport is unchanged', () => {
    expect(verifyOperation(OLD_ID, OLD_SHA)).toMatchObject({ operation: 'verify', status: 'VALID', expected: OLD_SHA, signature: 'unsigned' });
    expect(verifyOperation(OLD_ID, 'a'.repeat(64)).status).toBe('INVALID');
  });

  it('deterministic replay reproduces every pinned passport (formats 1, 2, 3) with all components checked', () => {
    for (const [id, sha] of [[OLD_ID, OLD_SHA], ...FORMAT2_GOLDEN, FORMAT3_GOLDEN] as [string, string][]) {
      const r = deterministicReplay(id, sha, env);
      expect(r.status, id.slice(0, 40)).toBe('REPRODUCED');
      expect(r.rebuiltSha256).toBe(sha);
      expect(r.checks.every((c) => c.status === 'ok')).toBe(true);
      expect(r.checks.map((c) => c.component)).toEqual(expect.arrayContaining(['ruleset', 'case_archive', 'engine_source', 'source:DOC-03']));
    }
  });

  it('historical AI review is marked not applicable: no AI was used', () => {
    const r = historicalAiReview(OLD_ID);
    expect(r).toMatchObject({ operation: 'historical_ai_review', status: 'NOT_APPLICABLE', model: 'none (deterministic rules; no AI model)' });
    expect(r.reason).toMatch(/no AI was used/);
  });
});

describe('two engine releases', () => {
  it('the releases differ in source: frozen v1 (pinned) and the active engine', () => {
    expect(RELEASE_V1.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(ACTIVE.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(ACTIVE.sha256).not.toBe(RELEASE_V1.sha256);
  });

  it('the old passport verifies and replays under the active engine and under frozen 1.1.0: every node identical', () => {
    expect(verifyOperation(OLD_ID, OLD_SHA).status).toBe('VALID');
    for (const target of [ACTIVE, RELEASE_V1_1]) {
      const r = replayUnderEngine(OLD_ID, RELEASE_V1, target);
      expect(r.compared).toBe(38);
      expect(r.identical).toBe(38);
      expect(r.differing).toEqual([]);
      expect(r.conclusionIdentical).toBe(true);
    }
    expect(RELEASE_V1_1.sha256).toBe('cc226a98bf0f096f7e8341401bb1ec8d699e380ab422a90120ee98f516038230');
  });

  it('a passport issued under 1.1.0 replays deterministically against the pinned 1.1.0 source', () => {
    const v11 = { ...CASE_ARCHIVE, versions: { '1.0.0': { ...CASE_ARCHIVE.versions['1.0.0'], engine: '1.1.0' } } };
    const id = encodePassportId(DEFAULT_ASSUMPTIONS, new Date('2026-10-20T18:00:00Z'), v11);
    const sha = buildPassport(id).integrity.sha256;
    const dir11 = join(process.cwd(), 'src/lib/decision/engines/v1_1');
    const files11 = Object.fromEntries(readdirSync(dir11).filter((f) => f.endsWith('.ts')).map((f) => [f, readFileSync(join(dir11, f), 'utf8')]));
    expect(deterministicReplay(id, sha, { engineSources: { '1.1.0': files11 } }).status).toBe('REPRODUCED');
    expect(deterministicReplay(id, sha, env).status).toBe('INCOMPLETE'); // 1.1.0 sources not supplied
  });

  it('a release that changes a rule is caught node by node', () => {
    const changed: EngineRelease = {
      key: 'fixture',
      version: 'fixture-coverage-10x',
      sha256: null,
      evaluate: (a) => {
        const ev = ACTIVE.evaluate(a);
        const status = (ev['m.coverage'].value as number) >= 10 ? 'MET' : 'NOT_MET';
        return { ...ev, 'k.coverage': { ...ev['k.coverage'], value: status, display: status, status } };
      },
    };
    const r = replayUnderEngine(FORMAT3_GOLDEN[0], RELEASE_V1, changed);
    expect(r.differing.map((d) => d.node)).toEqual(['k.coverage']);
    expect(r.conclusionIdentical).toBe(true); // the conclusion text is the issuing engine's; the fixture only rewrites one node
  });
});

describe('tamper detection, unknown version, incomplete replay', () => {
  it('source tampered: names the document', () => {
    const archive = withData((d) => ({ ...d, documents: d.documents.map((x) => (x.id === 'DOC-03' ? { ...x, fields: x.fields.map((f) => (f.key === 'total_debt' ? { ...f, value: 118 } : f)) } : x)) }));
    const r = deterministicReplay(OLD_ID, OLD_SHA, { ...env, archive });
    expect(r.status).toBe('TAMPERED');
    expect(r.checks.filter((c) => c.status === 'tampered').map((c) => c.component)).toEqual(['source:DOC-03', 'case_archive']);
    expect(verifyOperation(OLD_ID, OLD_SHA, { archive }).status).toBe('TAMPERED');
  });

  it('ruleset tampered', () => {
    const archive = withData((d) => ({ ...d, ruleset: 'dr-rules-1.0.1' }));
    const r = deterministicReplay(OLD_ID, OLD_SHA, { ...env, archive });
    expect(r.status).toBe('TAMPERED');
    expect(r.checks.filter((c) => c.status === 'tampered').map((c) => c.component)).toEqual(['ruleset', 'case_archive']);
  });

  it('engine source tampered: one changed byte in the frozen engine', () => {
    const files = { ...v1Files, 'engine.ts': v1Files['engine.ts'].replace('MIN_COVER', 'MIN_COVER ') };
    const r = deterministicReplay(FORMAT3_GOLDEN[0], FORMAT3_GOLDEN[1], { engineSources: { '1.0.0': files } });
    expect(r.status).toBe('TAMPERED');
    expect(r.checks.filter((c) => c.status === 'tampered').map((c) => c.component)).toEqual(['engine_source']);
  });

  it('an unknown case version or engine is UNSUPPORTED_VERSION', () => {
    const id = (s: unknown) => PASSPORT_PREFIX + Buffer.from(canonicalJson(s), 'utf8').toString('base64url');
    const unknownCase = id({ v: 2, case: 'DT-PC-001', caseVersion: '9.9.9', a: normalise(DEFAULT_ASSUMPTIONS), t: '2026-10-20T16:00:00Z' });
    const unknownEngine = id({ v: 3, case: 'DT-PC-001', caseVersion: '1.0.0', e: '9.0.0', a: normalise(DEFAULT_ASSUMPTIONS), t: '2026-10-20T16:00:00Z' });
    for (const x of [unknownCase, unknownEngine]) {
      expect(deterministicReplay(x, 'a'.repeat(64), env).status).toBe('UNSUPPORTED_VERSION');
      expect(verifyOperation(x, 'a'.repeat(64)).status).toBe('UNSUPPORTED_VERSION');
    }
  });

  it('incomplete: without the engine source, without a manifest, or with a document missing, replay never passes', () => {
    expect(deterministicReplay(OLD_ID, OLD_SHA).status).toBe('INCOMPLETE');
    expect(deterministicReplay(OLD_ID, OLD_SHA, { ...env, manifest: {} }).status).toBe('INCOMPLETE');
    const archive = withData((d) => ({ ...d, documents: d.documents.filter((x) => x.id !== 'DOC-08') }));
    const r = deterministicReplay(OLD_ID, OLD_SHA, { ...env, archive });
    expect(r.status).toBe('TAMPERED'); // a removed document also breaks the archive hash
    expect(r.checks.find((c) => c.component === 'source:DOC-08')?.status).toBe('missing');
  });

  it('a wrong hash on intact components is MISMATCH, not REPRODUCED', () => {
    expect(deterministicReplay(OLD_ID, 'b'.repeat(64), env)).toMatchObject({ status: 'MISMATCH', rebuiltSha256: OLD_SHA });
  });

  it('the manifest pins the archived documents and ruleset', () => {
    const data = CASE_ARCHIVE.versions['1.0.0'].data;
    expect(REPLAY_MANIFEST['1.0.0'].ruleset).toBe(data.ruleset);
    expect(Object.fromEntries(data.documents.map((d) => [d.id, hashOf(d)]))).toEqual(REPLAY_MANIFEST['1.0.0'].documents);
    expect(buildPassport(encodePassportId(DEFAULT_ASSUMPTIONS, new Date('2026-10-20T18:00:00Z'))).integrity.sha256).toBe(FORMAT3_GOLDEN[1]);
  });
});

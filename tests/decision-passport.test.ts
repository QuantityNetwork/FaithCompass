import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sha256 } from '@/lib/decision/canonical';
import { ENGINES, engineSourceHash } from '@/lib/decision/engines';
import { DA_PASSPORT_ENGINE_KEY, bindDeepAnalysis, buildDaPassportBundle, buildRevocationList } from '@/lib/passport/bundle';
import { CURRENT_POLICY, knownPolicy, policyDigest, policyMarkdown } from '@/lib/passport/policy';
import { digest } from '@/lib/passport-bundle/bundle';
import { verifyBundle, verifyRevocationList, type PinnedEngine } from '@/lib/passport-bundle/verify';
import { auditFor, ephemeralSigner, issuedDraft, pinned, sampleDeepBundle } from './helpers/da-passport';

const engines: PinnedEngine[] = Object.values(ENGINES).map((e) => ({ version: e.version, sha256: e.sha256 }));

async function bound(showFilename = false) {
  const r = bindDeepAnalysis(await sampleDeepBundle(), { showFilename });
  if (!r.ok) throw new Error(r.problems.join('; '));
  return r.binding;
}

describe('frozen record engine am-da-passport-1.0.0', () => {
  it('pins the source hash (any edit to src/lib/passport/record/v1 fails here) and imports only canonical', () => {
    const e = ENGINES[DA_PASSPORT_ENGINE_KEY];
    const dir = join(process.cwd(), e.source);
    const files = Object.fromEntries(readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => [f, readFileSync(join(dir, f), 'utf8')]));
    expect(Object.keys(files)).toEqual(['build.ts']);
    expect(engineSourceHash(files, sha256)).toBe(e.sha256);
    expect(e.version).toBe('am-da-passport-1.0.0');
    for (const m of files['build.ts'].matchAll(/from '([^']+)'/g)) expect(m[1]).toBe('../../../decision/canonical');
  });
});

describe('passport policy', () => {
  it('docs/PASSPORT_POLICY.md is generated from the current policy', () => {
    expect(readFileSync('docs/PASSPORT_POLICY.md', 'utf8')).toBe(policyMarkdown());
  });
  it('is identified by version and digest; makes no certification or legal-validity claim', () => {
    expect(knownPolicy(CURRENT_POLICY.version, policyDigest())).toBe(CURRENT_POLICY);
    expect(knownPolicy(CURRENT_POLICY.version, '0'.repeat(64))).toBeNull();
    const text = policyMarkdown().toLowerCase();
    for (const banned of ['is certified', 'certified by', 'legally binding', 'qualified electronic signature is', 'approved by the']) expect(text).not.toContain(banned);
    expect(text).toContain('does not attest that any finding');
  });
});

describe('binding a Deep Analysis report', () => {
  it('keeps hashes, cited spans and findings, not the text; withholds the file name without consent', async () => {
    const b = await bound();
    const deep = await sampleDeepBundle();
    expect(b.reportSha256).toBe(deep.report.seal.reportSha256);
    expect(b.document.filename).toBeNull();
    expect(JSON.stringify(b)).not.toContain(deep.report.text.slice(0, 400));
    expect(b.findings.length).toBe(deep.report.findings.length);
    for (const s of b.spans) expect(sha256(s.quote)).toBe(s.sha256);
    expect((await bound(true)).document.filename).toBe('sample-service-agreement.md');
  });
  it('refuses a tampered Deep Analysis bundle', async () => {
    const deep = await sampleDeepBundle();
    deep.report.findings[0].title = 'Changed after sealing';
    const r = bindDeepAnalysis(deep, { showFilename: false });
    expect(r.ok).toBe(false);
    const spanTamper = await sampleDeepBundle();
    spanTamper.report.spans[0].quote = spanTamper.report.spans[0].quote + 'x';
    expect(bindDeepAnalysis(spanTamper, { showFilename: false }).ok).toBe(false);
    expect(bindDeepAnalysis({ nope: 1 }, { showFilename: false }).ok).toBe(false);
  });
});

describe('DA passport bundle: sign and verify round trip', () => {
  it('an issued passport is signed with issued_at == state.t and verifies VALID with the TS verifier', async () => {
    const signer = ephemeralSigner();
    const d = issuedDraft(await bound());
    const b = buildDaPassportBundle({ tenant: 'am-e2e-a', draft: d, audit: auditFor(d.id), signer });
    const r = verifyBundle(b, { keys: pinned(signer), engines });
    expect(r.failed).toEqual([]);
    expect(r.result).toBe('VALID');
    expect(r.signature).toBe('valid');
    expect(b.artifacts.crypto.signature?.issued_at).toBe('2026-10-21T10:31:00Z');
    expect(b.artifacts.state.t).toBe('2026-10-21T10:31:00Z');
    const p = b.artifacts.passport;
    expect(p.engine.version).toBe('am-da-passport-1.0.0');
    expect(p.policy).toEqual({ version: CURRENT_POLICY.version, sha256: policyDigest() });
    expect(p.proposer).toEqual({ role: 'proposer', uid: 'uid-proposer', email: null });
    expect(p.reviewer).toEqual({ role: 'editor', uid: 'uid-editor', email: 'editor@example.test' });
    expect(p.audit.map((a) => a.change)).toEqual(['DRAFTED', 'SUBMITTED', 'APPROVED', 'ISSUED']);
    expect(p.does_not_attest.join(' ')).toContain('legally or factually correct');
  });

  it('drafts are never signed, even when a signer is available', async () => {
    const signer = ephemeralSigner();
    const d = issuedDraft(await bound(), { status: 'approved', issuedAt: null });
    const b = buildDaPassportBundle({ tenant: 'am-e2e-a', draft: d, audit: auditFor(d.id).slice(0, 3), signer });
    expect(b.artifacts.crypto.signature).toBeNull();
    expect(b.passport_id).not.toContain('.S-');
    expect(b.artifacts.report_markdown).toContain('DRAFT, not issued');
    expect(verifyBundle(b, { keys: [], engines }).result).toBe('VALID');
  });

  it('refuses to issue without a signing key', async () => {
    const d = issuedDraft(await bound());
    expect(() => buildDaPassportBundle({ tenant: 't', draft: d, audit: [], signer: { status: 'unsigned' } })).toThrow('SIGNING_UNAVAILABLE');
  });

  it('detects tampering: a changed finding, a foreign key, a moved issue time, an unpinned engine', async () => {
    const signer = ephemeralSigner();
    const d = issuedDraft(await bound());
    const fresh = () => structuredClone(buildDaPassportBundle({ tenant: 't1', draft: d, audit: auditFor(d.id), signer }));
    const keys = pinned(signer);

    const t1 = fresh();
    t1.artifacts.passport.findings[0].title = 'softened';
    expect(verifyBundle(t1, { keys, engines }).failed).toContain('passport_hash');

    const t2 = fresh();
    t2.artifacts.passport.findings[0].title = 'softened';
    t2.integrity.passport_sha256 = digest(t2.artifacts.passport);
    t2.integrity.artifacts.passport = digest(t2.artifacts.passport);
    const r2 = verifyBundle(t2, { keys, engines });
    expect(r2.failed).toContain('signature');
    expect(r2.signature).toBe('invalid');

    const other = ephemeralSigner();
    expect(verifyBundle(fresh(), { keys: pinned(other), engines }).failed).toContain('signature');

    const t4 = fresh();
    t4.artifacts.crypto.signature!.issued_at = '2026-10-21T11:00:00Z';
    expect(verifyBundle(t4, { keys, engines }).failed).toContain('signature');

    const r5 = verifyBundle(fresh(), { keys, engines: engines.filter((e) => e.version !== 'am-da-passport-1.0.0') });
    expect(r5.result).toBe('UNSUPPORTED');
  });
});

describe('revocation list', () => {
  const sha = 'a'.repeat(64);
  it('a signed list verifies and marks a listed passport as revoked', async () => {
    const signer = ephemeralSigner();
    const d = issuedDraft(await bound());
    const b = buildDaPassportBundle({ tenant: 't', draft: d, audit: auditFor(d.id), signer });
    const keys = pinned(signer);
    const empty = buildRevocationList([{ passport_sha256: sha, revoked_at: '2026-10-21T12:00:00Z', reason: 'withdrawn', superseded_by: null }], '2026-10-21T12:00:01Z', signer);
    expect(verifyRevocationList(empty, keys).status).toBe('valid');
    expect(verifyBundle(b, { keys, engines, revocations: empty }).checks.find((c) => c.id === 'revocation')?.status).toBe('pass');
    const listed = buildRevocationList([{ passport_sha256: b.integrity.passport_sha256, revoked_at: '2026-10-21T12:00:00Z', reason: 'superseded', superseded_by: sha }], '2026-10-21T12:00:01Z', signer);
    const r = verifyBundle(b, { keys, engines, revocations: listed });
    expect(r.result).toBe('INVALID');
    expect(r.failed).toEqual(['revocation']);
  });
  it('an unsigned or forged list cannot establish "not revoked"', async () => {
    const signer = ephemeralSigner();
    const keys = pinned(signer);
    const unsigned = buildRevocationList([], '2026-10-21T12:00:00Z', { status: 'unsigned' });
    expect(verifyRevocationList(unsigned, keys).status).toBe('unsigned');
    const forged = buildRevocationList([], '2026-10-21T12:00:00Z', ephemeralSigner());
    expect(verifyRevocationList(forged, keys).status).toBe('invalid');
    const edited = buildRevocationList([{ passport_sha256: sha, revoked_at: '2026-10-21T12:00:00Z', reason: 'error', superseded_by: null }], '2026-10-21T12:00:00Z', signer);
    edited.entries = [];
    expect(verifyRevocationList(edited, keys).status).toBe('invalid');
    const d = issuedDraft(await bound());
    const b = buildDaPassportBundle({ tenant: 't', draft: d, audit: [], signer });
    expect(verifyBundle(b, { keys, engines, revocations: unsigned }).checks.find((c) => c.id === 'revocation')?.status).toBe('uncheckable');
    expect(verifyBundle(b, { keys, engines }).checks.find((c) => c.id === 'revocation')).toBeUndefined();
  });
});

describe('Deep Analysis passport conformance fixtures (shared with the Go verifier)', () => {
  const dir = join(process.cwd(), 'packages/decision-verifier/conformance');
  const read = (p: string) => JSON.parse(readFileSync(join(dir, p), 'utf8'));
  it('the unsigned fixtures on disk are the ones the script generates', async () => {
    const { unsignedDaFixtures } = await import('../scripts/da-passport-fixtures');
    for (const [name, , bundle] of await unsignedDaFixtures()) expect(read(`fixtures/${name}.json`)).toEqual(JSON.parse(JSON.stringify(bundle)));
  });
  it('revocation-list cases give the same results as in the Go verifier', () => {
    const keys = read('keys.json').keys;
    const pinnedEngines = read('engines.json').engines;
    const cases: { fixture: string; list: string; revocation: string; result: string }[] = read('revocations.json').cases;
    expect(cases.length).toBeGreaterThanOrEqual(4);
    for (const c of cases) {
      const r = verifyBundle(read(`fixtures/${c.fixture}.json`), { keys, engines: pinnedEngines, revocations: read(`revocations/${c.list}.json`) });
      expect([c.list, r.checks.find((x) => x.id === 'revocation')?.status, r.result]).toEqual([c.list, c.revocation, c.result]);
    }
  });
});

describe('public verification service', async () => {
  const { verifyPassportInput, PINNED_KEYS } = await import('@/lib/passport/verify-service');
  type Store = NonNullable<Parameters<typeof verifyPassportInput>[1]>;
  const signer = ephemeralSigner();
  const keys = pinned(signer);
  const deep = await sampleDeepBundle();
  const r0 = bindDeepAnalysis(deep, { showFilename: false });
  if (!r0.ok) throw new Error('bind');
  const d = issuedDraft(r0.binding);
  const b = JSON.parse(JSON.stringify(buildDaPassportBundle({ tenant: 'ws', draft: d, audit: auditFor(d.id), signer })));
  const sig = b.artifacts.crypto.signature;
  const entry = { sha256: b.integrity.passport_sha256, passportId: b.passport_id, kind: 'deep-analysis' as const, tenant: 'ws', draftId: d.id, kid: sig.kid, issuedAt: sig.issued_at, signatureValue: sig.value, engineVersion: 'am-da-passport-1.0.0', policyVersion: CURRENT_POLICY.version, supersedes: null };
  const store = (over: Partial<Store> = {}): Store => ({ entry: async (s) => (s === entry.sha256 ? entry : null), byId: async (i) => (i === entry.passportId ? entry : null), revocation: async () => null, ...over });

  it('pins the production key from the verifier package', () => {
    expect(PINNED_KEYS.map((k) => k.kid)).toContain('ed25519-e31c2d82da92a114');
  });
  it('bundle: VALID with registry, key status, policy and Deep Analysis cross-check, every check explained', async () => {
    const r = await verifyPassportInput({ bundle: b, deepAnalysis: deep }, store(), keys);
    expect(r.verdict).toBe('VALID');
    const byId = Object.fromEntries(r.checks.map((c) => [c.id, c.status]));
    expect(byId).toMatchObject({ signature: 'pass', registry: 'pass', revocation: 'pass', key_status: 'pass', policy: 'pass', deep_analysis: 'pass' });
    for (const c of r.checks) expect(c.explanation.length).toBeGreaterThan(10);
  });
  it('a forged registry entry (no valid operator signature) is reported, and a wrong Deep Analysis bundle fails', async () => {
    const forged = { ...entry, signatureValue: sig.value.replace(/^./, (c: string) => (c === 'A' ? 'B' : 'A')) };
    const r = await verifyPassportInput({ sha256: entry.sha256 }, store({ entry: async () => forged }), keys);
    expect(r.registry.status).toBe('signature_invalid');
    expect(r.verdict).toBe('NOT_FOUND');
    const other = await sampleDeepBundle('sample-nda.md');
    expect((await verifyPassportInput({ bundle: b, deepAnalysis: other }, store(), keys)).checks.find((c) => c.id === 'deep_analysis')?.status).toBe('fail');
  });
  it('revoked, unreachable registry, ID lookup, production keys reject the test signature', async () => {
    const rev = { sha256: entry.sha256, reason: 'withdrawn' as const, supersededBy: null, revokedAt: '2026-10-21T12:00:00Z', draftId: d.id, tenant: 'ws' };
    expect((await verifyPassportInput({ bundle: b }, store({ revocation: async () => rev }), keys)).verdict).toBe('REVOKED');
    const offline = await verifyPassportInput({ bundle: b }, null, keys);
    expect(offline.verdict).toBe('VALID');
    expect(offline.checks.filter((c) => c.status === 'uncheckable').map((c) => c.id).sort()).toEqual(['registry', 'revocation']);
    expect((await verifyPassportInput({ id: entry.passportId }, store(), keys)).verdict).toBe('REGISTERED');
    expect((await verifyPassportInput({ id: 'DP1-unknown' }, store(), keys)).verdict).toBe('NOT_FOUND');
    expect((await verifyPassportInput({ bundle: b }, null)).verdict).toBe('INVALID');
  });
});

describe('generated docs and public copies', () => {
  it('docs/STANDARDS_MAPPING.md carries the current mapping, labelled mapping-not-certification', async () => {
    const { standardsDoc } = await import('../scripts/passport-policy');
    const doc = readFileSync('docs/STANDARDS_MAPPING.md', 'utf8');
    expect(standardsDoc(doc)).toBe(doc);
    expect(doc).toContain('Mapping, not certification');
  });
  it('public sample and key copies equal their sources', async () => {
    const { PUBLIC_SAMPLES } = await import('../scripts/da-passport-fixtures');
    for (const [from, to] of PUBLIC_SAMPLES) expect(readFileSync(to, 'utf8')).toBe(readFileSync(from, 'utf8'));
  });
  it('the site makes no certification, legal-validity or qualified-signature claims', async () => {
    const { MAPPING, MAPPING_NOTICE } = await import('@/lib/passport/standards');
    const text = [MAPPING_NOTICE, ...MAPPING.flatMap((m) => [m.mechanism, m.gap])].join(' ').toLowerCase();
    for (const banned of ['we are certified', 'is certified', 'compliant with', 'legally valid', 'qualified signature is', 'approved by']) expect(text).not.toContain(banned);
  });
});

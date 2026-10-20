/**
 * Passport robustness: archived case versions, frozen engines, backward compatibility and Ed25519 signatures made
 * once at issuance.
 *
 * The signing tests create throwaway key pairs in memory for the duration of the test. No key is written to disk,
 * committed or used anywhere else.
 */
import { generateKeyPairSync } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canonicalJson, sha256 } from '@/lib/decision/canonical';
import { DOCUMENTS } from '@/lib/decision/case';
import { AssumptionsSchema, DEFAULT_ASSUMPTIONS, normalise } from '@/lib/decision/engine';
import { ENGINES, ENGINE_FOR_CASE, engineSourceHash } from '@/lib/decision/engines';
import {
  CASE_ARCHIVE,
  PASSPORT_PREFIX,
  SIGNATURE_SEPARATOR,
  PassportIdError,
  UnsupportedVersionError,
  buildPassport,
  decodePassport,
  decodePassportId,
  encodePassportId,
  issuePassportId,
  passportMarkdown,
  verifyPassport,
  type CaseArchive,
  type VersionEntry,
} from '@/lib/decision/passport';
import { UNSIGNED, keyRegistry, publicKeysDocument, signerFrom, type PassportSigner, type SignerState } from '@/lib/decision/signing';
import { ACTIVE_CASE_VERSION, ARCHIVED_CASES, archiveHash } from '@/lib/decision/versions';
import { FORMAT2_GOLDEN, FORMAT3_GOLDEN } from './fixtures/passport-golden';

const T = new Date('2026-10-20T16:00:00.000Z');
const UNSIGNED_STATE = { status: 'unsigned' } as const;

/** A passport issued by production 690beea (format 1), and the hash production returned for it. */
const ISSUED_ID =
  'DP1-eyJhIjp7ImNvbmNlbnRyYXRpb24iOjIyLCJjb3ZNYXgiOjMuNSwiZGVidCI6MTI0LCJncm93dGgiOjEyLCJpbnRlcmVzdCI6MTAuNSwibWFyZ2luIjoxNy41LCJtaW5MaXEiOjEwLCJyZWplY3RlZCI6WyJQMSIsIlAyIl0sInZlcmlmaWVkIjpbIkRPQy0wMSIsIkRPQy0xMCJdfSwiY2FzZSI6IkRULVBDLTAwMSIsImNhc2VWZXJzaW9uIjoiMS4wLjAiLCJ0IjoiMjAyNi0xMC0yMFQxNjowMDowMFoiLCJ2IjoxfQ';
const ISSUED_SHA256 = '0f1ee5eedbcf922571819886b1600321f7252c3525bd85cdb679d8ecee09e59b';


function idOf(state: unknown) {
  return PASSPORT_PREFIX + Buffer.from(canonicalJson(state), 'utf8').toString('base64url');
}

function engineFiles(dir: string) {
  return Object.fromEntries(
    readdirSync(dir)
      .filter((f) => f.endsWith('.ts'))
      .map((f) => [f, readFileSync(join(dir, f), 'utf8')]),
  );
}

/** A simulated case v2.0.0: the debt schedule is revised and v2 becomes the active version. */
function simulatedV2Archive(): CaseArchive {
  const v1 = ARCHIVED_CASES['1.0.0'].data;
  const data = {
    ...v1,
    version: '2.0.0',
    path: '(simulated in test)',
    documents: DOCUMENTS.map((d) => (d.id === 'DOC-03' ? { ...d, fields: d.fields.map((f) => (f.key === 'total_debt' ? { ...f, value: 131 } : f)) } : d)),
  };
  const v2: VersionEntry = {
    data,
    sha256: archiveHash(data),
    assumptions: AssumptionsSchema,
    normalise,
    engine: '1.0.0',
    build: (_id, state, d, h) => ({ id: 'simulated', version: d.version, content_sha256: h, t: state.t, debt: d.documents.find((x) => x.id === 'DOC-03')!.fields.find((f) => f.key === 'total_debt')!.value }),
  };
  return { active: '2.0.0', versions: { ...CASE_ARCHIVE.versions, '2.0.0': v2 }, engines: CASE_ARCHIVE.engines };
}

describe('archived case versions', () => {
  it('pins the canonical hash of the archived v1 case data, and v1 is the active version', () => {
    expect(ACTIVE_CASE_VERSION).toBe('1.0.0');
    expect(CASE_ARCHIVE.active).toBe('1.0.0');
    expect(archiveHash(ARCHIVED_CASES['1.0.0'].data)).toBe(ARCHIVED_CASES['1.0.0'].sha256);
  });

  it('records the case version, archive hash and frozen engine in every new passport', () => {
    const p = buildPassport(encodePassportId(DEFAULT_ASSUMPTIONS, T));
    expect(decodePassportId(p.id).v).toBe(3);
    expect(decodePassportId(p.id).e).toBe('1.0.0');
    expect(p.case.version).toBe('1.0.0');
    expect(p.case.content_sha256).toBe(ARCHIVED_CASES['1.0.0'].sha256);
    expect(p.case.archive).toBe('src/lib/decision/versions/v1.ts');
    expect(p.integrity.case_archive).toEqual({ version: '1.0.0', path: 'src/lib/decision/versions/v1.ts', content_sha256: ARCHIVED_CASES['1.0.0'].sha256, verified: true });
    expect(p.engine).toEqual({ version: 'dt-engine-1.0.0', sha256: ENGINES['1.0.0'].sha256, source: 'src/lib/decision/engines/v1' });
    expect(p.versions).toMatchObject({ engine: 'dt-engine-1.0.0', passport_format: 'DP3' });
    expect(p.integrity.engine.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(passportMarkdown(p)).toContain(`Engine:** dt-engine-1.0.0, source SHA-256 \`${ENGINES['1.0.0'].sha256}\``);
  });

  it('refuses to rebuild from archived data that no longer matches its pinned hash', () => {
    const entry = CASE_ARCHIVE.versions['1.0.0'];
    const tampered: CaseArchive = {
      ...CASE_ARCHIVE,
      versions: { '1.0.0': { ...entry, data: { ...entry.data, documents: entry.data.documents.slice(1) } } },
    };
    expect(() => buildPassport(encodePassportId(DEFAULT_ASSUMPTIONS, T), { archive: tampered })).toThrow(/does not match its pinned hash/);
  });
});

describe('frozen engines', () => {
  it('pins the source hash of the frozen v1 engine (any edit to engines/v1 fails here)', () => {
    const files = engineFiles(join(process.cwd(), ENGINES['1.0.0'].source));
    expect(Object.keys(files).sort()).toEqual(['build.ts', 'case.ts', 'chamber.ts', 'config.ts', 'contradictions.ts', 'engine.ts']);
    expect(engineSourceHash(files, sha256)).toBe(ENGINES['1.0.0'].sha256);
    expect(ENGINE_FOR_CASE['1.0.0']).toBe('1.0.0');
  });

  it('the frozen engine imports nothing from the live engine modules', () => {
    for (const [name, text] of Object.entries(engineFiles(join(process.cwd(), ENGINES['1.0.0'].source)))) {
      for (const m of text.matchAll(/from '([^']+)'/g)) {
        expect([name, m[1]]).toSatisfy(([, spec]: string[]) => spec === 'zod' || spec.startsWith('./') || ['../../canonical', '../../versions/v1', '../../versions'].includes(spec));
      }
    }
    const passportSrc = readFileSync(join(process.cwd(), 'src/lib/decision/passport.ts'), 'utf8');
    expect(passportSrc).not.toMatch(/from '\.\/(engine|chamber|product|case)'/);
  });

  it('rebuilds the pinned format 3 passport byte for byte', () => {
    expect(verifyPassport(FORMAT3_GOLDEN[0], FORMAT3_GOLDEN[1]).valid).toBe(true);
  });

  it('an unknown engine version is unsupported', () => {
    const id = idOf({ v: 3, case: 'DT-PC-001', caseVersion: '1.0.0', e: '9.0.0', a: normalise(DEFAULT_ASSUMPTIONS), t: '2026-10-20T16:00:00Z' });
    expect(() => buildPassport(id)).toThrow(/Unsupported version: .*engine 9\.0\.0/);
    const noEngine = idOf({ v: 3, case: 'DT-PC-001', caseVersion: '1.0.0', a: normalise(DEFAULT_ASSUMPTIONS), t: '2026-10-20T16:00:00Z' });
    expect(() => buildPassport(noEngine)).toThrow(PassportIdError);
  });
});

describe('backward compatibility', () => {
  it('still verifies a passport issued by production 690beea (format 1), byte for byte', () => {
    const p = buildPassport(ISSUED_ID);
    expect(p.integrity.sha256).toBe(ISSUED_SHA256);
    expect(verifyPassport(ISSUED_ID, ISSUED_SHA256).valid).toBe(true);
  });

  it('still verifies format 2 passports built by the PR #17 production code, byte for byte', () => {
    for (const [id, hash] of FORMAT2_GOLDEN) {
      expect(decodePassportId(id).v).toBe(2);
      expect(buildPassport(id).integrity.sha256).toBe(hash);
      expect(verifyPassport(id, hash).valid).toBe(true);
      // Legacy formats carried no issued signature, so they are honestly unsigned
      expect(buildPassport(id).integrity.signature.status).toBe(UNSIGNED);
    }
  });

  it('a v1 passport still verifies, unchanged, after a simulated v2 case change', () => {
    const v1Id = encodePassportId({ ...DEFAULT_ASSUMPTIONS, rejected: ['P3'] }, T);
    const before = buildPassport(v1Id);
    const archive = simulatedV2Archive();
    const after = buildPassport(v1Id, { archive });
    expect(after.integrity.sha256).toBe(before.integrity.sha256);
    expect(after.case.version).toBe('1.0.0');
    expect(verifyPassport(v1Id, before.integrity.sha256, { archive }).valid).toBe(true);
    expect(verifyPassport(ISSUED_ID, ISSUED_SHA256, { archive }).valid).toBe(true);
    const v2Id = encodePassportId(DEFAULT_ASSUMPTIONS, T, archive);
    expect(decodePassportId(v2Id, archive).caseVersion).toBe('2.0.0');
    const v2 = buildPassport(v2Id, { archive }) as unknown as { debt: number; version: string };
    expect(v2.version).toBe('2.0.0');
    expect(v2.debt).toBe(131);
  });

  it('answers an unknown case version with a clear unsupported-version error', () => {
    const unknown = idOf({ v: 2, case: 'DT-PC-001', caseVersion: '9.9.9', a: normalise(DEFAULT_ASSUMPTIONS), t: '2026-10-20T16:00:00Z' });
    expect(() => buildPassport(unknown)).toThrow(UnsupportedVersionError);
    expect(() => buildPassport(unknown)).toThrow(/^Unsupported version: .*9\.9\.9.*Supported versions: 1\.0\.0\.$/);
    const v2Id = encodePassportId(DEFAULT_ASSUMPTIONS, T, simulatedV2Archive());
    expect(() => verifyPassport(v2Id, 'a'.repeat(64))).toThrow(/Unsupported version/);
  });
});

function ed25519Signer(notBefore: string | null = null): PassportSigner & { signs: number } {
  const { privateKey } = generateKeyPairSync('ed25519');
  const state = signerFrom(privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(), notBefore);
  if (state.status !== 'signing') throw new Error('no signer');
  const counted = { ...state.signer, signs: 0 };
  counted.signIssuance = (h, at) => {
    counted.signs += 1;
    return state.signer.signIssuance(h, at);
  };
  return counted;
}

const signing = (s: PassportSigner): SignerState => ({ status: 'signing', signer: s });

describe('Ed25519 signatures made at issuance', () => {
  it('is unsigned, with an empty public key set, when no key is configured', () => {
    expect(signerFrom(undefined)).toEqual({ status: 'unsigned' });
    const id = issuePassportId(DEFAULT_ASSUMPTIONS, T, { signer: signerFrom(undefined) });
    expect(id).not.toContain(SIGNATURE_SEPARATOR);
    const p = buildPassport(id);
    expect(p.integrity.signature).toEqual({ status: UNSIGNED, public_keys: '/.well-known/abrahammoses-passport-keys.json' });
    expect(UNSIGNED).toBe('unsigned: integrity hash only');
    expect(passportMarkdown(p)).toContain('unsigned: integrity hash only');
    const doc = publicKeysDocument(signerFrom(undefined));
    expect(doc.keys).toEqual([]);
    expect(doc.status).toBe(UNSIGNED);
  });

  it('treats an unusable key as unsigned rather than failing', () => {
    expect(signerFrom('not a key').status).toBe('misconfigured');
    expect(issuePassportId(DEFAULT_ASSUMPTIONS, T, { signer: signerFrom('not a key') })).not.toContain(SIGNATURE_SEPARATOR);
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    expect(signerFrom(privateKey.export({ format: 'pem', type: 'pkcs8' }).toString()).status).toBe('misconfigured');
    const der = generateKeyPairSync('ed25519').privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
    expect(signerFrom(der).status).toBe('signing');
  });

  it('carries the issued signature, kid and issued_at in the passport and verifies them as issued, without re-signing', () => {
    const s = ed25519Signer();
    const id = issuePassportId(DEFAULT_ASSUMPTIONS, T, { signer: signing(s) });
    expect(s.signs).toBe(1);
    expect(id).toContain(SIGNATURE_SEPARATOR);
    const { baseId, signature } = decodePassport(id);
    expect(signature).toMatchObject({ alg: 'Ed25519', kid: s.keyId, issued_at: '2026-10-20T16:00:00Z' });
    const keys = keyRegistry(signing(s));
    const p = buildPassport(id, { keys });
    expect(s.signs).toBe(1); // rendering never signs
    expect(p.id).toBe(baseId);
    expect(p.passport_id).toBe(id);
    expect(p.integrity.signature).toMatchObject({ status: 'signed', valid: true, key_id: s.keyId, issued_at: '2026-10-20T16:00:00Z', value: signature!.value });
    // The signature sits outside the hashed content: signed and unsigned issues of one snapshot share the hash
    expect(p.integrity.sha256).toBe(buildPassport(baseId).integrity.sha256);
    expect(verifyPassport(id, p.integrity.sha256).valid).toBe(true);
    // It still verifies with no signing key configured at all (only the published public key is needed)
    expect(buildPassport(id, { keys: [{ kid: s.keyId, x: s.x, status: 'retired', not_before: null, not_after: '2026-10-21T00:00:00Z' }] }).integrity.signature.valid).toBe(true);
    expect(JSON.stringify(publicKeysDocument(signing(s)))).not.toMatch(/PRIVATE|"d":/);
  });

  it('rejects a forged, re-pointed or non-canonical signature', () => {
    const s = ed25519Signer();
    const other = ed25519Signer();
    const keys = [...keyRegistry(signing(s)), ...keyRegistry(signing(other))];
    const id = issuePassportId(DEFAULT_ASSUMPTIONS, T, { signer: signing(s) });
    const { baseId, signature } = decodePassport(id);
    const enc = (x: unknown) => baseId + SIGNATURE_SEPARATOR + Buffer.from(canonicalJson(x), 'utf8').toString('base64url');
    // Signature moved onto a different snapshot
    const otherBase = encodePassportId({ ...DEFAULT_ASSUMPTIONS, debt: 131 }, T);
    const moved = buildPassport(otherBase + id.slice(id.indexOf(SIGNATURE_SEPARATOR)), { keys });
    expect(moved.integrity.signature).toMatchObject({ valid: false, reason: 'The signature does not match.' });
    // Same signature claimed for another key
    expect(buildPassport(enc({ ...signature, kid: other.keyId }), { keys }).integrity.signature.valid).toBe(false);
    // Unknown key id
    expect(buildPassport(enc({ ...signature, kid: 'ed25519-unknown' }), { keys }).integrity.signature).toMatchObject({ valid: false, reason: 'Unknown key id ed25519-unknown.' });
    // issued_at must equal the passport's generated_at
    expect(() => buildPassport(enc({ ...signature, issued_at: '2026-10-20T17:00:00Z' }))).toThrow(PassportIdError);
    // Legacy formats cannot carry one
    expect(() => buildPassport(ISSUED_ID + id.slice(id.indexOf(SIGNATURE_SEPARATOR)))).toThrow(PassportIdError);
    // Non-canonical encoding
    const nonCanonical = baseId + SIGNATURE_SEPARATOR + Buffer.from(JSON.stringify({ value: signature!.value, kid: signature!.kid, issued_at: signature!.issued_at, alg: 'Ed25519' }), 'utf8').toString('base64url');
    expect(() => buildPassport(nonCanonical)).toThrow(/canonical form/);
  });

  it('keeps retired public keys after rotation, with kid and validity window, so earlier passports keep verifying', () => {
    const oldKey = ed25519Signer('2026-10-01T00:00:00Z');
    const issuedBefore = issuePassportId(DEFAULT_ASSUMPTIONS, T, { signer: signing(oldKey) });
    // Rotation at 18:00: the outgoing public key is archived with its window, a new key becomes active
    const retired = { kid: oldKey.keyId, x: oldKey.x, status: 'retired' as const, not_before: '2026-10-01T00:00:00Z', not_after: '2026-10-20T18:00:00Z' };
    const newKey = ed25519Signer('2026-10-20T18:00:00Z');
    const doc = publicKeysDocument(signing(newKey), [retired]);
    expect(doc.status).toBe('signing');
    expect(doc.keys.map((k) => [k.kid, k.status, k.not_before, k.not_after])).toEqual([
      [newKey.keyId, 'active', '2026-10-20T18:00:00Z', null],
      [oldKey.keyId, 'retired', '2026-10-01T00:00:00Z', '2026-10-20T18:00:00Z'],
    ]);
    const keys = keyRegistry(signing(newKey), [retired]);
    expect(buildPassport(issuedBefore, { keys }).integrity.signature).toMatchObject({ status: 'signed', valid: true, key_id: oldKey.keyId });
    // A passport claiming the old key after its retirement does not verify
    const issuedAfter = issuePassportId(DEFAULT_ASSUMPTIONS, new Date('2026-10-20T19:00:00Z'), { signer: signing(oldKey) });
    expect(buildPassport(issuedAfter, { keys }).integrity.signature).toMatchObject({ valid: false, reason: `Issued after key ${oldKey.keyId} was retired.` });
    // A passport from the new key verifies; one dated before the new key's window does not
    expect(buildPassport(issuePassportId(DEFAULT_ASSUMPTIONS, new Date('2026-10-20T19:00:00Z'), { signer: signing(newKey) }), { keys }).integrity.signature.valid).toBe(true);
    expect(buildPassport(issuePassportId(DEFAULT_ASSUMPTIONS, T, { signer: signing(newKey) }), { keys }).integrity.signature).toMatchObject({ valid: false, reason: `Issued before key ${newKey.keyId} was valid.` });
    // Even with signing switched off later, retired keys stay published
    expect(publicKeysDocument({ status: 'unsigned' }, [retired]).keys).toHaveLength(1);
  });
});

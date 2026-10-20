/**
 * Passport robustness: archived case versions, backward compatibility and optional Ed25519 signatures.
 *
 * The signing tests create a throwaway key pair in memory for the duration of the test. No key is written to disk,
 * committed or used anywhere else.
 */
import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { canonicalJson } from '@/lib/decision/canonical';
import { DOCUMENTS } from '@/lib/decision/case';
import { AssumptionsSchema, DEFAULT_ASSUMPTIONS, normalise } from '@/lib/decision/engine';
import {
  CASE_ARCHIVE,
  PASSPORT_PREFIX,
  UnsupportedVersionError,
  buildPassport,
  decodePassportId,
  encodePassportId,
  passportMarkdown,
  verifyPassport,
  type CaseArchive,
  type VersionEntry,
} from '@/lib/decision/passport';
import { UNSIGNED, publicKeysDocument, signerFrom, verifySignature } from '@/lib/decision/signing';
import { ACTIVE_CASE_VERSION, ARCHIVED_CASES, archiveHash } from '@/lib/decision/versions';

const T = new Date('2026-10-20T16:00:00.000Z');
const UNSIGNED_STATE = { status: 'unsigned' } as const;

/** A passport issued by production 690beea (format 1), and the hash production returned for it. */
const ISSUED_ID =
  'DP1-eyJhIjp7ImNvbmNlbnRyYXRpb24iOjIyLCJjb3ZNYXgiOjMuNSwiZGVidCI6MTI0LCJncm93dGgiOjEyLCJpbnRlcmVzdCI6MTAuNSwibWFyZ2luIjoxNy41LCJtaW5MaXEiOjEwLCJyZWplY3RlZCI6WyJQMSIsIlAyIl0sInZlcmlmaWVkIjpbIkRPQy0wMSIsIkRPQy0xMCJdfSwiY2FzZSI6IkRULVBDLTAwMSIsImNhc2VWZXJzaW9uIjoiMS4wLjAiLCJ0IjoiMjAyNi0xMC0yMFQxNjowMDowMFoiLCJ2IjoxfQ';
const ISSUED_SHA256 = '0f1ee5eedbcf922571819886b1600321f7252c3525bd85cdb679d8ecee09e59b';

function idOf(state: unknown) {
  return PASSPORT_PREFIX + Buffer.from(canonicalJson(state), 'utf8').toString('base64url');
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
    build: (state, d, h) => ({ id: 'simulated', version: d.version, content_sha256: h, t: state.t, debt: d.documents.find((x) => x.id === 'DOC-03')!.fields.find((f) => f.key === 'total_debt')!.value }),
  };
  return { active: '2.0.0', versions: { ...CASE_ARCHIVE.versions, '2.0.0': v2 } };
}

describe('archived case versions', () => {
  it('pins the canonical hash of the archived v1 case data, and v1 is the active version', () => {
    expect(ACTIVE_CASE_VERSION).toBe('1.0.0');
    expect(CASE_ARCHIVE.active).toBe('1.0.0');
    expect(archiveHash(ARCHIVED_CASES['1.0.0'].data)).toBe(ARCHIVED_CASES['1.0.0'].sha256);
  });

  it('records the case version and archive hash in every new passport', () => {
    const p = buildPassport(encodePassportId(DEFAULT_ASSUMPTIONS, T), { signer: UNSIGNED_STATE });
    expect(decodePassportId(p.id).v).toBe(2);
    expect(p.case.version).toBe('1.0.0');
    expect(p.case.content_sha256).toBe(ARCHIVED_CASES['1.0.0'].sha256);
    expect(p.case.archive).toBe('src/lib/decision/versions/v1.ts');
    expect(p.integrity.case_archive).toEqual({ version: '1.0.0', path: 'src/lib/decision/versions/v1.ts', content_sha256: ARCHIVED_CASES['1.0.0'].sha256, verified: true });
  });

  it('refuses to rebuild from archived data that no longer matches its pinned hash', () => {
    const entry = CASE_ARCHIVE.versions['1.0.0'];
    const tampered: CaseArchive = {
      active: '1.0.0',
      versions: { '1.0.0': { ...entry, data: { ...entry.data, documents: entry.data.documents.slice(1) } } },
    };
    expect(() => buildPassport(encodePassportId(DEFAULT_ASSUMPTIONS, T), { archive: tampered, signer: UNSIGNED_STATE })).toThrow(/does not match its pinned hash/);
  });
});

describe('backward compatibility', () => {
  it('still verifies a passport issued by production 690beea, byte for byte', () => {
    const p = buildPassport(ISSUED_ID, { signer: UNSIGNED_STATE });
    expect(p.integrity.sha256).toBe(ISSUED_SHA256);
    expect(verifyPassport(ISSUED_ID, ISSUED_SHA256).valid).toBe(true);
  });

  it('a v1 passport still verifies, unchanged, after a simulated v2 case change', () => {
    const v1Id = encodePassportId({ ...DEFAULT_ASSUMPTIONS, rejected: ['P3'] }, T);
    const before = buildPassport(v1Id, { signer: UNSIGNED_STATE });
    const archive = simulatedV2Archive();
    const after = buildPassport(v1Id, { archive, signer: UNSIGNED_STATE });
    expect(after.integrity.sha256).toBe(before.integrity.sha256);
    expect(after.case.version).toBe('1.0.0');
    expect(verifyPassport(v1Id, before.integrity.sha256, { archive }).valid).toBe(true);
    expect(verifyPassport(ISSUED_ID, ISSUED_SHA256, { archive }).valid).toBe(true);
    // New passports are issued against the active v2, from the v2 archive
    const v2Id = encodePassportId(DEFAULT_ASSUMPTIONS, T, archive);
    expect(decodePassportId(v2Id, archive).caseVersion).toBe('2.0.0');
    const v2 = buildPassport(v2Id, { archive, signer: UNSIGNED_STATE }) as unknown as { debt: number; version: string };
    expect(v2.version).toBe('2.0.0');
    expect(v2.debt).toBe(131);
  });

  it('answers an unknown case version with a clear unsupported-version error', () => {
    const unknown = idOf({ v: 2, case: 'DT-PC-001', caseVersion: '9.9.9', a: normalise(DEFAULT_ASSUMPTIONS), t: '2026-10-20T16:00:00Z' });
    expect(() => buildPassport(unknown)).toThrow(UnsupportedVersionError);
    expect(() => buildPassport(unknown)).toThrow(/^Unsupported version: .*9\.9\.9.*Supported versions: 1\.0\.0\.$/);
    // A passport issued under a future v2 is unsupported on a server that only holds v1
    const v2Id = encodePassportId(DEFAULT_ASSUMPTIONS, T, simulatedV2Archive());
    expect(() => verifyPassport(v2Id, 'a'.repeat(64))).toThrow(/Unsupported version/);
  });
});

describe('optional Ed25519 signatures', () => {
  it('is unsigned, with an empty public key set, when no key is configured', () => {
    expect(signerFrom(undefined)).toEqual({ status: 'unsigned' });
    const p = buildPassport(encodePassportId(DEFAULT_ASSUMPTIONS, T), { signer: signerFrom(undefined) });
    expect(p.integrity.signature).toEqual({ status: UNSIGNED, public_keys: '/.well-known/abrahammoses-passport-keys.json' });
    expect(UNSIGNED).toBe('unsigned: integrity hash only');
    expect(passportMarkdown(p)).toContain('unsigned: integrity hash only');
    const doc = publicKeysDocument(signerFrom(undefined));
    expect(doc.keys).toEqual([]);
    expect(doc.meaning).toMatch(/do not show that the content is correct, and they are not a third-party attestation/);
  });

  it('treats an unusable key as unsigned rather than failing', () => {
    expect(signerFrom('not a key').status).toBe('misconfigured');
    const p = buildPassport(encodePassportId(DEFAULT_ASSUMPTIONS, T), { signer: signerFrom('not a key') });
    expect(p.integrity.signature.status).toBe(UNSIGNED);
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    expect(signerFrom(privateKey.export({ format: 'pem', type: 'pkcs8' }).toString()).status).toBe('misconfigured');
  });

  it('signs the integrity hash with a configured key and publishes only the public key', () => {
    const { privateKey } = generateKeyPairSync('ed25519');
    for (const raw of [privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(), privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64')]) {
      const signer = signerFrom(raw);
      expect(signer.status).toBe('signing');
      if (signer.status !== 'signing') return;
      const id = encodePassportId(DEFAULT_ASSUMPTIONS, T);
      const signed = buildPassport(id, { signer });
      const unsigned = buildPassport(id, { signer: UNSIGNED_STATE });
      expect(signed.integrity.sha256).toBe(unsigned.integrity.sha256); // the signature is outside the hashed content
      const sig = signed.integrity.signature;
      expect(sig.status).toBe('signed');
      expect(sig.key_id).toBe(signer.signer.keyId);
      expect(verifySignature(signed.integrity.sha256, sig.value!, signer.signer.x)).toBe(true);
      expect(verifySignature('0'.repeat(64), sig.value!, signer.signer.x)).toBe(false);
      const doc = publicKeysDocument(signer);
      expect(doc.keys).toHaveLength(1);
      expect(doc.keys[0].x).toBe(signer.signer.x);
      expect(JSON.stringify(doc)).not.toMatch(/PRIVATE|"d":/);
    }
  });
});

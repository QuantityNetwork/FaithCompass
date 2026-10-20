/**
 * Generates the shared conformance fixtures in packages/decision-verifier/conformance. Run: npx tsx scripts/passport-fixtures.ts
 * Test keys are generated fresh on each run and only their PUBLIC halves are written; private keys never leave this
 * process. Expected results are written by hand below (not derived from either verifier).
 */
import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { canonicalJson } from '../src/lib/decision/canonical';
import { DEFAULT_ASSUMPTIONS } from '../src/lib/decision/engine';
import { ENGINES } from '../src/lib/decision/engines';
import type { PublishedKey } from '../src/lib/decision/keys';
import { issuePassportId, encodePassportId } from '../src/lib/decision/passport';
import { signerFrom, type PassportSigner } from '../src/lib/decision/signing';
import { ARTIFACT_NAMES, buildBundle, digest, type PassportBundle } from '../src/lib/passport-bundle/bundle';

const OUT = join(process.cwd(), 'packages/decision-verifier/conformance');
const OLD_ID =
  'DP1-eyJhIjp7ImNvbmNlbnRyYXRpb24iOjIyLCJjb3ZNYXgiOjMuNSwiZGVidCI6MTI0LCJncm93dGgiOjEyLCJpbnRlcmVzdCI6MTAuNSwibWFyZ2luIjoxNy41LCJtaW5MaXEiOjEwLCJyZWplY3RlZCI6WyJQMSIsIlAyIl0sInZlcmlmaWVkIjpbIkRPQy0wMSIsIkRPQy0xMCJdfSwiY2FzZSI6IkRULVBDLTAwMSIsImNhc2VWZXJzaW9uIjoiMS4wLjAiLCJ0IjoiMjAyNi0xMC0yMFQxNjowMDowMFoiLCJ2IjoxfQ';

function testSigner(notBefore: string | null): PassportSigner {
  const { privateKey } = generateKeyPairSync('ed25519');
  const s = signerFrom(privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(), notBefore);
  if (s.status !== 'signing') throw new Error('signer');
  return s.signer;
}
const A = testSigner('2026-01-01T00:00:00Z');
const B = testSigner('2025-01-01T00:00:00Z');
const C = testSigner('2025-06-01T00:00:00Z');
const KEYS: PublishedKey[] = [
  { kid: A.keyId, x: A.x, status: 'active', not_before: '2026-01-01T00:00:00Z', not_after: null },
  { kid: B.keyId, x: B.x, status: 'retired', not_before: '2025-01-01T00:00:00Z', not_after: '2026-06-30T00:00:00Z' },
  { kid: C.keyId, x: C.x, status: 'revoked', not_before: '2025-06-01T00:00:00Z', not_after: null, revoked_at: '2026-09-01T00:00:00Z' },
];
const signing = (s: PassportSigner) => ({ status: 'signing' as const, signer: s });
const T = new Date('2026-10-20T18:00:00Z');

const b = (id: string, redacted = false) => buildBundle(id, { keys: KEYS, redacted });
const reseal = (x: PassportBundle) => {
  x.integrity.passport_sha256 = digest(x.artifacts.passport);
  x.integrity.artifacts = Object.fromEntries(ARTIFACT_NAMES.map((n) => [n, digest(x.artifacts[n])])) as PassportBundle['integrity']['artifacts'];
  return x;
};
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

const signedA = b(issuePassportId(DEFAULT_ASSUMPTIONS, T, { signer: signing(A) }));

const tamperedAssumption = clone(signedA);
(tamperedAssumption.artifacts.passport.assumptions as { debt: number }).debt = 118;
(tamperedAssumption.artifacts.state.a as { debt: number }).debt = 118;

const recomputed = clone(tamperedAssumption);
{
  const [, sig] = recomputed.passport_id.split('.S-');
  const base = 'DP1-' + Buffer.from(canonicalJson(recomputed.artifacts.state), 'utf8').toString('base64url');
  recomputed.passport_id = `${base}.S-${sig}`;
  (recomputed.artifacts.passport as { id: string }).id = base;
  reseal(recomputed);
}

const tamperedSource = clone(signedA);
(tamperedSource.artifacts.sources.inventory[2] as { sha256: string }).sha256 = '0'.repeat(64);

const tamperedAttestation = clone(signedA);
tamperedAttestation.artifacts.review.attestations = [
  { statement: { text: 'Approved by the credit committee', passport_sha256: signedA.integrity.passport_sha256 }, signature: { alg: 'Ed25519', kid: A.keyId, issued_at: '2026-10-20T19:00:00Z', value: 'A'.repeat(86) } },
];
reseal(tamperedAttestation);

const unknownVersion = clone(signedA) as unknown as Record<string, unknown>;
unknownVersion.schema_version = '9.0.0';

const unknownEngine = clone(b(encodePassportId(DEFAULT_ASSUMPTIONS, T)));
{
  const fake = { version: 'dt-engine-9.9.9', sha256: 'f'.repeat(64), source: 'unknown' };
  (unknownEngine.artifacts.passport as { engine: unknown }).engine = fake;
  (unknownEngine.artifacts.release as { engine: unknown }).engine = fake;
  reseal(unknownEngine);
}

type Expect = { result: 'VALID' | 'INVALID' | 'UNSUPPORTED'; signature: 'valid' | 'invalid' | 'unsigned'; failed: string[]; uncheckable: string[] };
const FIXTURES: [string, string, unknown, Expect][] = [
  ['valid-signed', 'Signed by the active key; all artifacts present', signedA, { result: 'VALID', signature: 'valid', failed: [], uncheckable: [] }],
  ['valid-unsigned', 'Unsigned format 3 passport (integrity hash only)', b(encodePassportId(DEFAULT_ASSUMPTIONS, T)), { result: 'VALID', signature: 'unsigned', failed: [], uncheckable: [] }],
  ['valid-historical-key', 'Signed by a retired key inside its validity window', b(issuePassportId(DEFAULT_ASSUMPTIONS, new Date('2026-03-01T12:00:00Z'), { signer: signing(B) })), { result: 'VALID', signature: 'valid', failed: [], uncheckable: [] }],
  ['valid-redacted', 'Signed; source documents withheld (private artifacts)', b(signedA.passport_id, true), { result: 'VALID', signature: 'valid', failed: [], uncheckable: ['source_documents'] }],
  ['valid-legacy-format1', 'Format 1 passport issued by production 690beea (hash 0f1ee5e…)', b(OLD_ID), { result: 'VALID', signature: 'unsigned', failed: [], uncheckable: ['engine_known'] }],
  ['tampered-assumption', 'Debt edited from 124 to 118 in passport and state, nothing recomputed', tamperedAssumption, { result: 'INVALID', signature: 'invalid', failed: ['artifact_hash:passport', 'artifact_hash:state', 'passport_hash', 'ref:id_state', 'signature'], uncheckable: [] }],
  ['tampered-assumption-recomputed', 'Debt edited and every unsigned hash and the ID recomputed: only the signature catches it', recomputed, { result: 'INVALID', signature: 'invalid', failed: ['signature'], uncheckable: [] }],
  ['tampered-source-hash', 'DOC-03 hash in the source inventory replaced', tamperedSource, { result: 'INVALID', signature: 'valid', failed: ['artifact_hash:sources', 'ref:sources', 'source_documents'], uncheckable: [] }],
  ['tampered-attestation', 'A forged committee attestation added, manifest recomputed', tamperedAttestation, { result: 'INVALID', signature: 'valid', failed: ['attestation:0'], uncheckable: [] }],
  ['unknown-version', 'Bundle schema 9.0.0', unknownVersion, { result: 'UNSUPPORTED', signature: 'unsigned', failed: ['schema'], uncheckable: [] }],
  ['unknown-engine', 'Engine dt-engine-9.9.9 (not pinned), hashes recomputed', unknownEngine, { result: 'UNSUPPORTED', signature: 'unsigned', failed: ['engine_known'], uncheckable: [] }],
  ['revoked-key', 'Signed by a revoked key', b(issuePassportId(DEFAULT_ASSUMPTIONS, T, { signer: signing(C) })), { result: 'INVALID', signature: 'invalid', failed: ['signature'], uncheckable: [] }],
];

rmSync(join(OUT, 'fixtures'), { recursive: true, force: true });
mkdirSync(join(OUT, 'fixtures'), { recursive: true });
for (const [name, , bundle] of FIXTURES) writeFileSync(join(OUT, 'fixtures', `${name}.json`), JSON.stringify(bundle, null, 2) + '\n');
writeFileSync(join(OUT, 'keys.json'), JSON.stringify({ note: 'TEST KEYS for conformance only. Private halves were discarded when the fixtures were generated.', keys: KEYS }, null, 2) + '\n');
writeFileSync(join(OUT, 'engines.json'), JSON.stringify({ engines: Object.values(ENGINES).map((e) => ({ version: e.version, sha256: e.sha256 })) }, null, 2) + '\n');
writeFileSync(join(OUT, 'expected.json'), JSON.stringify({ fixtures: FIXTURES.map(([name, description, , expect]) => ({ name, description, ...expect })) }, null, 2) + '\n');
console.log(`${FIXTURES.length} fixtures written`);

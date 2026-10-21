/**
 * Deep Analysis passport conformance fixtures (packages/decision-verifier/conformance), shared by the TypeScript and
 * the Go verifier. The unsigned fixtures are deterministic (tests/decision-passport.test.ts regenerates them).
 * `--sign` also writes the signed fixtures and revocation lists with a freshly generated TEST key: its public half is
 * pinned in conformance/keys.json, its private half exists only in this process and is discarded.
 * Run: npx tsx --tsconfig tsconfig.json scripts/da-passport-fixtures.ts [--sign]
 */
import { generateKeyPairSync } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { signerFrom, type SignerState } from '../src/lib/decision/signing';
import { bindDeepAnalysis, buildDaPassportBundle, buildRevocationList } from '../src/lib/passport/bundle';
import { digest } from '../src/lib/passport-bundle/bundle';
import { auditFor, issuedDraft, sampleDeepBundle } from '../tests/helpers/da-passport';

const DIR = join(process.cwd(), 'packages/decision-verifier/conformance');
const KEYS = () => JSON.parse(readFileSync(join(DIR, 'keys.json'), 'utf8')).keys;
const TENANT = 'sample-tenant';
type Exp = { result: string; signature: string; failed: string[]; uncheckable: string[] };

async function binding() {
  const r = bindDeepAnalysis(await sampleDeepBundle(), { showFilename: true });
  if (!r.ok) throw new Error(r.problems.join('; '));
  return r.binding;
}

function withKeys<T extends { artifacts: { crypto: { keys: unknown } }; integrity: { artifacts: { crypto: string } } }>(b: T): T {
  b.artifacts.crypto.keys = KEYS();
  b.integrity.artifacts.crypto = digest(b.artifacts.crypto);
  return b;
}

export async function unsignedDaFixtures(): Promise<[string, string, unknown, Exp][]> {
  const d = issuedDraft(await binding(), { status: 'approved', issuedAt: null });
  const draft = withKeys(buildDaPassportBundle({ tenant: TENANT, draft: d, audit: auditFor(d.id).slice(0, 3) }));
  const tampered = JSON.parse(JSON.stringify(draft));
  tampered.artifacts.passport.spans[0].quote = tampered.artifacts.passport.spans[0].quote.replace(/\w+/, 'Nothing');
  return [
    ['valid-da-passport-draft', 'Deep Analysis passport (am-da-passport-1.0.0), approved draft, unsigned', draft, { result: 'VALID', signature: 'unsigned', failed: [], uncheckable: [] }],
    ['tampered-da-passport-span', 'Deep Analysis passport draft: a cited quote edited, hashes not recomputed', tampered, { result: 'INVALID', signature: 'unsigned', failed: ['artifact_hash:passport', 'passport_hash'], uncheckable: [] }],
  ];
}

function testSigner(): SignerState {
  const { privateKey } = generateKeyPairSync('ed25519');
  return signerFrom(privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(), '2026-10-01T00:00:00Z');
}

async function signedDaFixtures(signer: SignerState, forger: SignerState) {
  const d = issuedDraft(await binding());
  const issued = withKeys(buildDaPassportBundle({ tenant: TENANT, draft: d, audit: auditFor(d.id), signer }));
  const edited = JSON.parse(JSON.stringify(issued));
  edited.artifacts.passport.findings[0].title = 'No issue found';
  edited.integrity.passport_sha256 = digest(edited.artifacts.passport);
  edited.integrity.artifacts.passport = digest(edited.artifacts.passport);
  const fixtures: [string, string, unknown, Exp][] = [
    ['valid-da-passport-issued', 'Deep Analysis passport, issued after two-person review, signed (test key)', issued, { result: 'VALID', signature: 'valid', failed: [], uncheckable: [] }],
    ['tampered-da-passport-finding', 'Issued Deep Analysis passport: a finding edited and every hash recomputed; the signature no longer matches', edited, { result: 'INVALID', signature: 'invalid', failed: ['signature'], uncheckable: [] }],
  ];
  const sha = issued.integrity.passport_sha256;
  const other = 'b'.repeat(64);
  const at = '2026-10-21T12:00:00Z';
  const lists: Record<string, unknown> = {
    'signed-not-listed': buildRevocationList([{ passport_sha256: other, revoked_at: '2026-10-21T11:00:00Z', reason: 'withdrawn', superseded_by: null }], at, signer),
    'signed-revoked': buildRevocationList([{ passport_sha256: sha, revoked_at: '2026-10-21T11:00:00Z', reason: 'superseded', superseded_by: other }], at, signer),
    unsigned: buildRevocationList([], at, { status: 'unsigned' }),
    forged: buildRevocationList([], at, forger),
  };
  const cases = [
    { fixture: 'valid-da-passport-issued', list: 'signed-not-listed', revocation: 'pass', result: 'VALID' },
    { fixture: 'valid-da-passport-issued', list: 'signed-revoked', revocation: 'fail', result: 'INVALID' },
    { fixture: 'valid-da-passport-issued', list: 'unsigned', revocation: 'uncheckable', result: 'VALID' },
    { fixture: 'valid-da-passport-issued', list: 'forged', revocation: 'uncheckable', result: 'VALID' },
  ];
  return { fixtures, lists, cases };
}

function writeFixtures(items: [string, string, unknown, Exp][]) {
  const expectedPath = join(DIR, 'expected.json');
  const expected = JSON.parse(readFileSync(expectedPath, 'utf8'));
  for (const [name, description, bundle, e] of items) {
    writeFileSync(join(DIR, 'fixtures', `${name}.json`), JSON.stringify(bundle, null, 2) + '\n');
    expected.fixtures = expected.fixtures.filter((f: { name: string }) => f.name !== name);
    expected.fixtures.push({ name, description, ...e });
  }
  writeFileSync(expectedPath, JSON.stringify(expected, null, 2) + '\n');
}

/** Public copies for the verification portal and the offline-verifier page (tests check they equal the sources). */
export const PUBLIC_SAMPLES: [string, string][] = [
  ['packages/decision-verifier/conformance/fixtures/valid-da-passport-draft.json', 'public/decision-passport/samples/approved-draft.bundle.json'],
  ['packages/decision-verifier/conformance/fixtures/valid-da-passport-issued.json', 'public/decision-passport/samples/issued-test-key.bundle.json'],
  ['packages/decision-verifier/conformance/fixtures/tampered-da-passport-finding.json', 'public/decision-passport/samples/tampered-finding.bundle.json'],
  ['packages/decision-verifier/keys/production.json', 'public/decision-passport/production-keys.json'],
  ['packages/decision-verifier/conformance/engines.json', 'public/decision-passport/engines.json'],
];
export const sampleDeepBundlePath = 'public/decision-passport/samples/deep-analysis-sample.bundle.json';

async function writePublicSamples() {
  mkdirSync(join(process.cwd(), 'public/decision-passport/samples'), { recursive: true });
  for (const [from, to] of PUBLIC_SAMPLES) copyFileSync(join(process.cwd(), from), join(process.cwd(), to));
  writeFileSync(join(process.cwd(), sampleDeepBundlePath), JSON.stringify(await sampleDeepBundle(), null, 2) + '\n');
}

if (process.argv[1]?.endsWith('da-passport-fixtures.ts')) {
  (async () => {
    if (process.argv.includes('--sign')) {
      const signer = testSigner();
      const forger = testSigner();
      if (signer.status !== 'signing') throw new Error('no test signer');
      const keysPath = join(DIR, 'keys.json');
      const keysDoc = JSON.parse(readFileSync(keysPath, 'utf8'));
      const revPath = join(DIR, 'revocations.json');
      let prev: string | null = null;
      try {
        prev = JSON.parse(readFileSync(revPath, 'utf8')).signing_kid;
      } catch {}
      keysDoc.keys = keysDoc.keys.filter((k: { kid: string }) => k.kid !== prev);
      keysDoc.keys.push({ kid: signer.signer.keyId, x: signer.signer.x, status: 'active', not_before: '2026-10-01T00:00:00Z', not_after: null });
      writeFileSync(keysPath, JSON.stringify(keysDoc, null, 2) + '\n');
      const { fixtures, lists, cases } = await signedDaFixtures(signer, forger);
      writeFixtures(fixtures);
      writeFileSync(revPath, JSON.stringify({ note: 'Revocation-list cases: verify fixtures/<fixture>.json with revocations/<list>.json; the revocation check must have the given status.', signing_kid: signer.signer.keyId, cases }, null, 2) + '\n');
      for (const [n, l] of Object.entries(lists)) writeFileSync(join(DIR, 'revocations', `${n}.json`), JSON.stringify(l, null, 2) + '\n');
    }
    writeFixtures(await unsignedDaFixtures());
    await writePublicSamples();
    console.log('Deep Analysis passport fixtures written');
  })();
}

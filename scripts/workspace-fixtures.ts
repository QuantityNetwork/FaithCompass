/**
 * Adds the workspace-decision conformance fixtures (unsigned valid, tampered quote) to
 * packages/decision-verifier/conformance without touching the other fixtures or keys. Deterministic.
 * Run: npx tsx scripts/workspace-fixtures.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { digest } from '../src/lib/passport-bundle/bundle';
import { buildWorkspaceBundle } from '../src/lib/workspace/passport';
import { SAMPLE_AUDIT, SAMPLE_DECISION, SAMPLE_DOC } from '../tests/fixtures/workspace-sample';

const DIR = join(process.cwd(), 'packages/decision-verifier/conformance');
const KEYS = JSON.parse(readFileSync(join(DIR, 'keys.json'), 'utf8')).keys;

export function workspaceFixtures() {
  const valid = buildWorkspaceBundle({ tenant: 'sample-tenant', decision: SAMPLE_DECISION, documents: [SAMPLE_DOC], audit: SAMPLE_AUDIT, signer: { status: 'unsigned' } });
  // Informational key copy: the conformance test keys, so the fixture does not depend on the server's configuration.
  valid.artifacts.crypto.keys = KEYS;
  valid.integrity.artifacts.crypto = digest(valid.artifacts.crypto);
  const tampered = JSON.parse(JSON.stringify(valid));
  tampered.artifacts.passport.decision.conclusion = 'No: a single reader is enough.';
  return [
    ['valid-workspace-decision', 'Workspace decision record (am-workspace-record-1.0.0), approved by a second person, unsigned', valid, { result: 'VALID', signature: 'unsigned', failed: [], uncheckable: [] }],
    ['tampered-workspace-conclusion', 'Workspace decision: conclusion edited after export, hashes not recomputed', tampered, { result: 'INVALID', signature: 'unsigned', failed: ['artifact_hash:passport', 'passport_hash'], uncheckable: [] }],
  ] as const;
}

if (process.argv[1]?.endsWith('workspace-fixtures.ts')) {
  const expectedPath = join(DIR, 'expected.json');
  const expected = JSON.parse(readFileSync(expectedPath, 'utf8'));
  for (const [name, description, bundle, e] of workspaceFixtures()) {
    writeFileSync(join(DIR, 'fixtures', `${name}.json`), JSON.stringify(bundle, null, 2) + '\n');
    expected.fixtures = expected.fixtures.filter((f: { name: string }) => f.name !== name);
    expected.fixtures.push({ name, description, ...e });
  }
  writeFileSync(expectedPath, JSON.stringify(expected, null, 2) + '\n');
  console.log('workspace fixtures written');
}

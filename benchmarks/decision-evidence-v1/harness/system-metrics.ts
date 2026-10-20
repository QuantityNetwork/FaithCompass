/** System-level metrics that are not per benchmark case: replay fidelity and passport integrity. */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { deterministicReplay } from '@/lib/replay';
import { verifyBundle } from '@/lib/passport-bundle/verify';
import { wilson } from './metrics';

const ROOT = process.cwd();

/** Pinned passports (formats 1–3) whose hashes are recorded in tests/fixtures and the production smoke test. */
export function replayFidelity(pinned: [string, string][]) {
  const dir = join(ROOT, 'src/lib/decision/engines/v1');
  const files = Object.fromEntries(readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => [f, readFileSync(join(dir, f), 'utf8')]));
  const results = pinned.map(([id, sha]) => deterministicReplay(id, sha, { engineSources: { '1.0.0': files } }).status);
  return { ...wilson(results.filter((r) => r === 'REPRODUCED').length, results.length), statuses: results };
}

/** Shared conformance fixtures: valid ones must verify, every tampered/unknown/revoked one must be rejected. */
export function passportIntegrity() {
  const dir = join(ROOT, 'packages/decision-verifier/conformance');
  const keys = JSON.parse(readFileSync(join(dir, 'keys.json'), 'utf8')).keys;
  const engines = JSON.parse(readFileSync(join(dir, 'engines.json'), 'utf8')).engines;
  const expected: { name: string; result: string }[] = JSON.parse(readFileSync(join(dir, 'expected.json'), 'utf8')).fixtures;
  let tamperN = 0, tamperK = 0, validN = 0, validK = 0;
  for (const e of expected) {
    const r = verifyBundle(JSON.parse(readFileSync(join(dir, 'fixtures', `${e.name}.json`), 'utf8')), { keys, engines });
    if (e.result === 'VALID') {
      validN++;
      if (r.result === 'VALID') validK++;
    } else {
      tamperN++;
      if (r.result !== 'VALID') tamperK++;
    }
  }
  return { tamper_detection: wilson(tamperK, tamperN), valid_accepted: wilson(validK, validN) };
}

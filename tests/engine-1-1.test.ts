import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ENGINES, ENGINE_FOR_CASE, engineSourceHash } from '@/lib/decision/engines';
import { canonicalJson, sha256 } from '@/lib/decision/canonical';
import { evaluate as evaluateV1 } from '@/lib/decision/engines/v1/engine';
import { evaluate as evaluateV11, recalculate } from '@/lib/decision/engines/v1_1/engine';
import { CASE_ARCHIVE, buildPassport, decodePassportId, encodePassportId, verifyPassport, type CaseArchive } from '@/lib/decision/passport';
import { DEFAULT_ASSUMPTIONS, type Assumptions } from '@/lib/decision/engine';
import { mutationBattery } from '@/lib/counterfactual/oracle';

const files = (dir: string) => Object.fromEntries(readdirSync(join(process.cwd(), dir)).filter((f) => f.endsWith('.ts')).map((f) => [f, readFileSync(join(process.cwd(), dir, f), 'utf8')]));
const T = new Date('2026-10-20T18:00:00.000Z');
const archive11: CaseArchive = { ...CASE_ARCHIVE, versions: { '1.0.0': { ...CASE_ARCHIVE.versions['1.0.0'], engine: '1.1.0' } } };

describe('frozen engine dt-engine-1.1.0', () => {
  it('pins its source hash; new passports still name 1.0.0', () => {
    const f = files(ENGINES['1.1.0'].source);
    expect(Object.keys(f).sort()).toEqual(['build.ts', 'case.ts', 'chamber.ts', 'config.ts', 'contradictions.ts', 'engine.ts']);
    expect(engineSourceHash(f, sha256)).toBe(ENGINES['1.1.0'].sha256);
    expect(ENGINES['1.1.0'].sha256).not.toBe(ENGINES['1.0.0'].sha256);
    expect(ENGINE_FOR_CASE['1.0.0']).toBe('1.0.0');
  });

  it('differs from 1.0.0 only by adding selective recalculation, and imports nothing live', () => {
    const a = files(ENGINES['1.0.0'].source);
    const b = files(ENGINES['1.1.0'].source);
    for (const name of ['case.ts', 'chamber.ts', 'config.ts', 'contradictions.ts']) expect(b[name], name).toBe(a[name]);
    expect(b['engine.ts'].startsWith(a['engine.ts'].trimEnd())).toBe(true);
    for (const text of Object.values(b)) for (const m of text.matchAll(/^import[^;]*?from ['"]([^'"]+)['"]/gm)) {
      expect(m[1] === 'zod' || m[1].startsWith('./') || ['../../canonical', '../../versions/v1', '../../versions'].includes(m[1]), m[1]).toBe(true);
    }
  });

  it('evaluates every oracle mutation exactly like 1.0.0, and its selective recalculation equals full evaluation', () => {
    const base = evaluateV11(DEFAULT_ASSUMPTIONS);
    for (const m of mutationBattery()) {
      const a = { ...DEFAULT_ASSUMPTIONS, ...m } as Assumptions;
      expect(canonicalJson(evaluateV11(a))).toBe(canonicalJson(evaluateV1(a)));
      expect(canonicalJson(recalculate(base, a).evaluation)).toBe(canonicalJson(evaluateV1(a)));
    }
  });

  it('a passport naming 1.1.0 is built by the 1.1.0 code and verifies; content equals 1.0.0 apart from the engine', () => {
    const id11 = encodePassportId(DEFAULT_ASSUMPTIONS, T, archive11);
    expect(decodePassportId(id11).e).toBe('1.1.0');
    const p11 = buildPassport(id11);
    const p10 = buildPassport(encodePassportId(DEFAULT_ASSUMPTIONS, T));
    expect(p11.integrity.engine).toMatchObject({ version: 'dt-engine-1.1.0', sha256: ENGINES['1.1.0'].sha256 });
    expect(verifyPassport(id11, p11.integrity.sha256).valid).toBe(true);
    const strip = (p: Record<string, unknown>) => {
      const { id, passport_id, integrity, engine, versions, ...rest } = p;
      void id; void passport_id; void integrity; void engine;
      return { ...rest, versions: { ...(versions as object), engine: null } };
    };
    expect(canonicalJson(strip(p11))).toBe(canonicalJson(strip(p10)));
    expect(p11.integrity.sha256).not.toBe(p10.integrity.sha256);
  });
});

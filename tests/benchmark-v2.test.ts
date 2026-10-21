import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deriveFromRaw, loadCases, report, ROOT, verifyManifest } from '../benchmarks/decision-evidence-v2/harness/run';
import { systemD } from '../benchmarks/decision-evidence-v2/harness/system-d';
import { aiLayerPrompt, AI_LAYER_PROMPT_VERSION } from '@/lib/contradiction/ai-candidates';
import { buildPrompt, labelledDocuments, PROMPT_VERSION } from '../benchmarks/decision-evidence-v1/harness/baselines';

const cases = loadCases();

describe('decision-evidence-v2 dataset', () => {
  it('36 fictional authored cases, 9 per domain, manifest matches the frozen hash', () => {
    expect(cases).toHaveLength(36);
    for (const d of ['private_credit', 'm_and_a', 'contract', 'scholarly']) expect(cases.filter((c) => c.domain === d)).toHaveLength(9);
    expect(cases.every((c) => c.fictional === true && (c as unknown as { authored_test_material: boolean }).authored_test_material === true)).toBe(true);
    const m = verifyManifest();
    expect(m.ok).toBe(true);
    expect(m.eval_set_sha256).toBe('febdb7f4710eb04961cf207343d8f4786cfc10a7c0b69aced8b20cef918372c7');
  });
  it('gold refers to existing spans and spans match the text', () => {
    for (const c of cases) {
      const ids = new Set(c.spans.map((s) => s.id));
      for (const p of c.gold.pairs) expect(p.facts.every((f) => ids.has(f))).toBe(true);
      for (const s of c.spans) expect(c.documents.find((d) => d.id === s.doc)!.text.slice(s.start, s.end)).toBe(s.text);
    }
  });
});

describe('system D', () => {
  it("uses A's frozen prompt byte for byte", () => {
    expect(AI_LAYER_PROMPT_VERSION).toBe(PROMPT_VERSION);
    for (const c of cases) expect(aiLayerPrompt({ documents: c.documents, spans: c.spans, conclusions: c.conclusions })).toBe(buildPrompt(c, labelledDocuments(c)));
  });
  it('is BLOCKED without a key and makes no call', () => {
    const saved = [process.env.OPENAI_API_KEY, process.env.BENCH_LLM_API_KEY];
    process.env.OPENAI_API_KEY = '';
    process.env.BENCH_LLM_API_KEY = '';
    expect(systemD.availability().status).toBe('BLOCKED');
    [process.env.OPENAI_API_KEY, process.env.BENCH_LLM_API_KEY] = saved;
  });
});

const raw = join(ROOT, 'results/raw/eval');
describe.runIf(existsSync(join(ROOT, 'results/results.json')))('committed v2 results', () => {
  it('re-derive exactly from the committed raw outputs (counts, intervals, sealed digests)', async () => {
    const committed = JSON.parse(readFileSync(join(ROOT, 'results/results.json'), 'utf8'));
    const { outputs, spent } = await deriveFromRaw(cases);
    const again = report(cases, outputs, spent, 'test');
    for (const s of ['A', 'B', 'C', 'D']) {
      const a = (again.systems[s] as any).results.eval, b = committed.systems[s].results.eval;
      for (const m of ['conflict_recall', 'conflict_precision', 'false_positive_rate_hard_negatives', 'false_positive_rate_all_pairs', 'class_agreement_on_found', 'citation_precision', 'evidence_recall', 'dependency_accuracy', 'per_plant']) expect(a[m], `${s} ${m}`).toEqual(b[m]);
    }
    expect((again.systems.D as any).results.eval.sealed_digests).toEqual(committed.systems.D.results.eval.sealed_digests);
    expect(again.bootstrap).toEqual(committed.bootstrap);
  });
  it('raw outputs contain no key or authorization header', () => {
    for (const s of readdirSync(raw)) for (const f of readdirSync(join(raw, s))) expect(readFileSync(join(raw, s, f), 'utf8')).not.toMatch(/sk-[A-Za-z0-9_-]{16,}|authorization|bearer /i);
  });
});

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyManifest } from '../benchmarks/decision-evidence-v1/harness/run';
import { aggregate, scoreCase, wilson } from '../benchmarks/decision-evidence-v1/harness/metrics';
import { baselineA, baselineB, baselineD, bm25, buildPrompt, parseAnswer } from '../benchmarks/decision-evidence-v1/harness/baselines';
import type { BenchCase } from '../benchmarks/decision-evidence-v1/harness/types';

const ROOT = join(process.cwd(), 'benchmarks/decision-evidence-v1');
const load = (s: string): BenchCase[] => readdirSync(join(ROOT, 'cases', s)).sort().map((f) => JSON.parse(readFileSync(join(ROOT, 'cases', s, f), 'utf8')));
const dev = load('dev');

describe('decision-evidence-v1 dataset', () => {
  it('has 40 fictional cases, 10 per domain, split 12 dev / 28 eval, and the eval manifest matches', () => {
    const all = [...dev, ...load('eval')];
    expect(all).toHaveLength(40);
    expect(dev).toHaveLength(12);
    for (const d of ['private_credit', 'm_and_a', 'contract', 'scholarly']) expect(all.filter((c) => c.domain === d)).toHaveLength(10);
    expect(all.every((c) => c.fictional === true)).toBe(true);
    expect(verifyManifest().ok).toBe(true);
  });
  it('gold refers only to existing spans; spans match the document text', () => {
    for (const c of [...dev, ...load('eval')]) {
      const ids = new Set(c.spans.map((s) => s.id));
      for (const p of c.gold.pairs) expect(p.facts.every((f) => ids.has(f))).toBe(true);
      for (const s of c.spans) expect(c.documents.find((d) => d.id === s.doc)!.text.slice(s.start, s.end)).toBe(s.text);
      for (const deps of Object.values(c.gold.dependencies)) expect(deps.every((f) => ids.has(f))).toBe(true);
    }
  });
});

describe('metrics', () => {
  it('Wilson interval', () => {
    expect(wilson(0, 0).value).toBeNull();
    expect(wilson(5, 10).ci95).toEqual([0.2366, 0.7634]);
  });
  it('an oracle that returns the gold scores 100% and 0 false positives (dev)', () => {
    const scores = dev.map((c) =>
      scoreCase(c, {
        findings: c.gold.pairs.filter((p) => p.class !== 'NONE').map((p) => ({ facts: p.facts, class: p.class as Exclude<typeof p.class, 'NONE'> })),
        citations: Object.fromEntries(Object.entries(c.gold.inputs).map(([k, v]) => [k, v.map((x) => x.acceptable[0])])),
        dependencies: c.gold.dependencies,
        ms: 0,
        usd: 0,
      }),
    );
    const a = aggregate(scores);
    expect(a.conflict_recall.value).toBe(1);
    expect(a.false_positive_rate_all_pairs.k).toBe(0);
    expect(a.class_agreement_on_found.value).toBe(1);
    expect((a.citation_precision as { value: number }).value).toBe(1);
    expect((a.evidence_recall as { value: number }).value).toBe(1);
    expect((a.dependency_accuracy as { value: number }).value).toBe(1);
  });
});

describe('baselines A, B, D are blocked, not estimated', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('A and B report BLOCKED without an API key and make no network call', () => {
    vi.stubEnv('BENCH_LLM_API_KEY', '');
    const spy = vi.spyOn(globalThis, 'fetch');
    expect(baselineA.availability().status).toBe('BLOCKED');
    expect(baselineB.availability().status).toBe('BLOCKED');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
  it('D is BLOCKED: no reviewers', () => {
    expect(baselineD.availability()).toMatchObject({ status: 'BLOCKED' });
  });
  it('the adapters build prompts, retrieve deterministically and parse answers (dev only, no model)', () => {
    const c = dev[0];
    expect(buildPrompt(c)).toContain(c.spans[0].id);
    expect(bm25(c.spans, c.conclusions[0].text).map((s) => s.id)).toEqual(bm25(c.spans, c.conclusions[0].text).map((s) => s.id));
    const parsed = parseAnswer(`ok {"findings":[{"facts":["${c.spans[0].id}","${c.spans[1].id}"],"class":"CONFIRMED_CONFLICT"},{"facts":["X","Y"],"class":"CONFIRMED_CONFLICT"}],"citations":{"C1":["${c.spans[0].id}","nope"]}}`, c);
    expect(parsed.findings).toHaveLength(1);
    expect(parsed.citations!.C1).toEqual([c.spans[0].id]);
  });
});

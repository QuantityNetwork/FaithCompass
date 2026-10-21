# Competitive Benchmark v2: the integrated pipeline on held-out cases (decision-evidence-v2)

Status: branch `v5-benchmark-lab-v2` (supersedes PR #20's branch, rebased onto production `45bf2f0`), **not deployed**.
**All 36 cases are fictional, authored test material, not client data.** No composite score. v1 results
(`COMPETITIVE_BENCHMARK_V1.md`, eval hash `0d69dc2e…8524`) are unchanged.

Raw data: `benchmarks/decision-evidence-v2/results/results.json` (scored run), `results/raw/eval/{A,B,D}/*.json`
(108 raw model calls with prompt, response, usage, fingerprint; no key), `results/failure-modes.json`.
v1 failure analysis: `benchmarks/decision-evidence-v1/results/failure-modes.json`.

## What changed since v1: v1 measured the old baseline, v2 measures the product

| | v1 | v2 |
|---|---|---|
| System under test | C = deterministic layer frozen at `cad6e95` | **D = integrated SDEP / Decision Twin pipeline** (`src/lib/evidence-graph/case-pipeline.ts`) |
| D | manual review (BLOCKED) | the pipeline; manual review is now **E (BLOCKED)** |
| Baselines | A, B, C | A, B, C **unchanged** (same code, model, prompt; C is a byte-for-byte frozen copy so product changes cannot move it) |
| Metrics | 8 + system metrics | the same 8, same code, Wilson 95% CIs; + review load, impact accuracy, graph integrity, seal replay, paired bootstrap (all pre-registered) |

## Protocol as executed (2026-10-21)

| Step | Commit | What |
|---|---|---|
| 1 | rebase | PR #20 rebased onto `claude/abrahammoses-research-instrument` (45bf2f0). v1 cases, hash and results unchanged; the duplicate vite fix was dropped as already applied. |
| 2 | `7c301d5` | v1 failure analysis (stored outputs, no calls). C frozen as a copy. Product rules designed from that analysis; AI-candidate layer; case pipeline; D adapter. **`PREREGISTRATION.md` (systems, metrics, hypotheses, claim rule) committed before any v2 case existed.** |
| 3 | `417d03d` | 36 v2 cases written and **hashed: `febdb7f4710eb04961cf207343d8f4786cfc10a7c0b69aced8b20cef918372c7`**. No system had run on them. Pushed. |
| 4 | harness commit | v2 harness (v1 metrics and adapters imported unchanged + D). Written before the run. |
| 5 | results commit | **One** scored run of A, B, D (C deterministic). The harness verified the hash and refuses a second run. |

No prompt, rule or threshold was changed after step 3. D's numbers on v1 (recall 110/113, hard-negative FP 8/79)
are post-hoc, because D's rules were designed from v1; they are not evidence and are not claimed.

## System D, as run

1. Sources → versions (SHA-256) → evidence spans (char locators, hash-anchored); one tenant per case.
2. Deterministic layer (product code, same structured facts as C) + rules added from the v1 analysis: legal forms,
   stated approximations (5% tolerance), currency unit words.
3. AI-candidate layer: one call per case, **A's prompt byte for byte** (`dev-validated-2`), gpt-4.1-mini-2025-04-14,
   temperature 0, seed 20261020. Candidates capped at POTENTIAL_CONFLICT and marked for human review.
4. Deterministic veto of candidates the rules can show to be consistent; version precedence (Supersedes edges).
5. Conclusion links from the AI layer, superseded spans replaced, dependencies read off the graph; integrity check;
   impact query; sealed digest.

Not exercised, stated rather than simulated: the counterfactual engine and the signed passport bundle are bound to
case DT-PC-001 and cannot take a benchmark case. The production deployment configures no AI provider (no model key in
Vercel), so in production D runs with the deterministic layer only.

## Results (36 eval cases, 145 planted conflicts, 99 planted hard negatives, 2,963 statement pairs; Wilson 95% CIs)

| Metric | A, plain LLM | B, RAG | C, old deterministic | **D, integrated pipeline** |
|---|---|---|---|---|
| Conflict recall | 99/145 = 0.683 [0.603, 0.753] | 115/145 = 0.793 [0.720, 0.851] | 90/145 = 0.621 [0.540, 0.696] | **135/145 = 0.931 [0.878, 0.962]** |
| Conflict precision | 99/181 = 0.547 [0.474, 0.618] | 115/168 = 0.685 [0.611, 0.750] | **90/99 = 0.909 [0.836, 0.951]** | 135/156 = 0.865 [0.803, 0.910] |
| FP rate, planted hard negatives | 73/99 = 0.737 [0.643, 0.814] | 52/99 = 0.525 [0.428, 0.621] | **9/99 = 0.091 [0.049, 0.164]** | **9/99 = 0.091 [0.049, 0.164]** |
| FP rate, all pairs | 82/2963 = 0.0277 | 53/2963 = 0.0179 | **9/2963 = 0.0030** | 21/2963 = 0.0071 |
| Class agreement on found | 86/99 = 0.869 | 95/115 = 0.826 | 90/90 = 1.00* | 99/135 = 0.733 [0.653, 0.801]** |
| Citation precision | 201/231 = 0.870 [0.821, 0.908] | 228/256 = 0.891 [0.847, 0.923] | n/a | 209/224 = 0.933 [0.893, 0.959] |
| Evidence recall | 123/143 = 0.860 [0.794, 0.908] | 141/143 = 0.986 [0.950, 0.996] | n/a | 133/143 = 0.930 [0.876, 0.962] |
| Dependency accuracy | 36/72 = 0.500 [0.388, 0.613] | 43/72 = 0.597 [0.482, 0.703] | n/a | 45/72 = 0.625 [0.510, 0.728] |
| Conflict impact accuracy (v2) | 95/99 = 0.960 [0.901, 0.984] | 113/115 = 0.983 [0.939, 0.995] | n/a | 123/135 = 0.911 [0.851, 0.948] |
| Spend, total / median per case | $0.2479 / $0.00090 | $0.0283 / $0.00079 | $0 | $0.1546 / $0.00090 |
| Latency p50 / p95 | 3.2 s / 232 s | 2.5 s / 3.6 s | 0.5 ms / 1.1 ms | 2.8 s / 236 s |

\* gold uses the deterministic layer's taxonomy (construction bias). \** by design: AI candidates are capped at
POTENTIAL_CONFLICT, so alias, synonym, fiscal-year-end and unlisted-unit conflicts found by the AI layer carry the
wrong class (36 of the 36 disagreements).

D only: 99 deterministic findings + 57 AI candidates shown (1.58 per case; 36 of them true conflicts); 65 candidates
vetoed (1.81 per case; **0 of them true conflicts**: 17 rounding/unit, 17 versions, 13 periods, 10 approximations,
5 effective dates, 3 legal entities). Graph integrity: 34/36 cases without errors (the 2 failures are the runaway
cases: conclusions with no evidence links, correctly flagged `MISSING_EVIDENCE`). Seal replay: CI rebuilds all 36
digests and every metric from the committed raw answers (`tests/benchmark-v2.test.ts`).

### Paired case-level bootstrap (pre-registered; 10 000 resamples, seed 20261021)

| Difference | Conflict recall | Hard-negative FP rate | Conflict precision |
|---|---|---|---|
| D − A | +0.248 [+0.141, +0.360] | −0.646 [−0.746, −0.533] | +0.318 [+0.221, +0.416] |
| D − B | +0.138 [+0.076, +0.196] | −0.434 [−0.504, −0.366] | +0.181 [+0.075, +0.290] |
| D − C | +0.310 [+0.206, +0.413] | 0.000 [−0.071, +0.069] | −0.044 [−0.119, +0.029] |

### Pre-registered hypotheses

| | Hypothesis | Result |
|---|---|---|
| H1 | D's recall > C's | **Supported**: +0.310 [+0.206, +0.413]; Wilson CIs separate |
| H2 | D's hard-negative FP rate < A's | **Supported**: −0.646 [−0.746, −0.533]; Wilson CIs separate |
| H3 | D's hard-negative FP rate not higher than C's (margin 0.05) | **Not supported**: observed 0, but the adverse bound +0.069 exceeds the 0.05 margin |
| H4 | D's recall not lower than A's (margin 0.05) | **Supported** (D is higher: +0.248 [+0.141, +0.360]); A's recall is depressed by 4 runaway generations, see below |

## Failure modes

### Uncovered by v1 (stored outputs, `failure-modes.json`)

| System | Misses (of 113) | False alarms | Main categories |
|---|---|---|---|
| A | 14 | 58, **all on planted hard negatives** (0 unplanted) | FAs: rounding 16, superseded 11, approximation 9, different period 8, subsidiary 6, legal entity 5, unit scale 3. Misses: potential 6. Class: interpretation→confirmed 8, fiscal-year-end→potential 5. Dependencies: superseded figures included 9, subsidiary figures 5. |
| B | 31 | 41 | Misses: fiscal year end 7, missing 5, potential 5, alias 4 (retrieval drops the definition sentence). FAs as A, fewer. |
| C | 33 | 23 | Misses: fiscal year end 11, alias 10, synonym 10, unit word 2 (definitions in the text it cannot read). FAs: legal entity 12 (suffix stripping), approximation 11 (no hedge rule). |
| C+A hybrid | 3 | 67 | Misses: synonym 2, fiscal year end 1. FAs: the union of both. |

What D changed in response (pre-registered): legal forms, approximation tolerance, currency unit words (C's FAs and
part of its misses); the AI layer for definitions in the text (C's misses); the deterministic veto (A's FAs on
pairs the rules can read); version precedence (A's superseded dependencies).

### On v2 (held out)

| Failure mode | Effect on D | Status |
|---|---|---|
| **Runaway generation** (new): no output-token cap in the frozen adapter; 6 of 108 calls (A 4, D 2, B 0) generated 32,768 tokens, unparseable | D falls back to deterministic-only in those cases: 7 of its 10 misses; integrity checker flags both cases. Cost **$0.317 of $0.431 (73%)**, about 4 minutes per call | Not fixable in v2 (frozen). Fix for v3: `max_tokens` cap and one retry |
| Subsidiary pairs ("X Nordic, a subsidiary") | 7/9 false alarms, all AI candidates; the veto cannot read different entity names (by design, so aliases stay visible) | Open |
| Part-year vs full-year ("H1 2025" vs "FY2025") | 2/4 false alarms; the period parser cannot place H1, so no veto | Open (half-year periods for the parser) |
| Cross-measure AI candidates | 12 unplanted false alarms (9 different measures, 3 an alias against another measure) | Open |
| Class capping | alias/synonym/FYE/unlisted-unit conflicts shown as POTENTIAL_CONFLICT | By design (AI cannot confirm); costs class agreement |
| v1 FA modes now vetoed | rounding 13/13, unit scale 8/8, other wording 5/5, years 14/14, restated 9/9, corrected 9/9, legal entity 9/9, approximation 10/10, effective date 9/9 correct; **no vetoed pair was a true conflict** | Closed on this set |
| v1 miss modes | alias 14/21, synonym 8/10, FYE 9/10, unit words 14/14, Ltd/Limited 9/9, far approximation 9/9 | Remaining misses are in the runaway cases except 3 |
| C on v2 | approx_near 9/10 false alarms (no hedge rule); all definition-dependent plants missed (55) | Expected; C is frozen |

## Cost

v2 scored run: **USD 0.43086** (A $0.2479, B $0.0283, D $0.1546), cap $2. Of this, $0.3168 was the 6 runaway
generations; without them the run cost about $0.11. The failure analyses re-scored stored outputs (no calls).
Pricing: $0.40 / 1M input, $1.60 / 1M output tokens (gpt-4.1-mini-2025-04-14).

## Limitations

Synthetic, template-generated cases (three sentence templates); one model, one prompt, one run; the same author
wrote the cases, the v1 analysis and D's rules (several v2 plants target those rules, but shared blind spots remain
possible); 36 cases, so pair-level intervals are optimistic and the case bootstrap is primary; OpenAI's seed is
best-effort (raw outputs are the record). Nothing here says anything about real documents, real customers, or named
competitors. Manual review (E) and review time are BLOCKED: no reviewers.

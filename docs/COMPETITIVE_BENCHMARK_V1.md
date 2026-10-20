# Competitive Benchmark v1: decision-evidence-v1 (Phase 6)

Status: branch `v5-benchmark-lab` (PR #20), not deployed. **All 40 cases are fictional.** There is no composite score.
Raw data:
- `benchmarks/decision-evidence-v1/results/results.json`: the scored eval run.
- `results/raw/eval/{A,B}/*.json`: 56 raw model calls, with prompt, response, usage and fingerprint. No API key.
- `results/dev-validation-{1,2}/`: the dev prompt validation runs.
- `results/posthoc.json`: post-hoc analyses.

## Protocol as executed

| Step | Commit | What |
|---|---|---|
| 1 | `3afeb22` | 40 cases, gold and split committed. Eval set hashed: `eval_set_sha256 = 0d69dc2e51f9a74dc0322eedacb7fb20fd4e46bfbaf6b6742a88c07ea7418524` (28 files). No system had run. |
| 2 | `6b4fd91` | Harness, metrics and baseline C committed (debugged on dev only) |
| 3 | `7426bf8` | First scored run: C on dev+eval (A/B/D blocked) |
| 4 | `b3cb267` | A/B adapters for OpenAI. Two prompt-validation rounds on **dev only**. Prompt frozen as `dev-validated-2`. |
| 5 | (this commit) | **One** scored eval run of A, B, C. The harness re-verified the eval hash (`ok`) and refuses a second A/B eval run. |

The only dev revision was a sentence listing the non-conflict cases that C's rules already encode: different
periods, superseded versions, unit scale, rounding and different entities. On dev, A's hard-negative false positives
were 26/33 in both rounds, so the revision did not reduce them.

### Model configuration (A and B)

- **Model:** `gpt-4.1-mini-2025-04-14`, a pinned snapshot, the same for A and B. Chosen because it supports
  `temperature` 0 and `seed`, which the GPT-5 reasoning models do not.
- **Settings:** OpenAI Chat Completions, temperature 0, seed 20261020, `response_format: json_object`.
- **Pricing used for cost:** $0.40 per 1M input tokens and $1.60 per 1M output tokens (OpenAI model page, 2026-10-21).
- **Reproducibility:** the 56 eval calls returned 4 different `system_fingerprint` values. OpenAI's seed is
  best-effort, so a rerun may not give identical outputs; that is why the raw outputs are committed.
- **A:** all three raw documents in one prompt, with each citable statement labelled `[Dn#sm]` in place.
- **B:** the raw documents are split into sentence chunks, including the definition sentences. BM25 retrieves the
  top 10 chunks per conclusion; the LLM sees only those and must cite labels.
- **Budget:** cost was estimated before every run (eval estimate $0.15) against a $5 cap, enforced in code.
  Actual spend over all three runs was **$0.0804** (dev 1: $0.0187, dev 2: $0.0189, eval: $0.0428).

## Baseline status

| | Baseline | Status |
|---|---|---|
| A | plain LLM over the raw documents | RAN (eval, 28 cases) |
| B | RAG over the raw documents, with citations | RAN (eval, 28 cases) |
| C | previous Decision Twin, deterministic layer over the structured facts (unchanged since `cad6e95`) | RAN |
| D | manual review | **BLOCKED**: no reviewers recruited |

## Eval results (28 cases; Wilson 95% CIs at pair level)

| Metric | A, plain LLM | B, RAG | C, deterministic |
|---|---|---|---|
| Conflict recall | 99/113 = **0.876** [0.803, 0.925] | 82/113 = 0.726 [0.637, 0.800] | 80/113 = 0.708 [0.618, 0.784] |
| Conflict precision | 99/157 = 0.631 [0.553, 0.702] | 82/123 = 0.667 [0.579, 0.744] | 80/103 = **0.777** [0.687, 0.846] |
| FP rate, planted hard negatives | 58/79 = 0.734 [0.628, 0.819] | 40/79 = 0.506 [0.398, 0.614] | 23/79 = **0.291** [0.203, 0.399] |
| FP rate, all statement pairs | 58/2,351 = 0.0247 [0.0191, 0.0318] | 41/2,351 = 0.0174 [0.0129, 0.0236] | 23/2,351 = **0.0098** [0.0065, 0.0146] |
| Class agreement on found conflicts | 81/99 = 0.818 [0.731, 0.882] | 67/82 = 0.817 [0.720, 0.886] | 80/80 = 1.00 [0.954, 1.00]* |
| Citation precision | 135/150 = 0.900 [0.842, 0.939] | 124/138 = 0.899 [0.837, 0.939] | not applicable |
| Evidence recall | 80/84 = 0.952 [0.884, 0.981] | 78/84 = 0.929 [0.853, 0.967] | not applicable |
| Dependency accuracy (exact set) | 37/56 = 0.661 [0.530, 0.771] | 33/56 = 0.589 [0.459, 0.708] | not applicable |
| Cost per case | $0.00083 | $0.00070 | $0 |
| Latency per case, p50 / p95 | 2,047 / 2,531 ms | 1,894 / 2,292 ms | 0.62 / 2.2 ms |

\* By construction: the gold classes use the same five-class taxonomy that C implements.

Pairs within one case are not independent, so the Wilson intervals are optimistic. A post-hoc check (below) uses a
paired bootstrap over cases.

### Where A or B beat C, and where C wins (per plant type, eval; Wilson 95%)

| Plant (gold) | A | B | C | Separated? |
|---|---|---|---|---|
| alias, defined abbreviation (conflict) | 10/10 [0.72, 1.00] | 6/10 [0.31, 0.83] | 0/10 [0.00, 0.28] | A > C, B > C |
| synonym (conflict) | 8/10 [0.49, 0.94] | 7/10 [0.40, 0.89] | 0/10 [0.00, 0.28] | A > C, B > C |
| fiscal_year_end (conflict) | 10/11 [0.62, 0.98] | 4/11 [0.15, 0.65] | 0/11 [0.00, 0.26] | A > C; B overlaps |
| legal_entity, AB vs Ltd (non-conflict) | 7/12 [0.32, 0.81] | 11/12 [0.65, 0.99] | 0/12 [0.00, 0.24] | A > C, B > C |
| unit_word (conflict) | 2/2 | 1/2 | 0/2 | overlap (n = 2) |
| superseded (non-conflict) | 0/11 [0.00, 0.26] | 1/11 [0.02, 0.38] | 11/11 [0.74, 1.00] | C > A, C > B |
| rounding (non-conflict) | 3/19 [0.06, 0.38] | 8/19 [0.23, 0.64] | 19/19 [0.83, 1.00] | C > A, C > B |
| diff_period (non-conflict) | 3/11 [0.10, 0.57] | 7/11 [0.35, 0.85] | 11/11 [0.74, 1.00] | C > A; B overlaps |
| diff_entity (non-conflict) | 5/11 [0.21, 0.72] | 6/11 [0.28, 0.79] | 11/11 [0.74, 1.00] | C > A; B overlaps |
| potential (conflict) | 6/12 [0.25, 0.75] | 7/12 [0.32, 0.81] | 12/12 [0.76, 1.00] | C > A; B overlaps |
| confirmed, basis, missing, exclusive, interpretation, approximation, unit_scale | | | | all overlap |

"Correct" means a conflict found (gold ≠ NONE) or, for a non-conflict, no finding. These are 17 plant types × 2
comparisons with no multiplicity correction; treat the table as descriptive.

In short: the LLM resolves meaning that is stated in the text (abbreviations, synonyms, fiscal year ends, distinct
legal entities). It also flags most consistent pairs: superseded figures, rounding, other periods, subsidiaries. C is
the reverse.

## Post-hoc analyses (NOT preregistered; disclosed experiment)

**Paired case-level bootstrap** (28 cases, 10,000 resamples, seed 20261021). Differences are A−C or B−C.

| Difference | Observed | 95% CI |
|---|---|---|
| A−C conflict recall | +0.168 | [+0.038, +0.306] |
| A−C hard-negative FP rate | +0.443 | [+0.205, +0.635] |
| A−C precision | −0.146 | [−0.268, −0.038] |
| B−C conflict recall | +0.018 | [−0.092, +0.130] |
| B−C hard-negative FP rate | +0.215 | [−0.039, +0.421] |
| B−C precision | −0.110 | [−0.249, +0.014] |

**Hybrid (post-hoc).** C stays deterministic and is the only source of findings. A's (or B's) findings on pairs C
did not flag are added as candidates for human review, with CONFIRMED_CONFLICT capped at POTENTIAL_CONFLICT (the
`combineLayers` rule). No new API calls: it reuses the stored eval outputs.

| | Flagged recall | Hard-negative FP | Precision | Review candidates | True conflicts among candidates |
|---|---|---|---|---|---|
| H-A (C + A candidates) | 110/113 = 0.973 [0.925, 0.991] | 67/79 = 0.848 [0.753, 0.911] | 0.622 [0.548, 0.690] | 74 (2.64 per case) | 30 / 74 |
| H-B (C + B candidates) | 98/113 = 0.867 [0.793, 0.918] | 57/79 = 0.722 [0.614, 0.808] | 0.628 [0.550, 0.700] | 53 (1.89 per case) | 18 / 53 |

The hybrid recovers the conflicts C misses, but most of its candidates are not conflicts (44 of 74 for H-A). The
cost moves to the human reviewer. This is exploratory and is not used for any claim.

## System-level metrics (not per case)

| Metric | Result |
|---|---|
| Replay fidelity (pinned passports, formats 1–3) | 4/4 reproduced |
| Passport integrity: tamper detection (conformance fixtures) | 7/7 rejected; 5/5 valid accepted |
| Unauthorized-access failures | not measured by this benchmark (covered by the CI security and Firestore-rules suites) |
| Review time | BLOCKED (needs D) |

## Limits

- **Synthetic data.** The text and gold are template-generated. The author of the cases also wrote C and the
  prompts, and six plant types were designed to probe C's blind spots. These rates are not estimates for real
  documents.
- **Different inputs.** C reads annotator-style structured facts; A and B read raw text.
- **One model, one prompt, one run.** No other model, prompt or k was tried on eval.
- **No human baseline.** D is blocked, so nothing here compares against human reviewers.

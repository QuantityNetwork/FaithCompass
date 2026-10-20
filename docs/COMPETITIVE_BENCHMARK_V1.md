# Competitive Benchmark v1 — decision-evidence-v1 (Phase 6)

Status: branch `v5-benchmark-lab`, not deployed. **All 40 cases are fictional.** No composite score.
Raw output: `benchmarks/decision-evidence-v1/results/results.json` (harness `benchmarks/decision-evidence-v1/harness/`).

## Protocol as executed

1. `3afeb22`: the 40 cases, gold and split were committed, with the eval set hashed
   (`eval_set_sha256 = 0d69dc2e51f9a74dc0322eedacb7fb20fd4e46bfbaf6b6742a88c07ea7418524`, 28 files). No system had been run.
2. `6b4fd91`: the harness and adapters were committed. They had been debugged on dev only.
3. Then the single scored run on dev and eval. The harness re-verified the manifest first (`ok`). Baseline C is
   `src/lib/contradiction/` unchanged from merge `cad6e95`; nothing was tuned on eval.

## Baseline status

| | Baseline | Status |
|---|---|---|
| A | plain LLM over the documents | **BLOCKED**: no API key configured; adapter built, no call made |
| B | RAG (BM25 top-8 per conclusion → LLM) | **BLOCKED**: no API key configured; retrieval implemented, no call made |
| C | previous Decision Twin, deterministic layer over structured facts | **RAN** |
| D | manual review | **BLOCKED**: no reviewers recruited |

With only C measured there is **no comparison**: this run does not support any claim that one system beats another.

## Baseline C results (eval, 28 cases; dev in brackets, 12 cases)

| Metric | Eval | 95% CI (Wilson) | Dev |
|---|---|---|---|
| Conflict recall (gold class ≠ NONE found) | 80 / 113 = 0.708 | 0.618–0.784 | 33 / 51 = 0.647 |
| Conflict precision | 80 / 103 = 0.777 | 0.687–0.846 | 33 / 40 = 0.825 |
| False-positive rate, all statement pairs | 23 / 2 351 = 0.0098 | 0.0065–0.0146 | 7 / 1 057 |
| False-positive rate, planted hard negatives | 23 / 79 = 0.291 | 0.203–0.399 | 7 / 33 = 0.212 |
| Class agreement on found conflicts | 80 / 80 = 1.00 | 0.954–1.00 | 33 / 33 |
| Citation precision / evidence recall | NOT APPLICABLE: C does not read text or conclusions | | |
| Dependency accuracy | NOT APPLICABLE: C builds no dependency graph for these cases | | |
| Cost per case | $0 (no API); compute p50 0.39 ms, p95 0.97 ms | | |

The CIs treat statement pairs as independent; pairs within one case are not, so the intervals are optimistic.
Class agreement is 100% partly by construction: gold classes use the same five-class taxonomy C implements.

### Failures (published)

Recall by plant type (eval): C finds none of the conflicts that need knowledge outside its normalisation rules:

| Plant | Gold | C correct | Why |
|---|---|---|---|
| alias | CONFIRMED_CONFLICT | 0 / 10 | does not resolve defined abbreviations |
| synonym | CONFIRMED_CONFLICT | 0 / 10 | concepts compared by name only |
| fiscal_year_end | CONFIRMED_CONFLICT | 0 / 11 | reads FY as the calendar year |
| unit_word | CONFIRMED_CONFLICT | 0 / 2 | "USD million" is not in its unit table |
| legal_entity (negative) | NONE | 0 / 12 | strips "AB"/"Ltd" and merges two legal entities → false positive |
| approximation (negative) | NONE | 1 / 12 | ignores "approximately" → false positive |

All other plant types: 100% (confirmed 20/20, basis 12/12, potential 12/12, missing 12/12, interpretation 12/12,
exclusive 12/12; negatives diff_entity 11/11, diff_period 11/11, rounding 19/19, superseded 11/11, unit_scale 3/3).

Per domain (eval) conflict recall: contract 20/27, M&A 19/30, private credit 21/29, scholarly 20/27.

## System-level metrics (not per case)

| Metric | Result |
|---|---|
| Replay fidelity (pinned passports, formats 1–3) | 4 / 4 REPRODUCED (CI 0.51–1.00) |
| Passport integrity: tamper detection (conformance fixtures) | 7 / 7 rejected (CI 0.65–1.00) |
| Passport integrity: valid fixtures accepted | 5 / 5 |
| Unauthorized-access failures | not measured by this benchmark (covered by the CI security and Firestore-rules suites) |
| Review time | BLOCKED (needs D) |

## Limits

* Synthetic, template-generated text and gold. The author of the cases also wrote C.
* C receives annotator-style structured facts (an oracle extraction step); A/B/D would read raw text. C's numbers
  are therefore not comparable with text-reading systems without that caveat.
* Six plant types were added specifically to probe C's blind spots, so C's recall here is not an estimate of
  real-world recall.
* Brief targets: "≥1 meaningful held-out improvement" is **not** met — nothing has been compared yet.

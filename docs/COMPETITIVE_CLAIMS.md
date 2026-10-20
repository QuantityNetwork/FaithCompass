# Competitive Claims Register

Rule: a comparative claim is **APPROVED** only when the 95% intervals of the two systems do not overlap on the
preregistered eval run. For headline metrics, the post-hoc paired case bootstrap must also exclude 0. A claim is
scoped to what was measured. Everything else is **UNSUPPORTED** (or **BLOCKED** when the comparison could not run).
Source: `docs/COMPETITIVE_BENCHMARK_V1.md`, eval split of decision-evidence-v1 (28 fictional cases), run 2026-10-21.

Every approved claim must carry this scope: "on a synthetic, fictional benchmark built by us; one model
(gpt-4.1-mini-2025-04-14), one prompt".

## Approved (scoped)

| # | Claim | Evidence |
|---|---|---|
| 1 | The deterministic layer (C) produces fewer false conflicts on planted consistent pairs than a plain LLM (A) | hard-negative FP 0.291 [0.203, 0.399] vs 0.734 [0.628, 0.819]; bootstrap A−C +0.443 [+0.205, +0.635] |
| 2 | A plain LLM (A) finds more of the planted conflicts than the deterministic layer (C) | recall 0.876 [0.803, 0.925] vs 0.708 [0.618, 0.784]; bootstrap +0.168 [+0.038, +0.306] |
| 3 | C does not resolve abbreviations, synonyms or fiscal year ends defined in the text, and A does: alias 10/10 vs 0/10, synonym 8/10 vs 0/10, fiscal_year_end 10/11 vs 0/11 | per-plant Wilson CIs separate (descriptive, no multiplicity correction) |
| 4 | C flags distinct legal entities ("X AB" / "X Ltd") as one; A and B do not as often: 0/12 correct vs 7/12 and 11/12 | per-plant CIs separate (descriptive) |
| 5 | C does not flag superseded figures or rounding differences; A and B mostly do: superseded 11/11 vs 0/11 and 1/11; rounding 19/19 vs 3/19 and 8/19 | per-plant CIs separate (descriptive) |
| 6 | C runs at $0 API cost and sub-millisecond median latency per case; A and B cost $0.00083 and $0.00070 per case at about 2 s median | measured; not a statistical comparison |

Claims 1 and 2 together mean that neither A nor C is better overall: they trade recall against false positives.

## Unsupported

| Claim | Why |
|---|---|
| RAG (B) finds more conflicts than C | 0.726 [0.637, 0.800] vs 0.708 [0.618, 0.784]: overlap; bootstrap [−0.092, +0.130] |
| C has fewer false positives than RAG (B) | 0.291 [0.203, 0.399] vs 0.506 [0.398, 0.614]: intervals touch (overlap by 0.001); bootstrap [−0.039, +0.421] |
| C is more precise than A or B | Wilson intervals overlap (A [0.553, 0.702] vs C [0.687, 0.846]). The bootstrap A−C excludes 0, but the register rule requires both. |
| C classifies conflicts more accurately | CIs separate (1.00 vs 0.818), but gold uses C's own taxonomy (construction bias); not approved |
| Any claim about citations, evidence recall or dependency accuracy versus C | C produces none of these; no comparator |
| A cites better than B (or the reverse) | 0.900 vs 0.899; overlap |
| The hybrid (C + LLM candidates) is better | post-hoc, not preregistered; it also raises false positives |
| Any claim about real documents, real customers or named competitors | not measured |
| "≥1 meaningful held-out improvement" (brief target) | no improvement to the Decision Twin has been tested; only baselines were compared |

## Blocked

| Claim | Why |
|---|---|
| Any comparison with manual review (D), including review time | no reviewers recruited |

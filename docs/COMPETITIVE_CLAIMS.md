# Competitive Claims Register

Two benchmark versions. **v2 (below, first)** measures the integrated pipeline on held-out cases; **v1** (further
down, unchanged) measured the old baseline.

## v2: decision-evidence-v2 (36 fictional held-out cases, eval hash `febdb7f4…72c7`, run 2026-10-21)

Rule (pre-registered in `benchmarks/decision-evidence-v2/PREREGISTRATION.md`, plus the v1 register rule): a
comparative claim is **APPROVED** only when the paired case bootstrap 95% interval excludes 0 in the stated direction
**and** the two systems' Wilson intervals do not overlap. "Not worse" claims need the adverse bootstrap bound within
0.05. Source: `docs/COMPETITIVE_BENCHMARK_V2.md`. Every approved claim carries the scope: "on a synthetic, fictional
benchmark authored by us; one model (gpt-4.1-mini-2025-04-14), one prompt, one run".

### Approved (scoped)

| # | Claim | Evidence | Pre-registered? |
|---|---|---|---|
| V2-1 | The integrated pipeline (D) finds more of the planted conflicts than the previous Decision Twin (C) | recall 0.931 [0.878, 0.962] vs 0.621 [0.540, 0.696]; D−C +0.310 [+0.206, +0.413] | yes (H1) |
| V2-2 | D produces fewer false conflicts on planted consistent pairs than a plain LLM (A) | 0.091 [0.049, 0.164] vs 0.737 [0.643, 0.814]; D−A −0.646 [−0.746, −0.533] | yes (H2) |
| V2-3 | D's conflict recall is not lower than A's | D−A +0.248 [+0.141, +0.360] (A's recall is lowered by 4 runaway generations) | yes (H4) |
| V2-4 | D finds more planted conflicts and raises fewer false conflicts than RAG (B) | recall 0.931 vs 0.793 [0.720, 0.851], D−B +0.138 [+0.076, +0.196]; hard-negative FP 0.091 vs 0.525 [0.428, 0.621], D−B −0.434 [−0.504, −0.366] | analysis yes, hypothesis no (secondary) |
| V2-5 | D is more precise than A and B | 0.865 [0.803, 0.910] vs 0.547 [0.474, 0.618] and 0.685 [0.611, 0.750]; D−A +0.318 [+0.221, +0.416], D−B +0.181 [+0.075, +0.290] | analysis yes, hypothesis no (secondary) |
| V2-6 | The deterministic veto withheld 65 AI candidates and none was a true conflict | 0/65 (Wilson [0, 0.056]) | descriptive |

V2-1 is the first held-out improvement of the Decision Twin measured against its own previous version.

### Unsupported (v2)

| Claim | Why |
|---|---|
| D raises no more false conflicts than C | H3 not supported: D−C 0.000 [−0.071, +0.069], the adverse bound exceeds the 0.05 margin |
| D is as precise as C, or more | D−C −0.044 [−0.119, +0.029]; Wilson intervals overlap |
| D cites better, recalls evidence better or maps dependencies better than A or B | citation precision 0.933 vs 0.870 / 0.891, dependency accuracy 0.625 vs 0.500 / 0.597: intervals overlap |
| D maps the impact of a conflict on conclusions better | D 0.911 is lower than A 0.960 and B 0.983 (intervals overlap) |
| D classifies conflicts better | D 0.733 is lowest, by design (AI candidates capped at POTENTIAL_CONFLICT) |
| D is cheaper or faster than A or B | same model call per case; the local pipeline work was not timed separately. Not a claim either way |
| Any claim about real documents, customers, named competitors, or production behaviour with an AI provider | not measured; production configures no AI provider |

### Blocked (v2)

| Claim | Why |
|---|---|
| Any comparison with manual review (E), including review time | no reviewers recruited |
| Counterfactual engine or signed passport on benchmark cases | both bound to case DT-PC-001 |

---

## v1: decision-evidence-v1 (unchanged)

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
| "≥1 meaningful held-out improvement" (brief target) | not on v1 (only baselines were compared); see v2 claim V2-1 |

## Blocked

| Claim | Why |
|---|---|
| Any comparison with manual review (D), including review time | no reviewers recruited |

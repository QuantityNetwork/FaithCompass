# decision-evidence-v2: pre-registration

Written and committed on 2026-10-21 **before any v2 case existed** (the v2 cases are written in the next commit and
hashed before any system runs on them). Nothing below may change after the v2 run; a change needs a v3.

## Why v2

v1 (eval set `0d69dc2e…8524`) measured the old baseline: the deterministic layer frozen at merge cad6e95 (C) against a
plain LLM (A) and RAG (B). It did not measure the product as now built (SDEP evidence graph, integrity checker,
contradiction layers, supersession, sealed digest). v1 results stay unchanged in `../decision-evidence-v1/`.
v1 is now consumed: its failure analysis (`../decision-evidence-v1/results/failure-modes.json`) was used to design
the rules below, so **D's numbers on v1 are post-hoc and not evidence**. v2 is the held-out test.

## Systems (fixed)

| | System | Definition |
|---|---|---|
| A | plain LLM | v1 code unchanged: gpt-4.1-mini-2025-04-14, temperature 0, seed 20261020, prompt `dev-validated-2` |
| B | RAG | v1 code unchanged: BM25 top-10 sentence chunks per conclusion, same model and prompt |
| C | previous Decision Twin | v1 code unchanged; deterministic layer as at cad6e95, now a frozen copy in `../decision-evidence-v1/harness/frozen-c/` |
| D | **integrated SDEP / Decision Twin pipeline** | `src/lib/evidence-graph/case-pipeline.ts` (`case-pipeline/1.0.0`) with the AI-candidate layer `src/lib/contradiction/ai-candidates.ts`; adapter `harness/system-d.ts` |
| E | manual review by qualified reviewers | **BLOCKED**: no reviewers recruited. Not estimated. |

### D, exactly

1. Sources → versions (content SHA-256) → evidence spans (character locator, hash-anchored), one tenant per case.
2. Deterministic contradiction layer (product code, same structured facts C receives), with the rules added on
   2026-10-21 from the v1 failure analysis:
   - **legal forms**: "X AB" and "X Ltd" are different legal entities; "Ltd" and "Limited" are one form;
   - **stated approximations**: tolerance 5% (instead of 0.5%) when either value is hedged ("approximately", "around", …);
   - **currency unit words**: `<currency><scale>` units ("USD million", "EUR m", "SEK thousand", "€bn") for USD, EUR, GBP, SEK, NOK, DKK, CHF.
3. AI-candidate layer: one model call per case with **A's prompt, byte for byte** (`dev-validated-2`), same model,
   temperature and seed. Its pairs become candidates: on pairs the deterministic layer already flagged the
   deterministic finding wins; classes are capped at POTENTIAL_CONFLICT; all are marked for human review.
4. **Deterministic veto** (`deterministicVeto`): a candidate is withheld (kept in an audit list) when, on the same
   normalised entity and measure, the values agree within tolerance, the periods do not overlap, the versions or
   effective dates differ, or the legal forms differ. Pairs the rules cannot read (different entity or measure names)
   are never vetoed.
5. Version precedence (`supersedes`): same entity and measure, both versions stated, exactly one says it supersedes /
   amends / restates / replaces / revises / corrects → Supersedes edge.
6. Conclusions depend on the spans the AI layer proposes (citations ∪ dependencies), with superseded spans replaced
   by their replacement; dependencies are read off the graph (`dependenciesOf`).
7. Integrity check (`checkIntegrity`), impact of each contradiction (`conclusionsDependingOn`), seal (`sdepDigest`).

Scored findings of D = deterministic findings + surviving AI candidates (as the product shows them).

Not exercised by this benchmark, stated rather than simulated: the counterfactual engine (`src/lib/counterfactual`)
and the signed passport bundle are bound to the Decision Twin case DT-PC-001 and cannot take a benchmark case. D uses
the graph-level impact query instead; passport integrity and replay fidelity stay the v1 system metrics.

## Metrics

Unchanged from v1 (`../decision-evidence-v1/harness/metrics.ts`, Wilson 95% intervals, no composite score):
conflict recall, conflict precision, false-positive rate over all pairs and over planted hard negatives, class
agreement on found conflicts, citation precision, evidence recall, dependency accuracy, cost and time per case.

Added for v2 (defined here, before the run):
- **review load**: AI candidates shown per case, and vetoed candidates per case (D only);
- **conflict impact accuracy**: over gold conflicts a system found, the share where the set of conclusions it says
  depend on either statement equals the gold set (systems that produce dependencies: A, B, D);
- **graph integrity**: share of cases whose D graph has no integrity error;
- **seal replay**: share of cases where rebuilding D from the committed raw model answer gives the same digest (CI test);
- **paired case-level bootstrap** (10 000 resamples, seed 20261021) of D−A, D−B, D−C for conflict recall,
  hard-negative FPR and conflict precision (in v1 this was post-hoc; here it is pre-registered).

## Hypotheses and claim rule

- H1: D's conflict recall is higher than C's.
- H2: D's hard-negative false-positive rate is lower than A's.
- H3: D's hard-negative false-positive rate is not higher than C's.
- H4: D's conflict recall is not lower than A's.

A claim is made only when the paired bootstrap 95% interval of the difference excludes 0 in the stated direction
(H1, H2), or, for "not worse" (H3, H4), when the interval's adverse bound is within 0.05. Otherwise: not supported.

## Protocol

- One scored run of A, B, D on v2 eval; C is deterministic. Spend cap USD 2 (`--usd-cap 2`).
- Raw model outputs committed. No prompt, rule or threshold changes after the run.
- Every v2 case is authored test material (fictional), not client data.

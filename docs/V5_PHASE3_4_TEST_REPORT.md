# V5 Phase 3 + 4 – Test Report

Scope: evidence-graph API, contradiction engine (normalisation + layers), counterfactual engine, historical replay.
Every number below is from `npx vitest run` and `npx tsx scripts/v5-report.ts` on branch `v5-sdep-baseline`
(Node 22.20.0, 8-core Intel Xeon build box, 2026-10-20). Timings depend on the machine; everything else is
deterministic. All data is the **synthetic** Decision Twin case DT-PC-001. No AI was called anywhere. No
benchmark against other systems has been run; nothing here is a comparative claim.

## Test suite

| | Result |
|---|---|
| Whole suite | 441 passed, 20 skipped (emulator/database suites skipped locally, run in CI), 0 failed; 31 files passed, 3 skipped |
| New in phases 1–4 | 54 tests in `tests/evidence-graph.test.ts` (20), `evidence-graph-api.test.ts` (5), `contradiction.test.ts` (8), `counterfactual.test.ts` (7), `replay.test.ts` (14) |
| Typecheck | `tsc --noEmit` clean |

## 1. Evidence-graph API

- `GET /api/v1/evidence-graph`: the SDEP 0.1 document with its integrity report. It has 103 nodes, 166 edges and 0 findings.
- `GET /api/v1/evidence-graph/impact?passage=<node id>&paths=<1–20>`: every conclusion and decision condition that depends on the passage. Each one comes with its dependency paths (shortest first, each step showing the edge type) and the total number of paths. An unknown passage returns 404; an out-of-range `paths` value returns 400.
- MCP tool `evidence_impact`: answers the same query (read-only).

For `span:DOC-03#total_debt` (the debt schedule's total debt), the results were:

| Depending node | Distinct paths |
|---|---|
| `dt:conclusion` | 3 |
| `dt:k.leverage` | 1 (span → in.debt → m.leverage → k.leverage) |
| `dt:k.stress` | 1 |
| `dt:k.debtReconciled` | 1 |

Impact isolation: `span:DOC-05#min_liquidity` reaches `k.liquidity` and does not reach `k.leverage` or `k.debtReconciled`. When all paths fit within the limit, the number of enumerated paths equals the counted total (tested).

Timing: the impact query has a median of 38 µs (p95 78 µs, 2,000 runs). A full integrity check has a median of 1.9 ms (p95 3.2 ms, 200 runs).

## 2. Contradiction engine

Normalisation (`src/lib/contradiction/normalize.ts`) works on each dimension as follows:

| Dimension | Rule |
|---|---|
| Entity | Case-folded; legal suffixes removed |
| Concept | Case-folded |
| Period | FY / LTM / quarter forms canonicalised, with calendar ranges (fiscal year read as calendar year: stated assumption) |
| Unit | Currency scale converted to USD millions; % and bp; ratios |
| Basis, definition, scope | Folded text |
| Version | Folded text |
| Effective date | Converted to ISO |
| Mutual exclusivity | By option group |

The deterministic layer (`detect.ts`) applies these rules:
- Different entity or unit dimension, or non-overlapping periods: not comparable, so no finding.
- A difference only in period, version or effective date: two separate facts, so no finding.
- A difference in basis, definition or scope: DIFFERENT_REPORTING_BASIS.
- Text values that differ: UNRESOLVED_INTERPRETATION.
- Context known on one side only: POTENTIAL_CONFLICT.
- One side has no value: MISSING_EVIDENCE.
- Same context, values differ by more than 0.5% after unit scaling: CONFIRMED_CONFLICT.
- Two mutually exclusive options asserted together: CONFIRMED_CONFLICT.

The AI-candidate layer is an interface only. The single source shipped, `NO_AI_CANDIDATES`, has no provider configured, makes no calls and returns nothing. A fixture source in the tests shows that candidates stay in a separate list, are capped at POTENTIAL_CONFLICT, are flagged for human review, are dropped if they cite unknown references, and never change the deterministic findings.

Results on the Decision Twin documents (38 fields, 703 pairs compared, 4 findings, median 2.8 ms):

| Curated entry | Class | Deterministic layer |
|---|---|---|
| X-01 total debt 124 vs 118 | CONFIRMED_CONFLICT | found, same class |
| X-02 volume growth vs renewal intent | POTENTIAL_CONFLICT | **not found**: different concepts; needs reading the text |
| X-03 reported EBITDA FY2025 vs adjusted LTM | DIFFERENT_REPORTING_BASIS | found, same class (period, basis differ) |
| X-04 appraisal not provided | MISSING_EVIDENCE | **not found**: the data records a value; the absence of the appraisal is only stated in text |
| X-05 add-back cap "None" vs "10% of EBITDA" | UNRESOLVED_INTERPRETATION | found, same class |

There was one finding outside the curated map: DOC-09 restates DOC-01's reported EBITDA, so DOC-09 differs from the memo's adjusted LTM figure in the same way as X-03. In total, the deterministic layer found 3 of the 5 curated entries with the correct class. Of its 4 findings, 3 are in the map; the 4th is a restatement of X-03, not a new conflict. These are measurements against our own curated map for one synthetic case, not recall or precision on a benchmark.

## 3. Counterfactual engine

Pipeline: mutate assumptions → `recalculate` (live engine; recomputes only the changed inputs and their dependents and carries every other node over) → condition states MET / NOT_MET / EVIDENCE_MISSING / NEEDS_HUMAN_JUDGMENT → structured diff. Each change in the diff is labelled `assumption`, `judgment` (premises, verification choices, conditions needing human judgment), `stress` (stress-case nodes) or `arithmetic`.

The oracle has 56 mutations:
- each control at min, max and default ± one step;
- each premise rejected, and all premises rejected;
- three verification sets;
- 21 pairs of control extremes.

The oracle itself is brute force: a full evaluation of both scenarios, compared node by node.

| Measure | Result |
|---|---|
| Selective result identical to full evaluation (all 38 nodes) | 56 / 56 |
| Diff equals the oracle exactly | 56 / 56 |
| Expected changes across all mutations | 543 |
| Missing (expected, not reported) | 0 |
| Unexpected (reported, not expected) | 0 |
| Recomputed set equals the reachable set | 56 / 56 |
| Condition state changes across the oracle | 33 |
| Mean nodes recomputed | 12.8 of 38 |

Hand-checked cases:
- Debt at the memo figure ($118M): 7 changes, including `k.debtReconciled`, which stays NEEDS_HUMAN_JUDGMENT.
- Interest at $20M: `k.coverage` goes MET → NOT_MET, the stress warning activates and the conclusion changes.
- Rejecting P1: 1 judgment, 4 stress and 9 arithmetic changes.

The constant EVIDENCE_MISSING and NEEDS_HUMAN_JUDGMENT conditions never change under any mutation.

Timings (5,000 runs each, debt = 118):

| Operation | Median | p95 |
|---|---|---|
| Full evaluation | 12 µs | 17 µs |
| Selective recalculation | 12 µs | 20 µs |
| Counterfactual including diff | 103 µs | 133 µs |

On this 38-node graph, selective recalculation is **not faster** than full evaluation. Its value here is the explicit recomputed set and its proof against the oracle; any speed benefit would only show on larger graphs and has not been measured.

## 4. Historical replay

The three operations are separate:

| Operation | Function | Result for the four pinned passports (format 1 `0f1ee5e…`, format 2 `e921f15…` and `866039e…`, format 3 `09509fb…`) |
|---|---|---|
| Verify | `verifyOperation` | VALID ×4 |
| Deterministic replay | `deterministicReplay` | REPRODUCED ×4. Each replay passed 13 component checks: 10 source documents, the ruleset, the case archive and the engine source |
| Historical AI review | `historicalAiReview` | NOT_APPLICABLE: "no AI was used". The passport records model `none (deterministic rules; no AI model)` |

Median deterministic replay time is 1.2 ms (p95 1.5 ms, 200 runs).

**Two engine releases.**
- Release 1 is the frozen `dt-engine-1.0.0`, source SHA-256 `9e4eae8a…9241` (pinned).
- Release 2 is the active engine (`src/lib/decision/engine.ts`, unfrozen, adds selective recalculation), source SHA-256 `2fb72275…7e96` at this commit. This hash is computed, not pinned.

The production-issued format 1 passport `0f1ee5e…` verifies (VALID). It then replays under the active engine with 38 of 38 nodes identical, conclusion included. A fixture release that changes one rule (coverage threshold 10x) is caught: exactly one node differs (`k.coverage`).

**Tamper detection, unknown version and incomplete replay** (all tested):

| Case | Status | Components named |
|---|---|---|
| Source changed (DOC-03 total debt 124 → 118) | TAMPERED | `source:DOC-03`, `case_archive` |
| Ruleset changed (`dr-rules-1.0.1`) | TAMPERED | `ruleset`, `case_archive` |
| Engine source, one byte changed | TAMPERED | `engine_source` |
| Unknown case version (9.9.9) or unknown engine (9.0.0) | UNSUPPORTED_VERSION | in both verify and replay |
| Engine source not supplied | INCOMPLETE | never a pass |
| No manifest | INCOMPLETE | never a pass |
| Document removed | TAMPERED | the document is reported missing |
| Wrong hash, intact components | MISMATCH | rebuilt hash reported |

Limits:
- Engine-source checking needs the engine's files. Deterministic replay is therefore a library and test operation; it is not yet exposed over HTTP, because the serverless bundle does not ship source files.
- Release 2 is a demonstration. It is not registered in `ENGINES`, and new passports still name `dt-engine-1.0.0`.

## Not done in this round

- No UI changes. One side effect: `/developers` and `/api/v1` list endpoints from the registry automatically, so the two new endpoints appear there.
- No benchmark against other systems; no AI-candidate provider; no offline verifier package (phase 5).

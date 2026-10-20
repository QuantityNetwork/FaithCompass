# decision-evidence-v1 — benchmark lab (V5 Phase 6)

**All 40 cases are fictional.** Entities, documents, figures and quotations are invented by `generate.ts`
(seed 20261020). Nothing here describes a real company, contract, manuscript or person.

| Domain | Cases | Dev | Eval |
|---|---|---|---|
| private credit (`pc-`) | 10 | 01–03 | 04–10 |
| M&A (`ma-`) | 10 | 01–03 | 04–10 |
| contract (`ct-`) | 10 | 01–03 | 04–10 |
| scholarly (`sc-`) | 10 | 01–03 | 04–10 |
| **total** | **40** | **12** | **28** |

## Protocol

1. The eval set (`cases/eval/`, 28 files) was generated, hashed into `EVAL_MANIFEST.json` and **committed before any
   system was run on it**. `eval_set_sha256` is recorded there; the harness refuses to score eval if any file differs.
2. Dev cases may be used to build and debug adapters. **No tuning on eval**: no rule, prompt or threshold may change
   after looking at eval results; a change requires a new benchmark version.
3. No composite score. Each metric is reported separately with its denominator and a 95% interval where one is
   meaningful. Failures are published.
4. A baseline that cannot run is reported as BLOCKED with the reason, never estimated.

## Case format

```jsonc
{ "id": "pc-04", "domain": "private_credit", "split": "eval", "fictional": true,
  "documents": [ { "id": "D1", "title": "…", "text": "…" } ],         // raw text (input for text-reading systems)
  "spans":     [ { "id": "D1#s3", "doc": "D1", "start": 120, "end": 181, "text": "…" } ],
  "facts":     [ { "id": "D1#s3", "entity": "…", "concept": "…", "value": 26.5, "unit": "$m", "period": "FY2025", … } ],
  "conclusions": [ { "id": "C1", "text": "…" } ],
  "gold": { "pairs": [ { "facts": ["D1#s3","D3#s1"], "class": "CONFIRMED_CONFLICT", "plant": "alias", "note": "…" } ],
            "inputs": { "C1": [ { "input": "EBITDA", "acceptable": ["D1#s3","D3#s1"] } ] },
            "dependencies": { "C1": ["D1#s3","D3#s1", …] } } }
```

`facts` is an annotator-style structured transcription of each statement, **verbatim** (period, unit, entity and
concept written as the document writes them; nothing resolved). Systems that only read structured facts (baseline C)
receive `facts`; systems that read text (A, B, D) receive `documents`. Every statement pair not listed in
`gold.pairs` has gold class NONE (no relation).

## Gold annotation guide

Gold is fixed by construction: each case is built from "plants", statement pairs whose correct reading follows this guide.

| Plant | Gold | Reading |
|---|---|---|
| confirmed | CONFIRMED_CONFLICT | same entity, measure, period, unit, basis; values differ beyond rounding |
| basis | DIFFERENT_REPORTING_BASIS | same measure, stated different basis (reported vs adjusted) |
| potential | POTENTIAL_CONFLICT | values differ; one side gives no period |
| missing | MISSING_EVIDENCE | one document states a value, the other says it is not provided |
| interpretation | UNRESOLVED_INTERPRETATION | two readings of one term |
| exclusive | CONFIRMED_CONFLICT | two mutually exclusive options both asserted |
| alias | CONFIRMED_CONFLICT | an abbreviation defined in D1 refers to the same entity |
| synonym | CONFIRMED_CONFLICT | a measure name defined in D3 as meaning the same as another |
| unit_word | CONFIRMED_CONFLICT | "USD million" and "$m" are the same unit |
| fiscal_year_end | CONFIRMED_CONFLICT | fiscal year ends 30 June (stated in D1), so FY2025 = LTM to 30 June 2025 |
| diff_period | NONE | different fiscal years |
| unit_scale | NONE | same amount in $k and $m |
| rounding | NONE | difference ≤ 0.2% |
| superseded | NONE | an amendment replaces the original figure |
| diff_entity | NONE | a subsidiary's figure |
| legal_entity | NONE | "X AB" and "X Ltd" are different legal entities |
| approximation | NONE | "approximately" a figure 3% away |

Conclusion evidence: each conclusion names its inputs. Acceptable evidence for an input is either statement of its
plant, except: superseded → only the amendment; diff_entity → only the group statement. A conclusion depends on
exactly its acceptable statements (`gold.dependencies`).

**Known limitations (stated before any run):** gold is synthetic and template-generated; the text is formulaic;
the author of the cases also wrote baseline C, so the guide may share blind spots with it. Plant types alias, synonym,
unit_word, fiscal_year_end, legal_entity and approximation were included because they are outside C's normalisation
rules. Results on this set say nothing about real documents.

## Metrics (from the brief)

citation precision, evidence recall, conflict recall, false-positive rate, dependency accuracy, replay fidelity,
passport integrity, unauthorized-access failures, review time, cost per case. Definitions: `harness/metrics.ts`.

## Baselines

| | Baseline | Status |
|---|---|---|
| A | plain LLM over the raw documents (gpt-4.1-mini-2025-04-14, temperature 0, seed 20261020) | ran once on eval; BLOCKED when OPENAI_API_KEY is unset (e.g. CI) |
| B | RAG over the raw documents (BM25 top-10 per conclusion, same model) | ran once on eval; BLOCKED when OPENAI_API_KEY is unset |
| C | previous Decision Twin (deterministic layer, frozen at merge cad6e95) | runs |
| D | manual review | BLOCKED: no reviewers recruited |

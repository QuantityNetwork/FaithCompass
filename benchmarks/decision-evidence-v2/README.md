# decision-evidence-v2: held-out benchmark of the integrated pipeline

**Authored test material. All 36 cases are fictional.** Entities, documents, figures and quotations are invented by
`generate.ts` (seed 20261121). Nothing here describes a real company, contract, manuscript or person, and none of it
is client data. Every case carries `"fictional": true, "authored_test_material": true`.

| Domain | Cases (all eval) |
|---|---|
| private credit (`pc-`) | 9 |
| M&A (`ma-`) | 9 |
| contract (`ct-`) | 9 |
| scholarly (`sc-`) | 9 |
| **total** | **36** (244 planted pairs; plant counts in `PLANT_COUNTS.json`) |

Eval set SHA-256: `febdb7f4710eb04961cf207343d8f4786cfc10a7c0b69aced8b20cef918372c7` (`EVAL_MANIFEST.json`, same algorithm as v1). The set was generated and committed
**after** the pre-registration (`PREREGISTRATION.md`) and **before any system ran on it**; the generator refuses to
overwrite a frozen set and the harness refuses to score if any file differs.

There is no dev split: v1 (all 40 cases) served as development data for D's rules, and that is disclosed.

## Format

As v1 (`../decision-evidence-v1/README.md`). Every statement pair not listed in `gold.pairs` has gold NONE.

## Gold annotation guide (written with the generator, before any run)

Controls carried over from v1:

| Plant | Gold | Reading |
|---|---|---|
| confirmed | CONFIRMED_CONFLICT | same entity, measure, period, unit, basis; values differ ≥5% |
| basis | DIFFERENT_REPORTING_BASIS | same measure, reported vs pro forma basis |
| potential | POTENTIAL_CONFLICT | values differ; one side gives no period |
| missing | MISSING_EVIDENCE | one document states a value, the other says it is not included |
| interpretation | UNRESOLVED_INTERPRETATION | two readings of one term |
| exclusive | CONFIRMED_CONFLICT | two mutually exclusive options both asserted |

New surface forms of the v1 misses (statements a reader must resolve from definitions in the text):

| Plant | Gold | Reading | v1 failure mode targeted |
|---|---|---|---|
| alias_role | CONFIRMED_CONFLICT | "the Borrower/Target/Supplier/Manuscript" is defined as the entity | C missed all aliases |
| alias_brand | CONFIRMED_CONFLICT | the entity "trades under the name" a brand; a statement uses the brand | C missed all aliases |
| synonym_means | CONFIRMED_CONFLICT | a measure name is defined as the same measure as another | C missed all synonyms; the hybrid missed 2/10 |
| fye_march | CONFIRMED_CONFLICT | the year ends 31 March and "FY2025 is the year ended 31 March 2025", so FY2025 = twelve months to 31 Mar 2025 | C missed all; A, B mis-classed or missed |
| unit_word_ccy | CONFIRMED_CONFLICT | "EUR million" = €m, "SEK million" = SEK m, "USD million" = $m | C missed unit words |
| unit_word_unlisted | CONFIRMED_CONFLICT | "NZD million" = "NZD m" (a currency outside the deterministic unit table) | tests the limit of the post-v1 unit rule |
| legal_form_variant | CONFIRMED_CONFLICT | "X Limited" and "X Ltd" are one legal entity | tests the post-v1 legal-form rule for over-splitting |
| approx_far | CONFIRMED_CONFLICT | "approximately" a figure ≥15% (constructed 25%) away is not consistent | tests the post-v1 approximation rule for over-tolerance |

New surface forms of the v1 false alarms (hard negatives, gold NONE):

| Plant | Reading | v1 failure mode targeted |
|---|---|---|
| rounding_tight | difference ≤0.4% | A flagged 16/19 rounding pairs |
| unit_scale_bn | the same amount in thousands ("SEK 22800 thousand", "$k") | A, B flagged all unit-scale pairs |
| same_amount_other_wording | the same amount written "€m" and "EUR million" | unit words, negative side |
| part_year | a half-year (H1 2025) and a full-year figure | different periods the period parser cannot place |
| diff_year | FY2023 vs FY2025 | A flagged 8/11 different-period pairs |
| restated | "as originally reported" vs "as restated in the latest accounts" | A flagged all superseded pairs |
| corrected | "first issue" vs "second issue (corrects the first issue)" | superseded, another wording |
| subsidiary | "X Nordic, a subsidiary" vs the group | A flagged 6/11 subsidiary pairs |
| legal_entity_other | "X Oy" vs "X GmbH" | C flagged all legal-entity pairs |
| approx_near | "around/roughly/circa" a figure within 3% | C flagged 11/12, A 9/12 approximations |
| effective_date | values effective from 1 Jan and 1 Jul 2025 | a change over time, not a conflict |

Conclusion evidence (as v1): each conclusion names up to two inputs. Excluded as inputs: legal_entity_other,
diff_year, part_year, effective_date. Acceptable evidence: restated/corrected → only the replacing statement;
subsidiary → only the group statement; otherwise either statement. A conclusion depends on exactly its acceptable
statements.

**Known limitations (stated before any run):** gold is synthetic and template-generated (three sentence templates);
the same author wrote the cases, the v1 failure analysis and D's post-v1 rules, so the guide may share blind spots
with D even though several plants deliberately target those rules; the 244 pairs come from 36 cases, so pair-level
Wilson intervals are optimistic and the paired case-level bootstrap is the primary comparison. Results on this set
say nothing about real documents.

# ID mapping plan (Stage 2)

Goal (§4, §10): one canonical id per real thing, stable links, explicit mappings, and **no merging of distinct works or editions**.

## Identifier systems in use today

| System | Where | Format | Count |
|---|---|---|---|
| Record claims | `src/lib/record/data/claims-*.ts` | `AM-CLAIM-000184` | 74 claims, 82 revisions |
| Record axioms, doctrines, derivations, covenants, counter-models | same | `AM-AX-…`, `AM-DOC-…`, `AM-DRV-…`, `AM-COV-…`, `AM-CM-…` | — |
| Record works | `src/lib/record/data/corpus.ts` | slugs, e.g. `njps-1985`, `prince-1995` (often an *edition or translation*, not a work) | 79 |
| EI registry | `src/lib/evidence/corpus/documents.ts` | `ed.bhs`, `ms.4qdan`, … | 35 |
| EI analyses and claims | `src/lib/evidence/seed/*` | `analysis-daniel-12-1`, `analysis-daniel-12-1-claim-1` | 5 / 17 |

## Canonical forms

| Entity | Canonical id | Rule |
|---|---|---|
| Work | `work:<slug>` | The abstract text, e.g. `work:tanakh`, `work:book-of-mormon` |
| Edition / translation | `ed:<slug>` | Exactly one `work_id`. `njps-1985` → `ed:njps-1985` under `work:tanakh` |
| Manuscript witness | `ms:<slug>` | Exactly one `work_id`. `ms.4qdan` → `ms:4qdan` |
| Passage | `psg:<work>:<anchor>[:<edition>]` | e.g. `psg:tanakh:dan.12.1` |
| Claim | `claim:<legacy id>` | `claim:AM-CLAIM-000184`. EI claims: `claim:ei.analysis-daniel-12-1-claim-1` |
| Claim revision | `rev:<claim>:v<n>` | Matches record revision numbers |
| Dossier | `dossier:<slug>` | — |

Legacy ids are kept forever in `id_mappings` (system, legacy id → canonical id, rationale, who, when), and the old URLs redirect.

## Procedure

1. A script (`scripts/map-ids.ts`, Stage 2) generates a **proposed** mapping CSV:
   - every record id and EI id;
   - suggested canonical ids;
   - for record works, a `work_or_edition` guess and candidate parent work;
   - candidate duplicates between record works and EI registry entries, matched by normalised title, year and ISBN or DOI.
2. Duplicates are **suggestions only**. An editor marks each pair as same edition (map both legacy ids to one `ed:`), same work but different editions (two `ed:` under one `work:`), or unrelated.
3. A dry-run load into staging checks:
   - every legacy id maps exactly once;
   - no edition has two works;
   - every claim's evidence still resolves;
   - the record lock hash, recomputed from the database export, equals `record:check`.
4. Only after editor sign-off is it loaded into production `id_mappings`. Each import creates a `corpus_versions` row.

Nothing in this plan marks any source as verified. Verification levels start at `unchecked` or `in_registry` and are raised only by Stage 3 checks.

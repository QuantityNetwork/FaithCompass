# Changelog

Changes to the public API (REST v1, MCP) and to how the record describes itself. The
reader-facing record history is at [/changelog](https://abrahammoses.com/changelog).

## API 1.1 (2026-10-20): trust labels and epistemic wording

All API changes in this release are additive. Clients written against 1.0 keep working
unchanged. The `X-AbrahamMoses-API-Version` header now reads `1.1`.

### Added
- `GET /api/v1/simulate` (GET and POST):
  - `epistemic_summary`, with counts by outcome: `supported`, `partially_supported`,
    `support_weakened`, `not_established`, `set_aside`.
  - `affected[].epistemic_status`.
  - `map_edges[].epistemic_status` and `map_edges[].status_label`.
  - `counter_models[].status_label`.
- `GET /api/v1/compare`: `positions_under_lens[].epistemic_status` and `status_label`.
- `GET /api/evidence/analyses`: `reviewState` (always `awaiting_editorial_review` for now)
  and `reviewDisclosure`.
- MCP: the dependency-semantics resource and the `simulate_rejection` tool description
  explain `epistemic_status`.

`epistemic_status` uses one vocabulary: `supported`, `partially_supported`,
`support_weakened`, `not_established`, `insufficient_evidence`, `disputed_interpretation`.
These are shown as "Supported under selected assumptions", "Partially supported", "Support
weakened", "Not established under selected assumptions", "Insufficient evidence" and
"Disputed interpretation". The outcome is always relative to the assumptions the caller set
aside. It is never a verdict on whether a tradition is true.

### Unchanged (kept for compatibility)
- The legacy engine values in `status` (`stands`, `weakened`, `unwarranted`, `broken`,
  `rejected`; edges `stands`, `weakened`, `ungrounded`; counter-models `unaffected`,
  `aligned`, `undermined`) keep their meaning. They are now documented as legacy machine
  values. Use `epistemic_status` for display.
- The legacy `/api/public/*` (Claim Ledger) shape is unchanged, including
  `textual_confidence` and `collapses`.

### Deprecated
- `headline_confidence` on claim summaries. It is marked `deprecated` in OpenAPI and will be
  removed in v2. The site no longer displays a headline confidence. Use the four confidence
  axes together with the claim's `status`.

### Status correction (record data)
Revision 1 of AM-CLAIM-000184 to AM-CLAIM-000191 was imported from the earlier Claim Ledger
as `published`, but no reviewer or review date was ever recorded for it. Its status is now
`provisional` (awaiting editorial review). As a result:
- `last_verified_revision` for these claims is `null`.
- `GET /api/v1/claims/{code}?rev=1` reports `status: "provisional"`.

Only the status changed. Because status is part of each revision's content hash, the eight
pinned hashes changed. Old and new hashes are listed in
`src/lib/record/data/corrections.ts` and on `/changelog#status-corrections`.

The same correction applies to imported axioms, counter-models and covenant and doctrine map
edges that carried `published` with no reviewer field.

A new integrity check, `unverified_publication`, now fails the build if any revision is
marked published or externally reviewed without a named reviewer.

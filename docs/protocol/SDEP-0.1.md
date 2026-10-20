# SDEP 0.1 – Structured Decision Evidence Protocol

Provider-agnostic, deterministic, no language model required. Source of truth: `src/lib/evidence-graph/schema.ts`
(types, edge rules, the 14 questions) and `src/lib/evidence-graph/integrity.ts` (checker). This file explains them.

## Document

`{ protocol: "sdep", version: "0.1.0", id, question, createdAt, software, nodes[], edges[] }`

- `software` names the producer, the engine (`version`, `sha256`), ruleset and model (`null` when none is used).
- Readers must reject unknown versions (`UNSUPPORTED_VERSION`) before reading anything else; schemas are strict
  (unknown fields are invalid).
- Digest: sha256 of the canonical JSON (sorted keys) of the whole document (`sdepDigest`).

## Nodes

18 kinds: SourceDocument, SourceVersion, EvidenceSpan, ExtractedClaim, VerifiedClaim, DisputedClaim, Assumption,
Interpretation, Calculation, Rule, Alternative, Contradiction, DecisionCondition, Conclusion, ReviewAction,
HumanAttestation, DecisionSnapshot, MonitoringSignal.

Each node has `id`, `kind`, `label`, `tenant` (`null` = public) and optionally `value`, `sourceSha256`,
`provenance` (contentSha256, version, locator {chars|field|page}, period, unit, basis, extractionMethod,
verification, permission, retrievedAt – unknown is `null`, never guessed), `formula`, `status`
(MET/NOT_MET/EVIDENCE_MISSING/NEEDS_HUMAN_JUDGMENT), `contradictionClass`, `context`, `note`.

## Edges

`from -[type]-> to`, 13 types, each with a meaning, allowed kinds at each end, and which end depends on the other:
DerivedFrom, Quotes, DependsOn, UsesAssumption, ComputedUsing (from depends on to); Supports, Refutes, Qualifies
(to depends on from); Supersedes, ReviewedBy, AuthorizedBy, Contradicts, Reopens (no dependency).

## Integrity checks

Errors: SCHEMA_INVALID, UNSUPPORTED_VERSION, DUPLICATE_NODE_ID, MISSING_FIELD, BROKEN_REF, SELF_EDGE,
EDGE_KIND_NOT_ALLOWED, CROSS_TENANT_EDGE, PRIVATE_DEPENDENCY_IN_PUBLIC_NODE, DEPENDENCY_CYCLE,
VERSION_WITHOUT_DOCUMENT, UNANCHORED_EVIDENCE, VERSION_MISMATCH, MISSING_EVIDENCE, CONTRADICTION_WITHOUT_TARGETS,
UNRECORDED_CONTRADICTION. Warnings: DUPLICATE_EDGE, DUPLICATE_EVIDENCE, SHARED_ANCESTRY, SUPERSEDED_IN_USE.

Several supports that all trace back to one SourceDocument are reported as shared ancestry: they are not
independent corroboration.

## Queries

`dependentsOf`, `dependenciesOf`, `rootSources`, `conclusionsDependingOn(passage)` and `answerCoverage` (which
of the 14 questions a document answers, and from what; absent answers are reported, not filled).

## Reference export

`decisionTwinSdep()` exports the synthetic Private Credit Decision Twin (DT-PC-001) from the frozen v1 engine:
103 nodes, 166 edges, zero findings. It contains no HumanAttestation, Alternative or MonitoringSignal, because
none exist.

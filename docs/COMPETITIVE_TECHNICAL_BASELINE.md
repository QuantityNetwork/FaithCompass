# Competitive Technical Baseline (V5, Phase 1)

What exists today for each element of the V5 brief, assessed against the code at production head
`36b81cc` (release `6068c87`, deployment `dpl_5p37Wy4zmUtsQCRENRHfatN8gHHj`) plus this branch.
Classification: **Existing** (implemented and tested), **Partial** (some of it, limits stated), **Absent**.
Commit = where the evidence was introduced / last changed. Nothing here is a benchmark result or a
certification; there are no external users, reviewers or partners behind any row.

The Decision Twin case (DT-PC-001) is **synthetic**. All Decision Twin rows describe engineering on that case.

## Tech 1 – Evidence graph

| Element | Status | Evidence |
|---|---|---|
| Typed dependency graph for one decision | Existing | `src/lib/decision/engine.ts` (`GRAPH`, `evaluate`, `dependentsOf`, `traceFromDefaults`) – 8c429c3; frozen copy `src/lib/decision/engines/v1/` – f5ba82c |
| Typed claim/dependency graph for the research record | Existing | `src/lib/record/engine.ts`, `record/integrity.ts` – 6cf63cd, 711c4f5 |
| SDEP node kinds (18) and edge types (13), each defined, allowed kinds per end | **Existing (this PR)** | `src/lib/evidence-graph/schema.ts` |
| Source provenance (hash, version, locator, period, unit, basis, extraction method, verification, permission, retrieval time) | **Existing (this PR)**; data partial | schema `ProvenanceSchema`; Decision Twin documents have hashes (`documentHash`, 8c429c3) and field period/unit/basis; retrieval time is `null` (synthetic, never retrieved) |
| Shared ancestry ≠ independent corroboration | **Existing (this PR)** | `checkIntegrity` → `SHARED_ANCESTRY` |
| "Every conclusion depending on this passage" | **Existing (this PR)** | `conclusionsDependingOn`, `dependentsOf`, `rootSources` in `src/lib/evidence-graph/integrity.ts` |
| Tests: missing/duplicate evidence, shared ancestry, contradictory fields, version mismatch, cycles, broken refs, unauthorized (cross-tenant) access, impact isolation | **Existing (this PR)** | `tests/evidence-graph.test.ts` (one mutation per check) |
| Decision Twin exported as SDEP | **Existing (this PR)** | `src/lib/evidence-graph/decision-twin.ts` – adapter over the frozen v1 engine, archived case and Contradiction Map; no logic duplicated |
| Graph persisted / multi-tenant store / API | Absent | SDEP documents are computed, not stored; tenancy is modelled (`tenant`) but no tenant exists |

## Tech 2 – Contradiction engine

| Element | Status | Evidence |
|---|---|---|
| 5 contradiction classes | Existing | `src/lib/decision/contradictions.ts` (CONFIRMED…UNRESOLVED_INTERPRETATION) – 8c429c3 |
| Curated contradiction map with refs and affected nodes | Existing (hand-curated, 1 case) | same file; SDEP adapter checks graph impact covers declared `affects` |
| Context normalisation (entity, period, unit, basis) | Partial | SDEP `context` + `UNRECORDED_CONTRADICTION` compares entity/measure/period/unit/basis; currency, definition, effective date, jurisdiction, mutual exclusivity absent |
| Automatic deterministic detection | Partial (this PR) | integrity checker flags same-context value conflicts that are not recorded; no extraction |
| AI-candidate layer, separated | Absent | — |
| Benchmark vs exact-value / LLM / RAG | Absent | no benchmark exists |

## Tech 3 – Counterfactual

| Element | Status | Evidence |
|---|---|---|
| Mutate assumptions → full recalculation → conditions | Existing | `evaluate`, `parseAssumptions`, URL-encoded assumptions – 8c429c3 |
| Trace of changed nodes vs defaults | Existing | `traceFromDefaults`, `fingerprint` – 8c429c3 |
| Counterarguments regenerated per scenario | Existing (rule-based) | `src/lib/decision/chamber.ts` – 8c429c3 |
| Conditions MET / NOT_MET / EVIDENCE_MISSING / NEEDS_HUMAN_JUDGMENT | Existing | engine `ConditionStatus` – 8c429c3 |
| Selective recalculation (only affected nodes) | Absent | engine recomputes everything (cheap at this size) |
| Structured diff, side-by-side, arithmetic/forecast/stress/causal/judgment distinction | Partial | trace lists changes; no typed change classes or side-by-side view |
| Oracle tests + timing | Partial | engine unit tests; no timing |

## Tech 4 – Historical replay

| Element | Status | Evidence |
|---|---|---|
| Immutable archived case inputs with pinned hash | Existing | `src/lib/decision/versions/` (`ARCHIVED_CASES`, `archiveHash`) – 2ceebb5 |
| Engine id + digest, frozen engine | Existing | `src/lib/decision/engines/index.ts` (`dt-engine-1.0.0`, sha256 pinned) – f5ba82c |
| Verify (passport against its version) | Existing | `verifyPassport` in `passport.ts` – f5ba82c; production check: old passport `0f1ee5e` valid |
| Deterministic replay of a past release; two-release demo | Partial | only one archived version exists, so no cross-release replay yet |
| AI model/config capture, reviews, event sequence in snapshot | Absent | the Decision Twin uses no model |
| Tamper / unknown-version tests | Existing for passports | passport tests (f5ba82c); incomplete-replay tests absent |

## Tech 5 – Portable passport

| Element | Status | Evidence |
|---|---|---|
| Canonical record + sha256, source inventory, engine manifest | Existing | `passport.ts`, `canonical.ts`, `case.ts` `sourceInventory` – 8c429c3, f5ba82c |
| Ed25519 signatures, kid, issued_at, historical keys | Existing (signing optional, off unless key configured) | `signing.ts`, `keys.ts`, `/.well-known/abrahammoses-passport-keys.json` – 2ceebb5, f5ba82c |
| Signed vs unsigned shown clearly | Existing | `UNSIGNED` state – f5ba82c |
| Revocation | Absent | — |
| Offline independent verifier (separate package / second language, conformance fixtures) | Absent | verification is server code only |
| Bundle (report, manifest, schema, redacted exports) | Partial | passport encodes record + hash; no downloadable bundle |
| Standards mapping (PROV-O, VC 2.0, in-toto, OpenLineage, JCS) | Absent | canonical JSON is sorted-key, not asserted JCS-conformant |

## Tech 6 – Adversarial challenge

| Element | Status | Evidence |
|---|---|---|
| Structured challenge proposals, editorial workflow, roles, audit | Existing (research record) | `src/lib/evidence/challenge.ts` – 3d91f52; `write-api.ts`, `src/lib/security/write-guard.ts` – 639d253; Firestore-enforced writes – f11e05a |
| Idempotency for proposals | Existing | `findProposalByIdempotencyKey` (stores) – 639d253 |
| Challenge typed factual/interpretive/math/procedural with affected conclusions on the Decision Twin | Absent | challenges exist for scholarly evidence, not decisions |
| Blind benchmark of flawed memos | Absent | — |

## Tech 7 – Continuity / reopening

| Element | Status | Evidence |
|---|---|---|
| Revisions / supersession of evidence, original unchanged | Existing (research record) | `src/lib/evidence/revisions.ts` – 639d253, f11e05a; `record/revisions.lock.json` – 6cf63cd; overlay seeding – d28ae79 |
| `Supersedes` / `Reopens` in the protocol, `SUPERSEDED_IN_USE` check | **Existing (this PR)** | schema + checker |
| Monitored decisions, subscriptions, thresholds, notifications | Absent | no monitoring is claimed |

## Tech 8 – Integration

| Element | Status | Evidence |
|---|---|---|
| Versioned REST v1 + OpenAPI | Existing | `src/app/api/v1/[[...path]]`, `src/lib/api/http.ts`, `decision/openapi.ts` – 6cf63cd, 55efd9e, 8c429c3 |
| MCP server | Existing (read-only) | `src/lib/mcp/server.ts` – 6cf63cd, f12bf26 |
| Schema validation | Existing | zod schemas across API; SDEP `parseSdep` (this PR) |
| Rate limits | Partial | per instance, best effort (`http.ts`); not durable |
| Tenant auth | Partial | Firebase ID tokens + role claims, rules-enforced – f11e05a; no tenants |
| Correlation IDs, retention policy, exports, families for sources/claims/scenarios/snapshots/replay/monitoring | Absent | — |

## Proof lab, public proofs, security, docs

| Element | Status | Evidence |
|---|---|---|
| `benchmarks/decision-evidence-v1/` (40 cases, gold, splits, baselines) | Absent | — |
| Competitor comparison (public docs only) | Absent | — |
| Public proof A – Evidence Challenge | Partial | research-record challenge flow (639d253); not decision-level |
| Public proof B – Historical Replay with offline bundle | Absent | — |
| Public proof C – Comparative Benchmark | Absent | — |
| Security headers, CSP/HSTS, dependency audit, smoke tests | Existing | f12bf26, 1693c01; `scripts/security-smoke.mjs` (36b81cc) – 10/10 on production |
| Durable store with rules as the boundary | Existing | Firestore, `firestore.rules`, emulator tests – f5ba82c, f11e05a |
| Security gates §17 before real client data (backups/PITR drill, named editors, authorized domains) | Partial | owner steps open in `docs/RELEASE_BLOCKERS.md` |
| Protocol doc | **Existing (this PR)** | `docs/protocol/SDEP-0.1.md` |
| Other V5 docs (differentiation, benchmark, passport spec, verification, security review, claims register…) | Absent | — |

## Claim status

No competitive claim is supported yet. The target claim ("we preserve the evidence required to challenge,
reproduce and independently verify decisions") is partly backed by the frozen engine, archived case, signed
passports and now SDEP integrity checks; independent (offline) verification and comparative evidence are absent.

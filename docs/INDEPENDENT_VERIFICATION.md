# Independent Verification of Decision Passports

Status: PR #19 (branch `v5-sdep-baseline`), not merged. All numbers below were measured on 2026-10-20 on the
development box (Go 1.24.4, Node 22.20.0) unless marked "CI".

## What is independent

`packages/decision-verifier/` is a second implementation, in **Go, standard library only** (`crypto/ed25519`,
`crypto/sha256`, `encoding/json`). It shares no code with the application: it does not import the TypeScript
builder, canonicalizer or verifier, and has no third-party modules (CI builds it with `GOPROXY=off`, so any
dependency would fail the build, and greps the sources for imports from `src/`). It implements the specification
in `docs/DECISION_PASSPORT_SPEC.md` from scratch, including its own canonical JSON (with an ECMAScript
`Number::toString` formatter).

Both implementations are run against the **same** files in `packages/decision-verifier/conformance/`:

| File | Content |
|---|---|
| `fixtures/*.json` | 14 bundles (below; two are workspace decision records) |
| `expected.json` | expected result, signature state, failed and uncheckable checks per fixture (written by hand, not recorded from either verifier) |
| `keys.json` | pinned public test keys A (active), B (retired, historical), C (revoked). Private halves were generated in memory by `scripts/passport-fixtures.ts` and discarded |
| `engines.json` | pinned engine releases `dt-engine-1.0.0` (`9e4eae8a…9241`) and `dt-engine-1.1.0` (`cc226a98…8230`); a test asserts it equals the app registry |
| `canonical-vectors.json` | 25 canonical-JSON vectors (key order by UTF-16 units, escapes, number formatting) |

## Build and run offline

```sh
cd packages/decision-verifier
GOPROXY=off go build -o decision-verifier .          # no network needed
./decision-verifier --keys keys.json --engines engines.json [--expected-sha256 <hex>] bundle.json
./decision-verifier --conformance conformance           # run the shared fixtures
```

`keys.json` may be the published `/.well-known/abrahammoses-passport-keys.json`, saved once from a trusted channel
(the verifier reads `keys[].kid/x/status/not_before/not_after/revoked_at`). The production key is also pinned in git
at `packages/decision-verifier/keys/production.json` (kid `ed25519-e31c2d82da92a114`, x
`HLvxNqISBr_AJlCdpAPCYcvUYH0qRaqte0cyeabuEWs`, valid from 2026-10-20T21:30:00Z). Passports issued before that time are
unsigned (integrity hash only) and verify with any key file.

Exit codes: `0` VALID (or all fixtures as expected), `1` INVALID, `2` UNSUPPORTED, `3` usage or I/O error,
`4` a conformance fixture deviated. Output is the JSON report of §5 of the spec.

Example (demo passport bundle built locally, run inside `unshare -rn`, i.e. with no network interface):
result `VALID`, signature `unsigned`, 19 checks, 0 failed, 0 uncheckable, exit 0; the same bundle with a wrong
`--expected-sha256` → `INVALID`, exit 1.

## Conformance fixtures and results

| Fixture | Expected result | Failed checks | Uncheckable |
|---|---|---|---|
| valid-signed | VALID (signature valid) | – | – |
| valid-unsigned | VALID (unsigned) | – | – |
| valid-historical-key | VALID (retired key B, signed inside its window) | – | – |
| valid-redacted | VALID | – | source_documents |
| valid-legacy-format1 | VALID (production passport `0f1ee5e…`, format 1) | – | engine_known |
| tampered-assumption | INVALID | artifact_hash:passport, artifact_hash:state, passport_hash, ref:id_state, signature | – |
| tampered-assumption-recomputed | INVALID (all hashes recomputed by the attacker) | signature | – |
| tampered-source-hash | INVALID | artifact_hash:sources, ref:sources, source_documents | – |
| tampered-attestation | INVALID | attestation:0 | – |
| unknown-version | UNSUPPORTED (schema 9.0.0) | schema | – |
| unknown-engine | UNSUPPORTED | engine_known | – |
| revoked-key | INVALID (signed by revoked key C) | signature | – |
| valid-workspace-decision | VALID (unsigned workspace record, engine am-workspace-record-1.0.0) | – | – |
| tampered-workspace-conclusion | INVALID | artifact_hash:passport, passport_hash | – |

Results:

| Verifier | Fixtures as expected | Where |
|---|---|---|
| TypeScript (`src/lib/passport-bundle/verify.ts`, vitest `tests/passport-bundle.test.ts`) | 14 / 14 | local; CI job "Typecheck, unit, …" |
| Go (`decision-verifier --conformance`) | 14 / 14 | local with `unshare -rn` (no network); CI job "Independent passport verifier" under `sudo unshare --net` |
| Canonical vectors | 25 / 25 in both | `go test`, vitest |

Timings (local, per fixture, ~61 KB bundles): TypeScript median over fixtures 1.09 ms (each fixture the median of
200 runs; range 0.95–1.67 ms; `unknown-version` stops at the schema check, 1 µs). Go: 0.9–2.1 ms per fixture in one
conformance run (single measurement each, includes file parsing; `unknown-version` 2 µs).

## Limits

* Fixtures use test keys. The production key (above) has not been rotated or revoked.
* An unsigned bundle whose hashes were all recomputed after tampering verifies `VALID` unless an independently
  obtained hash is supplied (see the spec, §6).
* The verifiers check consistency, hashes and signatures; they do not re-run the decision engine (that is replay,
  `src/lib/replay/`).
* Two implementations by the same team are independent in code, not in authorship. No external party has audited them.

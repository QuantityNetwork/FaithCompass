# Decision Passport Bundle – Specification (schema 1.0.0)

Status: implemented on PR #19 (branch `v5-sdep-baseline`), not merged, not deployed to production.
Reference implementations: `src/lib/passport-bundle/bundle.ts` (builder), `src/lib/passport-bundle/verify.ts` (TypeScript
verifier), `packages/decision-verifier/` (independent Go verifier). Shared conformance fixtures:
`packages/decision-verifier/conformance/`.

A bundle is one JSON file containing everything needed to check a Decision Passport **without the server**.

## 1. Obtaining a bundle

| Route | Purpose |
|---|---|
| `GET /api/institutional/decision-room/passport/bundle?id=<passport ID>[&redacted=1]` | JSON API (rate-limited, CORS as the other demo endpoints; 400 unknown parameter, 404 invalid ID) |
| `GET /institutional/decision-room/passport/<id>/bundle[?redacted=1]` | Download (`content-disposition: attachment; filename="decision-passport-<sha256[0:12]>[-redacted].bundle.json"`) |
| Passport page | "Download bundle (offline verification)" button |

The demo case is synthetic. Production passports issued from 2026-10-20T21:30:00Z are signed with kid
`ed25519-e31c2d82da92a114` (pinned in `packages/decision-verifier/keys/production.json`); earlier ones are unsigned.

## 2. Structure

```jsonc
{
  "bundle": "abrahammoses-decision-passport-bundle",
  "schema_version": "1.0.0",
  "redacted": false,
  "passport_id": "DP1-<base64url(canonical state)>[.S-<base64url(signature)>]",
  "artifacts": {
    "passport":        { /* the canonical passport record, without passport_id and integrity */ },
    "report_markdown": "…human-readable report (same text as the Markdown download)…",
    "state":           { /* decoded state: case version, assumptions a, time t, … (what the ID encodes) */ },
    "sources":         { "inventory": [ {"id", "sha256", …} ], "documents": [ … ] | null },
    "release":         { "case_id", "case_version", "case_archive_sha256", "ruleset", "engine": {"version", "sha256", …} },
    "review":          { "status", "reviewer", "attestations": [] },
    "crypto":          { "signature": {…} | null, "algorithm": "Ed25519" | null, "keys_url", "keys": [ … ] }
  },
  "integrity": {
    "algorithm": "SHA-256",
    "canonicalization": "canonical-json/1: …",
    "passport_sha256": "<sha256(canonical(artifacts.passport))>",
    "artifacts": { "passport": "<hex>", "report_markdown": "<hex>", "state": "<hex>", "sources": "<hex>",
                   "release": "<hex>", "review": "<hex>", "crypto": "<hex>" }
  }
}
```

`crypto.keys` is an **informational** copy of the published keys. Verifiers must use keys pinned independently
(e.g. fetched once from `/.well-known/abrahammoses-passport-keys.json` and stored), never the ones in the bundle.

Size of the default demo passport bundle: 42 242 bytes (redacted: 34 838 bytes). Build time: median 1.6 ms (local, 100 runs).

## 3. Canonicalization (`canonical-json/1`)

* Object members sorted by key, comparing UTF-16 code units; no insignificant whitespace.
* Strings and numbers serialized exactly as ECMAScript `JSON.stringify` (shortest round-trip number form, e.g. `1e+21`,
  `1e-7`, `-0` → `0`).
* Members whose value is `undefined` are omitted (only relevant inside the TypeScript builder).
* `digest(v) = lowercase hex SHA-256 of the UTF-8 bytes of canonical(v)`.

For the values that occur in passports this is byte-identical to RFC 8785 (JCS). Known divergence: strings containing a lone
UTF-16 surrogate are out of scope (JCS rejects them, `JSON.stringify` escapes them as `\udxxx`, Go's decoder replaces
them with U+FFFD); passports never contain them. 25 shared test vectors
(`conformance/canonical-vectors.json`) are checked by both implementations.

## 4. Signatures

Issuance (optional):

```
message = "AbrahamMoses Decision Passport issuance v2\n" + passport_sha256 + "\n" + kid + "\n" + issued_at
signature = { "alg": "Ed25519", "kid": "ed25519-<first 16 hex of sha256(raw 32-byte public key)>",
              "issued_at": "YYYY-MM-DDTHH:MM:SSZ", "value": base64url(Ed25519(message)) }
```

The signature is carried both in the ID suffix (`.S-` + base64url(canonical(signature))) and in `crypto.signature`;
they must be equal, and `issued_at` must equal the passport time `state.t`.

Attestation (format defined, none exist for the synthetic case):

```
message = "AbrahamMoses attestation v1\n" + digest(statement) + "\n" + kid + "\n" + issued_at
attestation = { "statement": {…}, "signature": { same fields as above } }
```

### Key states

| Status | Meaning for verification |
|---|---|
| `active` | valid for `issued_at` ≥ `not_before` |
| `retired` | historical key: still valid for signatures with `not_before` ≤ `issued_at` ≤ `not_after` |
| `revoked` | **every** signature by this key is rejected, whatever its date (`revoked_at` is informational). Use for compromise. |

Unknown `kid` (not pinned) → signature fails.

## 5. Verification checks

A verifier emits one entry per check (`pass` / `fail` / `uncheckable`):

| Check | Rule |
|---|---|
| `schema` | `bundle` kind and `schema_version` supported (else result `UNSUPPORTED`); required fields and types present |
| `passport_hash` | `digest(artifacts.passport) == integrity.passport_sha256` |
| `expected_hash` | only when the caller supplies a hash obtained independently |
| `artifact_hash:<name>` | for each of the 7 artifacts, `digest(artifact) == integrity.artifacts[name]` |
| `ref:id_state` | base64url-decoded ID state equals `artifacts.state` |
| `ref:passport_id` | `passport.id` equals the ID without the signature suffix |
| `ref:state_assumptions` | passport assumptions (minus `defaults`) equal `state.a`; `generated_at == state.t` |
| `ref:sources` | passport source list equals `sources.inventory` |
| `source_documents` | each inventory hash equals `digest(document)`; **uncheckable** when redacted |
| `ref:release` | ruleset, case id/version, case archive hash and engine agree between passport and release manifest |
| `engine_known` | engine version+sha256 matches a pinned release (else `UNSUPPORTED`); **uncheckable** for format-1 passports, which predate engine digests |
| `ref:review` | review status and reviewer equal the passport's |
| `attestation:<i>` | each attestation signature verifies against pinned keys |
| `signature` | unsigned → pass with "integrity hash only"; signed → see §4 |

Result: `UNSUPPORTED` if the schema or engine is unknown; otherwise `INVALID` if any check failed; otherwise `VALID`.
`uncheckable` checks are listed separately and never silently counted as passes.

Output (both verifiers, machine-readable):

```json
{ "verifier": "decision-verifier-go/1.0.0", "schema_version": "1.0.0", "result": "VALID",
  "signature": "valid|invalid|unsigned", "passport_sha256": "…", "checks": [ {"id","status","detail"} ],
  "failed": [], "uncheckable": [] }
```

## 5a. Workspace decision records (same schema, record engine `am-workspace-record-1.0.0`)

Decisions made in a private evidence workspace (`/institutional/workspace`, docs/EVIDENCE_WORKFLOW_E2E.md) export as
bundles of this same schema, so both verifiers check them unchanged:

* `state` = `{v: "W1", k: "workspace-decision", tenant, d: <decision id>, s: <status>, t, a: {}}`; `t` is the time of
  the last review step (approval/rejection, else proposal), so a re-export of the stored record has the same hash.
* `passport` (format `workspace-decision/1`) carries the decision, each cited passage with its SHA-256 and text, the
  proposer and the reviewer (`{id, email}` of the Firebase accounts), the review rule and the audit trail (exports
  excluded). `sources.documents` are the imported documents with their full normalised text.
* `release.engine` is the frozen builder `src/lib/workspace/record/v1` (`am-workspace-record-1.0.0`, source hash
  pinned in `src/lib/decision/engines` and `conformance/engines.json`); `ruleset` is `am-workspace-review/1`.
* Signed with the passport key when the server has one (production); unsigned on previews.
* Conformance fixtures: `valid-workspace-decision` (VALID, unsigned) and `tampered-workspace-conclusion` (INVALID),
  generated deterministically by `scripts/workspace-fixtures.ts` from synthetic data.

`ref:review` compares status and reviewer **by value** (canonical JSON). The TypeScript verifier compared them by
reference until this was found with the workspace fixture (an object reviewer); the Go verifier already compared by value.

## 6. Limits (stated honestly)

* **Unsigned bundles prove consistency, not origin.** Someone who edits an unsigned bundle and recomputes every hash
  produces a bundle that verifies `VALID`. Detection then requires a hash obtained independently (`--expected-sha256`)
  or a signature. Fixture `tampered-assumption-recomputed` shows that a signature catches this case.
* The bundle verifiers check internal consistency, hashes and signatures. They do **not** re-run the decision engine;
  re-deriving the passport content from the inputs is the replay operation (`src/lib/replay/`), which needs the
  frozen engine sources.
* A redacted bundle cannot prove the source documents' content; it reports `source_documents` as uncheckable.
* One production signing key exists (kid `ed25519-e31c2d82da92a114`); none has been revoked. Revocation is tested with test keys only.
* No standard certification is claimed. See `docs/STANDARDS_MAPPING.md`.

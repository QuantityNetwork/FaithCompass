# Production audit (Stage 1)

Date: 2026-10-20, Europe/Stockholm. Auditor: Grok Bot for Sagolik.
Scope: Master Prompt 3 §2. This builds on the earlier register in the Stage 0 audit (issues P1-1 … P3-5) and recalculates only what may have changed.

## 1. What is serving

| Item | Value | How checked |
|---|---|---|
| Production branch | `claude/abrahammoses-research-instrument` | Vercel project settings |
| Serving commit | `2aea116` (merge of PR #11, design D) | Vercel deployment `dpl_6MQ9dXcw94jR33DJ2SyJTsk983jE`, state READY, target production |
| Aliases | abrahammoses.com, www.abrahammoses.com, abraham.sagolik.com, abrahammoses.vercel.app | deployment aliases |
| Rollback target | `dpl_5gy1sFtaaiJjEoNFddcJAwzuJPqB` (commit `330fdfb`) | recorded at release |
| Region / framework | iad1 / Next.js 15 | deployment |
| Deploy policy | Production changes only on a manual deploy or promote | release practice |
| Record | api 1.1, record_version `f79c70d2ef22dde1`; status checks all pass except `legal_contact` (warn) | `GET /api/v1/status` |

### Environment variables (names only; values were not read or printed)

| Name | Targets |
|---|---|
| `ABRAHAMMOSES_PUBLIC_ORIGIN` | production |
| `ABRAHAMMOSES_LEGACY_ORIGINS` | production |
| `EVIDENCE_STORE` | production, preview |
| `EVIDENCE_PROVIDER` | production, preview, development |

Absent: every `SUPABASE_*`, `ANTHROPIC_API_KEY`, `AUTH_PROVIDER`, `ABRAHAMMOSES_PRIVACY_CONTACT`, `ABRAHAMMOSES_CONTACT`.

### Database

No Supabase project is connected to `abrahammoses`: no Supabase env vars and no integration. The production store is the in-memory store (non-mutating probe: `POST /api/evidence/analyze` answers 503 "no database"). The repo has one applied-nowhere migration (`supabase/migrations/20260911000000_evidence_intelligence.sql`) and, on this branch, two new ones (§5). **Nothing durable exists in production.**

### AI provider

`EVIDENCE_PROVIDER` is set, but there is no `ANTHROPIC_API_KEY`, so the only working provider is the deterministic curated `corpus` provider. All 5 published analyses report `modelProvider: corpus`. `src/lib/evidence/providers/registry.ts:21-32` silently falls back from `anthropic` to `corpus` when the key is missing (P1-A2). Default model IDs (`src/lib/evidence/providers/anthropic.ts:45-46`) are `claude-haiku-4-5-20251001` and `claude-opus-5`, which Anthropic lists as legacy-but-available as of today.

## 2. Counts (recalculated from code at `2aea116`)

| Quantity | Value |
|---|---|
| Record claims | 74 |
| Claim revisions | 82, all `provisional` (0 published, 0 editor-verified, 0 externally reviewed) |
| Works | 79 |
| Traditions | 11 |
| Derivations / cases | 24 / 4 |
| Translations | 4, 0 verified |
| Evidence registry entries | 35: 20 `INTERNAL_CORPUS`, 14 `PARTIALLY_VERIFIED`, 1 `UNVERIFIED`, **0 externally verified** |
| Evidence Intelligence subjects / claims | 5 / 17, all `awaiting_editorial_review` |
| Human reviewers on record | 0 |

These match the brief's figures. The earlier Stage 0 integrity issues (8 revisions shown as published without a verifier; "Very high" headline confidence; numeric scores on theological readings; "broken" wording) are no longer present on the live site: rechecked on /, /claims and /evidence/daniel/12/1 (0 "Very high", 0 "/100", "0 editor-verified").

## 3. Findings

### P0: security, unauthorised mutation, data loss, deploy correctness

| # | Finding | Evidence | Stage 1 action |
|---|---|---|---|
| P0-A1 | **Anonymous mutation of published scores.** `POST /api/evidence/claims/{id}/challenge` had no authentication and called `challengeClaim`, which re-scored the claim and wrote the whole analysis back (`store.saveAnalysis`) into the public, canonical collection. `POST /api/evidence/analyze` saved anonymous analyses into the same published list. Production was protected only by configuration (memory store → 503). Any writable store opened it: the default file store in development, or Supabase as soon as it was connected (writes use the service role). | `src/lib/evidence/challenge.ts` (pre-fix l.150-175), `src/app/api/evidence/claims/[id]/challenge/route.ts`, `src/app/api/evidence/analyze/route.ts`, `src/lib/evidence/pipeline.ts:416-449` | **Fixed** (§4) |
| P0-A2 | **Silent non-durable fallback.** With nothing configured, `getStore()` returned the file store, also in a deployed build, where the filesystem is read-only or wiped per instance. | `src/lib/evidence/store/index.ts` (pre-fix l.58-60) | **Fixed**: deployed builds default to the read-only memory store; every store declares `durable`; the file store counts as durable only in local development; write routes answer 503 otherwise |
| P0-A3 | No roles, no identity, no audit of who changed what. | absence of any auth module (Stage 0 P1-1) | **Partly fixed**: six-role model, deny-by-default, actor-attributed audit records. Login waits on B2. |
| P0-A4 | No CSRF/origin protection, content-type enforcement, payload size caps or write rate limits on writes. | Stage 0 P1-2 | **Fixed** for the three write routes (`src/lib/security/write-guard.ts`) |

### P1: research function, sources, persistence, editorial

| # | Finding | Evidence |
|---|---|---|
| P1-A1 | No database: every visitor-generated draft or proposal is refused (correctly) with 503. | §1 above; blocker B1 |
| P1-A2 | Disguised curated fallback when `EVIDENCE_PROVIDER=anthropic` lacks a key (§6 forbids it). | `src/lib/evidence/providers/registry.ts:21-32` |
| P1-A3 | Two disconnected models: the record (74 claims, 79 works, ids `AM-CLAIM-…`, work slugs) and Evidence Intelligence (17 claims, 35 registry entries, ids `ed.*`, `ms.*`), and EI is absent from REST v1 and MCP. | Stage 0 P1-7; mapping plan in docs/ID_MAPPING.md |
| P1-A4 | 0 of 35 registry entries externally verified; citation check has 2 levels, not 7. | `src/lib/evidence/corpus/documents.ts`, `src/lib/evidence/citations.ts` |
| P1-A5 | npm audit: 3 high, 1 moderate (postcss, sharp, source-map-js through next). Fix available. | `npm audit --omit=dev`, 2026-10-20 |
| P1-A6 | No CSP; `x-powered-by` was reported in Stage 0. Live headers today include `permissions-policy` and `referrer-policy`, but no `content-security-policy`. | `curl -I https://abrahammoses.com/` |
| P1-A7 | No CI; tests run by hand only. | no `.github/workflows` |
| P1-A8 | No privacy or editorial contact published; `legal_contact` status check warns. | /privacy, /about; `GET /api/v1/status` |

### P2: UX, accessibility, integrations, performance, observability

| # | Finding | Evidence |
|---|---|---|
| P2-A1 | Rate limits are per serverless instance (memory) and per client address. On the preview, 28 rapid writes from a client with rotating egress addresses never hit 429. Brake, not guarantee. | `src/lib/api/http.ts:115-160`, `src/lib/security/write-guard.ts` |
| P2-A2 | No error reporting, alerting or backups. Security events are now structured JSON log lines (`type: "security"`) but there is no drain or alert on them. | `src/lib/security/audit-log.ts` |
| P2-A3 | `POST /api/evidence/ask` is read-only but unthrottled. | `src/app/api/evidence/ask/route.ts` |
| P2-A4 | Default model IDs are legacy. | §1 above |
| P2-A5 | Remaining Stage 0 P2 items (cursor pagination, MCP output schemas, heading order on /claims, coverage gaps, Node engine pin) still apply. | Stage 0 register |

### P3

Stage 0 P3-1 … P3-5 unchanged (unused exports, legacy `APPROVED_CLIENTS` naming, legacy host redirects off, old Lovable host, stale branches).

## 4. The P0 fix (branch `stage1-security`)

- **Separation of the three data classes (§3).** Published analyses (class A) are written only by seeding and by an approved editorial decision. Visitor work (class B) goes to separate collections: `analysis drafts` and `challenge proposals`. Editorial decisions (class C) are recorded on the proposal and in the audit trail.
- **Challenge = proposal.** `POST /api/evidence/claims/{id}/challenge` computes the challenge (`computeChallenge`, pure) and stores a proposal with status `proposed`, the base version, and the proposer (null for anonymous). It responds `202` with the proposal id, the status and `publishedChanged: false`. It supports `Idempotency-Key`.
- **Decision endpoint.** `POST /api/evidence/proposals/{id}/decision` lets an authenticated `research_editor` or `editorial_admin` approve or reject. Self-decision is refused. Approval applies only if the analysis is still at the proposal's base version, via a conditional write; otherwise `409` and the proposal is marked superseded. Rejection changes nothing published. Both write an audit record with actor id, role, reason, and old and new version.
- **Analyze = draft.** `POST /api/evidence/analyze` runs with `persist: false` and saves the result as a private draft (`202`, `kind: DRAFT`, `published: false`). It is never added to the published list.
- **No durable store → 503.** Production today answers 503 with `persisted: false`.
- **Roles (`src/lib/auth/roles.ts`).** Six roles; deny by default; `system_admin` has no editorial or review authority.
- **Identity (`src/lib/auth/actor.ts`).** Supabase Auth bearer token verified server-side; role only from `app_metadata.am_role`; unknown roles fall to contributor; body, query and headers are ignored. With `AUTH_PROVIDER` unset every caller is an anonymous `public_reader` (no simulated login).
- **Guard (`src/lib/security/write-guard.ts`).** Origin/`Sec-Fetch-Site` check, `application/json` only, body caps (4 KB challenge/decision, 32 KB analyze), per-client per-minute limits (10 default; 5 for analyze), per-instance daily quota, permission check, strict Zod schemas (unknown fields such as `role` are rejected), `cache-control: no-store`.
- **Security events (`src/lib/security/audit-log.ts`).** One JSON line per write attempt; client address hashed; request text never logged.
- **UI.** The challenge panel now says the challenge is submitted for editorial review and the published assessment is unchanged; it no longer shows a "revised score" as if applied.

## 5. Test output

Commands run on Node 22.20.0 at the branch head.

```
$ npm run typecheck                      # tsc --noEmit
(no output, exit 0)

$ npm run record:check
All 82 public revisions match the lock.

$ npm test                               # vitest run
 Test Files  20 passed (20)
      Tests  306 passed | 5 skipped (311)

$ npm run build                          # next build
exit 0

$ npm run test:e2e   (against next start on :3311)
 Test Files  1 passed (1)
      Tests  28 passed (28)
```

§3 acceptance tests (`tests/security.test.ts`, application layer, in-process durable test store):

| § 3 test | Result |
|---|---|
| 1 anonymous cannot alter | PASS (6 tests: challenge→proposal, analyze→draft, anonymous decision 401, no-DB 503, CSRF/content-type/size/flood, logging) |
| 2 contributors cannot self-approve | PASS (4 tests incl. editor self-approval and sysadmin) |
| 3 roles cannot be forged via payload | PASS (4 tests: body fields 400, role headers and unverifiable tokens 401, unknown `app_metadata` role → contributor, no IdP → anonymous) |
| 4 rejected revisions leave data unchanged | PASS |
| 5 concurrent edits cannot silently overwrite | PASS (stale base → 409/superseded; simultaneous decisions → exactly one wins; idempotent replay) |
| 6 approved changes create attributable, versioned audit events | PASS |
| 7 public reading needs no registration | PASS |
| DB-level 1/3, 2, 5 (cross-instance), 6 (append-only under service role), durable quotas | **BLOCKED** on a real Supabase project (B1); skipped, not passed |

Database policies, on a throwaway **local** PostgreSQL 17 with a stub of Supabase's `auth.uid()` and API roles (`npm run test:rls`). Both migrations were applied twice (repeatable), then 29 checks ran, all PASS. Examples: anon cannot write any canonical table; a contributor cannot insert a proposal as someone else or decide their own; an editor cannot approve their own revision or proposal; an illegal workflow transition is refused; published content and history are immutable even for the service role; a forged reviewer attestation is refused. This is evidence for the SQL, **not** a pass on Supabase.

Real-HTTP security test (`scripts/security-smoke.mjs`):

- **Local production build** (`next start`, no database): all checks pass, and the rate limit engaged (429 after 5 analyze calls).
- **Vercel preview** of this branch (`abrahammoses-bec5pacht-…vercel.app`, reached with a temporary Vercel share link): all 10 mutation and authorisation checks PASS.
  - Anonymous analyze and challenge: 503.
  - Forged role in body or header: 400.
  - Cross-origin: 403. Form content type: 415.
  - Anonymous or forged-token approval: 401.
  - The published analyses list was identical before and after.
  - **The rate limit did not engage**: 28 rapid writes, no 429. Runtime logs show a different client hash on almost every request, because the test machine's egress address rotates (6 distinct IPs in 6 calls). This confirms P2-A1: per-address, per-instance limits are a brake, not protection. The per-action daily quota still applies per instance. A durable, global limit needs the database (E3).

## 6. Not done here (by instruction)

No Supabase project created, no env vars changed, no migrations run on any remote database, nothing merged or promoted.

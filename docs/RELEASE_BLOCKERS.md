# Release-blocker register

The single list of what stands between AbrahamMoses and each release gate (Master Prompt 4, Part II).
Owner: Sagolik. Re-verified 2026-10-20 18:45 CEST against production commit `3dfa3c9` (deployment `dpl_9kfQSw68ZPxoTfLVakmn8BMER7SP`).

**Status vocabulary (only these):** NOT_STARTED · IN_PROGRESS · IMPLEMENTED (code exists, not yet proven) · TESTED (automated tests pass) · DEPLOYED (in production) · VERIFIED (checked in production after deploy) · BLOCKED_EXTERNAL (needs something only the owner or a third party can provide) · CLOSED (resolved, with evidence).

An item moves only with evidence: a commit, a CI run, a production check, or a dated owner decision. "Deployed" is not "verified", and neither is "complete".

## Verified state (2026-10-20)

| Fact | Value | How checked |
|---|---|---|
| Production commit | `3dfa3c9` (merge of PR #13) | Vercel deployment meta; all four domains aliased |
| Production deployment | `dpl_9kfQSw68ZPxoTfLVakmn8BMER7SP`, READY | Vercel API |
| Rollback target | `dpl_ieAevC58bqwb7RTVCJF6xznmHmWy` (`e6ea29d`) | Vercel API |
| Env var **names** on `abrahammoses` | `ABRAHAMMOSES_PUBLIC_ORIGIN`, `ABRAHAMMOSES_LEGACY_ORIGINS`, `EVIDENCE_STORE`, `EVIDENCE_PROVIDER` | Vercel API (names only; values not read) |
| Supabase | **None.** No Supabase integration on the team, no `SUPABASE_*` variables on the project. Neon/Upstash integrations exist on the team but are attached to no project. | Vercel API |
| Database | None: evidence writes answer 503; nothing visitor-submitted is stored | `/api/evidence/analyze` → 503 in production |
| Migrations | 3 (`evidence_intelligence`, `editorial_workflow`, `canonical_model`); applied twice + 29 RLS checks pass on throwaway local PostgreSQL only; never applied to any hosted DB | `npm run test:rls` |
| Record | 74 claims · 82 revisions (all provisional, 0 published/editor-verified) · 13 axioms · 4 cases · 79 works | `/api/v1/status` |
| Evidence registry | 35 sources: 20 internal corpus, 14 partially verified, 1 unverified, **0 externally verified** | `src/lib/evidence/corpus/documents.ts` |
| Evidence assessments | 5 published, all awaiting editorial review | `/api/evidence/analyses` |
| Reviewers | **0** named reviewers on any revision | `/institutional` computed count |
| Status page | all checks pass except `legal_contact` (warn: no privacy contact) | `/api/v1/status` |
| AI provider | `corpus` (curated, offline). No AI key configured. | `/status` (`ai_provider` check after PR #14) |
| Open PRs | #1, #3 (historical, superseded by the production branch) | GitHub |

## Register

| ID | Sev | Condition (what is wrong or missing) | Change required | Component | Depends on | Acceptance test | Status | Evidence |
|---|---|---|---|---|---|---|---|---|
| B1 | P0 | No database: drafts, proposals, decisions, audit, Decision Twins and Passports cannot be stored | Owner creates Supabase prod + separate staging project (EU region, PITR) and connects them to `abrahammoses` (Production / Preview) | Infra | — | E1 passes against staging | BLOCKED_EXTERNAL | No Supabase integration or variables (Vercel API, 2026-10-20) |
| B2 | P0 | No identity provider: every caller is anonymous, decisions answer 401 | Owner enables Supabase Auth, sets `AUTH_PROVIDER=supabase`, decides self-registration policy | Auth | B1 | E2 role matrix passes against staging | BLOCKED_EXTERNAL | `/api/evidence/proposals/{id}/decision` → 401 in production |
| B3 | P0 | No editors: approval needs an editor who is not the proposer | Owner names the first editorial administrator and research editors | Editorial | B2 | A proposal approved by a second editor creates a new version + audit row | BLOCKED_EXTERNAL | 0 role grants |
| B4 | P1 | No external scholarly review | Owner recruits real reviewers (consent, affiliation, COI) | Editorial | B2 | `externally_reviewed` revision with attestation | BLOCKED_EXTERNAL | 0 reviewers on record |
| B5 | P1 | No AI provider key or budget | Owner sets `ANTHROPIC_API_KEY` (server), spend cap, models | AI | E7 | Live analysis returns `provider.active = anthropic` | BLOCKED_EXTERNAL | `EVIDENCE_PROVIDER` set; no key name present |
| B6 | P1 | No privacy or editorial contact | Owner sets `ABRAHAMMOSES_PRIVACY_CONTACT`, `ABRAHAMMOSES_CONTACT` (own addresses) | Legal | — | `/status` `legal_contact` = pass | BLOCKED_EXTERNAL | `/status` warn |
| B7 | P1 | Legal review of privacy v1.1, terms and the institutional wording | Owner obtains legal review | Legal | B6 | Dated owner sign-off | BLOCKED_EXTERNAL | — |
| B8 | P2 | Previews are behind Vercel Authentication; automated HTTP tests need a bypass secret | Owner creates a Protection Bypass for Automation secret (or accepts production-only non-mutating checks) | CI | — | `security-smoke.mjs` runs against a preview from CI | BLOCKED_EXTERNAL | Share links used manually |
| B9 | P2 | HSTS `includeSubDomains`/`preload` would bind every subdomain of abrahammoses.com | Owner decision | Security | — | Header present after decision | BLOCKED_EXTERNAL | Currently `max-age=63072000` only |
| B10 | P1 | Pilot reservation link takes real payments; terms of sale are a draft pending legal review and the seller's legal entity details are not published | Legal review of `/institutional/decision-twin/terms`; publish entity details (registered name, org number, address, VAT number) and a contact | Legal | — | Terms marked final; entity details and contact shown | BLOCKED_EXTERNAL | Draft terms added in PR #15 (owner-specified content); review and entity details pending |
| E1 | P0 | Migrations never applied to a hosted DB; durability unproven | Apply migrations to staging; run draft → save → restart → retrieve → challenge → published unchanged → second-editor approve → new version + audit → backup restore | DB | B1, B2 | Scripted acceptance run against staging | NOT_STARTED | — |
| E2 | P0 | Visitor writes would use the service role; RLS not yet the enforcing layer for real users | Use the caller's JWT for writes; test all 6 roles × actions, plus forgery | Auth/DB | B1, B2 | Role-matrix test against staging | IN_PROGRESS | Roles/permissions + 29 local RLS checks (`tests/security.test.ts`, `supabase/tests/rls_test.sql`) |
| E3 | P1 | Rate limits and quotas are per instance, in memory | Durable limiter (DB table or Upstash) | Security | B1 | Limit holds across instances | NOT_STARTED | — |
| E4 | P1 | `npm audit`: 3 high, 1 moderate (postcss, sharp, source-map-js via next) | next 15.5.28 + overrides (postcss ^8.5.31, sharp ^0.35.5, source-map-js ^1.2.2) | Deps | — | `npm audit --audit-level=high` in CI = 0 | TESTED | PR #14: `npm audit` 0 vulnerabilities; CI job `checks` |
| E5 | P1 | No CSP; `x-powered-by` not disabled; deprecated `interest-cohort` policy | CSP (self-only, no plugins/foreign frames), HSTS 2y, `poweredByHeader: false`, COOP, Permissions-Policy updated | Security | — | `tests/hardening.test.ts`; e2e finds no console/CSP errors | TESTED | PR #14 |
| E6 | P1 | No CI | GitHub Actions on PRs: typecheck, lint, unit, contract/MCP, record lock, npm audit, migrations + RLS on a PostgreSQL service, build, Playwright e2e + axe, HTTP security regression | CI | — | Workflow green on the PR | TESTED | PR #14 checks |
| E7 | P1 | Silent provider fallback; legacy default model IDs | `providerStatus()` reports configured vs active; analyze responses carry `provider`; `/status` check `ai_provider`; defaults `claude-haiku-5-5` / `claude-opus-5-5` (Anthropic models overview, 2026-10-20); provider error bodies no longer quoted | AI | — | `tests/hardening.test.ts` | TESTED | PR #14 |
| E8 | P1 | Server error logs could carry request text (error messages) | `logServerError` writes class + stack frames only; analyze 500 no longer echoes `err.message` | Security | — | `tests/hardening.test.ts` | TESTED | PR #14 |
| E9 | P2 | `/research?q=` keeps derived search keywords (not the question) in request URLs; `/api/v1/search?q=` is a public GET by design | Document; consider POST for search | Privacy | — | Privacy text matches behaviour | NOT_STARTED | `src/app/research/ask/route.ts` |
| E10 | P1 | No error alerting beyond Vercel runtime logs | Vercel log drain / alert on `type:"error"` and `type:"security"` lines; status split into the seven states | Ops | — | Alert fires on a test error | NOT_STARTED | — |
| E11 | P2 | ID mapping not loaded into `id_mappings` | Review `docs/ID_MAPPING.md`, load in staging | Data | B1 | Integrity checker resolves every ID | NOT_STARTED | — |
| E12 | P2 | CSP allows inline scripts (App Router streaming + theme script) | Nonce CSP would force per-request rendering of every page; revisit with a measured cost | Security | — | Nonce CSP with no regression in e2e | NOT_STARTED | Trade-off recorded in `next.config.mjs` |
| E13 | P1 | Source verification states (internally catalogued … externally reviewed) not modelled; 35 sources not checked | Model the seven states; check each source; publish a report; never fabricate | Research | — | Report lists all 35 with evidence per state | NOT_STARTED | 0 externally verified today |
| E14 | P1 | Record and EI registry not unified (Source → … → Revision) | Shared IDs + integrity checker across web/REST/MCP | Data | E11 | Checker passes; REST = MCP (test J) | NOT_STARTED | — |
| D1 | P1 | No Institutional Decision Room | `/institutional/decision-room` with the Private Credit Decision Twin (synthetic) | Institutional | — | Tests F, G, H, I + e2e + axe | TESTED | PR #15 (unit 350/5 skipped, e2e 31/31 incl. axe + 390px) |
| D2 | P2 | `/institutional/use-cases` (8 sectors × 3 × 3) | Framework after the flagship; label each by status | Institutional | D1 | Each use case labelled Operational/Demonstration/Planned | NOT_STARTED | — |
| D3 | P0 (before any client data) | Tenant isolation (public research / public synthetic / private tenant) untested | DB, API, storage and app isolation tests | Security | B1, B2 | Test K | NOT_STARTED | No private workspaces exist; none may be offered |
| D4 | P1 | No product page for the AbrahamMoses Decision Twin | `/institutional/decision-twin`: brand, six layers with demonstrated/planned status, per-decision configuration (also in every passport), planned workspace defaults, legal status, owner-approved pricing (pilot payment link only; contact pending) | Institutional | D1 | e2e: status line, legal note, exactly one Stripe link, no invented contact; unit: config snapshot in passport hash | TESTED | PR #15 (unit 356, e2e 32/32) |

## Closed

| ID | What | Status | Evidence |
|---|---|---|---|
| P0-1 | Anonymous requests could mutate published assessments | VERIFIED | PR #12; production security check 2026-10-20 (analyze 503, cross-origin 403, decide 401, published list unchanged) |
| P0-2 | Silent non-durable store fallback on deployed runtimes | VERIFIED | PR #12; `tests/store-selection.test.ts`; production analyze → 503 |
| R1 | OpenAPI missing Evidence endpoints; HEAD 405; false privacy statement; untrue "tested on every build" | VERIFIED | PR #13; production smoke 2026-10-20 (32 paths, HEAD 200, privacy v1.1) |

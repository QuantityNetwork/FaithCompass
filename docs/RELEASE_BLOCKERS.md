# Release-blocker register

The single list of what stands between AbrahamMoses and each release gate (Master Prompt 3, §16).
Owner: Sagolik. Last updated 2026-10-20 (Stage 1). Close an item only with evidence (a commit, a test run, a dated decision).

Status: **OPEN** blocks a gate · **OWNER** needs something only the owner can provide · **DONE** closed with evidence.

## Needs the owner

| # | What is needed | Why | Unblocks | Status |
|---|---|---|---|---|
| B1 | **A Supabase project for production.** Either (a) connect the Supabase integration to Vercel project `abrahammoses` (team markus-andersson-s-projects), which injects `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`; or (b) create a project yourself and add those four as Vercel env vars (Production, and Preview pointing at a **separate** staging project). Region: an EU region is recommended (privacy, §13). Plan with daily backups and point-in-time recovery for the restore test. | Every durable write (drafts, proposals, editorial decisions, audit) is refused (503) until a database exists. No process-memory store may be used (§4). | Stage 2; §3 DB acceptance tests; §4 restart/redeploy test | OWNER |
| B2 | **Identity provider decision and setup.** Recommended: Supabase Auth (email magic link plus optional ORCID/Google for reviewers). Then set `AUTH_PROVIDER=supabase` in Vercel. Decide who may self-register (contributors only; editors and reviewers are granted, never self-assigned). | Without it every caller is an anonymous reader: editorial decisions return 401 by design and no one can approve anything. No login is simulated. | Editorial workflow (Stage 5), contributor accounts | OWNER |
| B3 | **The first editorial administrator and research editors** (names, accounts). Role grants are created by the service, never through the site, and need a second person: `role_grants.granted_by <> user_id`. | Approval needs an editor who is not the proposer. With one person there can be no approval of one's own work. | Any approval; any "editor-approved" state | OWNER |
| B4 | **Qualified scholarly reviewers** (real people, with consent, affiliation, expertise and conflict-of-interest statements). | §8: no invented reviewers. Until then, nothing may be shown as externally reviewed; the site currently says 0. | `externally_reviewed`; Stage 8 certification | OWNER |
| B5 | **AI provider key and budget.** `ANTHROPIC_API_KEY` (server-only), a monthly spend cap set at the provider, and a choice of models. Current code defaults (`claude-opus-5`, `claude-haiku-4-5-20251001`) are listed as legacy-but-available by Anthropic as of 2026-10-20; current IDs are e.g. `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5`. | Without a key the research assistant can only serve the 5 curated subjects. If `EVIDENCE_PROVIDER=anthropic` is set without a key the code silently falls back to the curated provider (P1-A2), which must be fixed before a key is added. | Stage 4 | OWNER |
| B6 | **Privacy and editorial contacts.** Set `ABRAHAMMOSES_PRIVACY_CONTACT` and `ABRAHAMMOSES_CONTACT` (addresses you control), and confirm operator identity text for /privacy and /about. Legal review of the privacy page is recommended before accounts or stored questions go live. | /privacy and /about say "will be published here"; the status check `legal_contact` warns. Accounts and stored drafts create personal data. | Accounts (B2), stored drafts (B1); §13 | OWNER |
| B7 | **Vercel preview access for automated tests.** Either a Protection Bypass for Automation secret (Project → Settings → Deployment Protection), shared with the test runner, or approval to run the HTTP security test against production only (non-mutating). | Previews are behind Vercel Authentication, so the real-HTTP security test cannot reach them without it. | Release gate "test the exact build" (§15 J) | OWNER |

## Engineering (no owner input needed)

| # | What | Unblocks | Status |
|---|---|---|---|
| E1 | Apply `supabase/migrations/*` to the staging project from B1, run `npm run test:rls` equivalents against it, then the §4 durability test (draft → restart → reload → challenge → audit → published unchanged until approval) against the real DB. | Stage 2 | OPEN (needs B1) |
| E2 | Move visitor writes from the service role to the caller's own JWT so RLS, not only the app, enforces §3. | §3 "RLS too, not service-role-only" | OPEN (needs B1, B2) |
| E3 | Durable rate limits and quotas (table or Upstash/KV) instead of per-instance memory. | §3 quotas; abuse protection | OPEN (needs B1) |
| E4 | `npm audit`: 3 high, 1 moderate (postcss, sharp, source-map-js via next). Fix available. | Security gate | OPEN |
| E5 | Content-Security-Policy, HSTS confirmation, remove `x-powered-by`. | Security gate | OPEN |
| E6 | CI (typecheck, record:check, unit, RLS on local Postgres, e2e) on every PR. | Release gates | OPEN |
| E7 | Remove the silent provider fallback; report provider availability honestly on /status. | Stage 4 | OPEN |
| E8 | Error reporting and alerts (§14); status page split into the seven states. | Ops gate | OPEN |
| E9 | ID mapping (docs/ID_MAPPING.md) reviewed and loaded into `id_mappings`. | Stage 2 | OPEN |

## Closed in Stage 1

| # | What | Evidence |
|---|---|---|
| P0-1 | Anonymous requests could mutate published Evidence Intelligence scores whenever a writable store was active (the default file store in development, or Supabase once configured). | Branch `stage1-security`: challenges become proposals; decisions need an authenticated editor who is not the proposer; `tests/security.test.ts`; `scripts/security-smoke.mjs` |
| P0-2 | Silent non-durable fallback: with nothing configured a deployed build defaulted to the file store. | `src/lib/evidence/store/index.ts` now picks the read-only memory store on a deployed runtime; `durable` flag; `tests/store-selection.test.ts` |

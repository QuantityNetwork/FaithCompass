<p align="center">
  <img src="public/brand/sagolik-mcp-lockup.svg" alt="Sagolik MCP" height="44">
</p>

<p align="center"><strong>The agent interface to Sagolik.</strong></p>

Sagolik MCP (`mcp.sagolik.com`) is a controlled gateway that lets AI clients — Claude, ChatGPT, Cursor and custom agents — work with Sagolik's property, financing, closing and ownership infrastructure through the [Model Context Protocol](https://modelcontextprotocol.io). Agents call **business-level tools**, never databases or raw APIs, and every call passes the same pipeline:

```
AI client → MCP endpoint → authentication → authorization → policy → tool registry
          → execution → Sagolik services → external providers
          → structured envelope + immutable audit record
```

Agents may **understand, simulate and prepare** freely within their grants. Anything that changes real-world state (**execute**) requires an explicit, single-use human approval bound to the exact arguments.

---

## Contents

- [What's included](#whats-included)
- [Quick start (demo mode)](#quick-start-demo-mode)
- [Connecting an agent](#connecting-an-agent)
- [Architecture](#architecture)
- [Configuration](#configuration)
- [Running live on Supabase](#running-live-on-supabase)
- [Deploying to Vercel](#deploying-to-vercel)
- [Testing](#testing)
- [Security model](#security-model)
- [Known limitations](#known-limitations)

## What's included

| Area | Details |
| --- | --- |
| **MCP server** | Streamable HTTP (stateless JSON) at `/mcp` (production) and `/sandbox/mcp` (sandbox). `initialize`, `ping`, `tools/list`, `tools/call`; protocol versions 2025-11-25, 2025-06-18, 2025-03-26 and 2024-11-05. |
| **29 tools** | Property, financing, closing, documents, cash flow, Autopilot, ownership and governance. Each has a model-facing description (when to use / when not / required context / authorization class / example), Zod-validated input and output, JSON Schema 2020-12, version and lifecycle. |
| **Execution classes** | `READ`, `SIMULATE`, `PREPARE`, `EXECUTE`. Execute tools always require approval; the database enforces it too. |
| **Policy engine** | Ordered rules: tool lifecycle, environment, session, scopes, per-tool denials, connection class ceiling, member role, production execute guard, transaction limits, approval. Every decision is recorded with its reasoning. |
| **Approvals** | Human-readable requests (*"Claude is requesting permission to activate Sagolik Autopilot for Property #SGK-1042…"*), fingerprint-bound to tool, version, arguments, requester and environment; single use; expiring; replays return the original result. |
| **OAuth 2.1** | Authorization code + PKCE (S256 only), dynamic client registration (RFC 7591), resource indicators (RFC 8707), protected-resource and authorization-server metadata (RFC 9728 / RFC 8414), revocation (RFC 7009), `iss` in responses (RFC 9207), refresh rotation with reuse detection. Scoped, environment-bound, no wildcards. |
| **Audit** | One append-only, per-organization hash-chained record per invocation, including denials. Independently verifiable (see *Documentation → Audit*). Filters and CSV export. |
| **Console** | Overview, Connections (wizard, per-tool toggles, revoke), Tools and Tool Explorer (form + JSON, request/response/policy/schema/latency/audit id), Approvals, Audit, Webhooks, API keys & OAuth clients, Settings, environment switcher with a persistent environment indicator. |
| **Webhooks** | HMAC-SHA256 signed (`Sagolik-Signature: t=…,v1=…`), rotation with a 24 h grace period, SSRF guard, retries at 1 min / 5 min / 30 min / 2 h / 12 h, manual retry. |
| **Data** | Supabase Postgres schema (42 tables) with UUID keys, composite tenant foreign keys, Row Level Security, append-only audit triggers and RPCs. Generated `Database` types with a compile-time TypeScript ↔ SQL parity check. |
| **Providers** | Provider-neutral open-banking interface. Plaid is implemented as one provider and stays disabled until configured; the sandbox uses clearly labeled synthetic data. Sagolik is not a bank and moves no money. |
| **Public site** | Landing page, security model, sandbox overview and 17 documentation pages. |

## Quick start (demo mode)

Requirements: Node.js 22+.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. Without Supabase credentials the app runs in **demo mode**: an in-memory store, sandbox only, signed in as a demo operator. The demo workspace is seeded by running a real scripted agent session through the gateway, so the overview, audit log and approval queue contain genuine records (15 audit entries, one pending approval) rather than placeholder numbers. Production is empty and unavailable in demo mode.

The fictional sandbox scenario: **245 Mercer Avenue, Austin, TX** (`SGK-1042`) — purchase price $875,000, 25% down, loan $656,250, closing October 26.

Try:

1. **Connections → Connect Agent** — create a sandbox token; the wizard performs the MCP handshake and a first tool call.
2. **Tool Explorer** — run `compare_financing_scenarios`, then `activate_property_autopilot` to see an approval request.
3. **Approvals** — review and approve it; the agent's retry with the `approval_id` executes once.
4. **Audit** — every step, hash-chained.

## Connecting an agent

| Endpoint | Purpose |
| --- | --- |
| `https://mcp.sagolik.com/sandbox/mcp` | Sandbox MCP endpoint (synthetic data) |
| `https://mcp.sagolik.com/mcp` | Production MCP endpoint |
| `/.well-known/oauth-protected-resource/{sandbox/mcp,mcp}` | Protected resource metadata |
| `/.well-known/oauth-authorization-server` | Authorization server metadata |
| `/oauth/authorize`, `/oauth/token`, `/oauth/register`, `/oauth/revoke` | OAuth 2.1 |

**Claude** (custom connector): add `https://mcp.sagolik.com/sandbox/mcp`. Claude discovers OAuth from the `401` challenge, registers itself, and sends you to the consent screen, where you choose the organization, permissions and expiry.

**Claude Code** (connection token from the console):

```bash
claude mcp add --transport http sagolik-sandbox https://mcp.sagolik.com/sandbox/mcp \
  --header "Authorization: Bearer $SAGOLIK_SANDBOX_TOKEN"
```

**Cursor** (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "sagolik-sandbox": {
      "url": "https://mcp.sagolik.com/sandbox/mcp",
      "headers": { "Authorization": "Bearer ${env:SAGOLIK_SANDBOX_TOKEN}" }
    }
  }
}
```

Tokens are environment-bound: `sgk_test_…` only works on `/sandbox/mcp`, `sgk_live_…` only on `/mcp`.

## Architecture

```
src/
  app/
    (site)/            landing, security, sandbox overview
    (console)/         console, connections, tools, explorer, approvals, audit, webhooks, clients, settings
    docs/              developer documentation
    mcp/, (site)/sandbox/mcp/   MCP endpoints (production / sandbox)
    oauth/, .well-known/        OAuth 2.1 authorization server and metadata
    api/health, api/cron/maintenance
  domain/              environments, execution classes, scopes, entities, finance math
  server/
    gateway/           callTool pipeline, policy engine, approvals, rate limiting, envelope
    tools/             tool registry and the 29 tool implementations
    auth/              tokens, bearer auth, OAuth, console sessions
    mcp/               JSON-RPC protocol and Streamable HTTP handler
    store/             Store interface; MemoryStore (demo) and SupabaseStore (live)
    integrations/      provider-neutral financial data and payment interfaces; Plaid
    webhooks/          signing, delivery, SSRF guard
    sandbox/           synthetic dataset and demo seeding
  components/          UI (Tailwind v4, no component library)
supabase/migrations/   schema, RLS, triggers and RPCs
tests/                 unit, workflow, protocol, database and integration suites
```

**Every tool response** uses one envelope:

```json
{
  "status": "success",
  "tool": "get_closing_status",
  "version": "1.0",
  "environment": "sandbox",
  "request_id": "…",
  "audit_id": "…",
  "summary": "…",
  "data": { },
  "warnings": [],
  "requires_approval": false,
  "meta": { "execution_class": "read", "state_changed": false, "duration_ms": 12 }
}
```

Other statuses: `partial`, `needs_clarification` (the gateway never guesses identifiers), `needs_input`, `approval_required`, `denied`, `unavailable` and `failed`. Errors carry a structured `error` with a stable code (for example `insufficient_scope`, `rate_limited`, `loop_detected`, `idempotency_conflict`, `approval_mismatch`) and, where useful, `retry_after_seconds`.

## Configuration

Copy `.env.example` to `.env.local`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `SAGOLIK_PUBLIC_URL` | Production | Public origin, e.g. `https://mcp.sagolik.com`. Used for OAuth metadata, resource indicators and links. Falls back to the request host. |
| `NEXT_PUBLIC_SUPABASE_URL` | Live | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Live | Browser-safe anon key (sign-in and session refresh only; the browser never writes data). |
| `SUPABASE_SERVICE_ROLE_KEY` | Live | **Server only.** Used by the gateway after policy evaluation; every query is tenant-scoped. |
| `SAGOLIK_ENCRYPTION_KEY` | Live | 32 random bytes, base64 (`openssl rand -base64 32`). AES-256-GCM for webhook secrets and provider credentials. Startup fails without it in live mode. |
| `SAGOLIK_MODE` | Production | `live` requires Supabase and fails at startup without it — set it in production so a deployment never silently falls back to the in-memory demo. `demo` forces demo mode. |
| `CRON_SECRET` | Live | Bearer secret for `/api/cron/maintenance` (webhook retries, expiry purges). |
| `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` | No | Enables the Plaid provider (`sandbox` or `production`). Absent means disabled — never simulated. |

The app runs **live** when all three Supabase variables are set, otherwise in demo mode.

## Running live on Supabase

1. **Create a Supabase project.**
2. **Apply the migrations** in `supabase/migrations/` in filename order — with the Supabase CLI (`supabase link --project-ref <ref>` then `supabase db push`; run `supabase init` first if the repository has no `supabase/config.toml`), or by running each file in the SQL editor.
3. **Configure Auth:** set the Site URL to your public origin and add `<origin>/auth/callback` to the redirect URLs. Email + password and magic links are supported.
4. **Set the environment variables** above.
5. **Sign in** at `/login`. Onboarding creates your organization (you become its owner) and seeds its sandbox with the synthetic dataset. Production starts empty, and production execution stays off until an owner enables it in Settings.

After changing a migration, regenerate the typed client and re-run the database suite:

```bash
npm run db:types    # applies all migrations to an in-process Postgres and writes database.types.ts
npm run db:verify   # migrations, RLS, composite FKs, audit immutability, RPCs
```

## Deploying to Vercel

1. Import the repository; the framework preset is detected (Next.js).
2. Add the environment variables for **Production** (and Preview if used). Keep `SUPABASE_SERVICE_ROLE_KEY`, `SAGOLIK_ENCRYPTION_KEY` and `CRON_SECRET` server-only — never with a `NEXT_PUBLIC_` prefix.
3. Point `mcp.sagolik.com` at the project and set `SAGOLIK_PUBLIC_URL=https://mcp.sagolik.com`.
4. `vercel.json` schedules `/api/cron/maintenance` once a day (the Hobby plan's limit); Vercel sends `CRON_SECRET` as a bearer token. On a plan that allows sub-daily jobs, change the schedule to `*/5 * * * *` so webhook retries follow their backoff schedule closely.

Demo mode keeps state in process memory, so it is intended for local use and single-instance previews, not for serverless production.

## Testing

```bash
npm run check          # typecheck + lint + full test suite (74 tests)
npm run build          # production build
```

| Suite | Covers |
| --- | --- |
| `tests/tools.test.ts` | Registry metadata, every tool against the sandbox dataset, tool catalog persistence |
| `tests/gateway.test.ts` | KNOW → ANALYZE → SIMULATE → PREPARE → APPROVE → EXECUTE → AUDIT, policy denials, idempotency, loop detection, rate limits, tenant and environment isolation, audit chain |
| `tests/mcp-http.test.ts` | JSON-RPC over HTTP, 401 discovery, OAuth code + PKCE, refresh rotation and reuse detection, revocation |
| `tests/webhooks.test.ts` | Signing, rotation, SSRF guard, delivery, retries, secrets at rest |
| `tests/db/` | Migrations in Postgres (PGlite): RLS, composite tenant keys, append-only audit and tamper detection, RPCs, SQL/TypeScript hash agreement |

**Supabase data path.** `npm run test:postgrest` runs the tools, gateway, MCP/OAuth and webhook suites through `SupabaseStore → supabase-js → PostgREST → Postgres` with every migration, grant and RLS policy applied (the database is PGlite behind a Postgres wire-protocol socket):

```bash
POSTGREST_BIN=$(./scripts/fetch-postgrest.sh) npm run test:postgrest
```

## Security model

- **No direct data access for agents.** Only registered business tools; no SQL, table or raw API tools. The registry test fails if one appears.
- **Least privilege.** Scopes per execution class and domain, connection class ceilings, member-role ceilings (viewer → simulate, member → prepare, admin/owner → execute), per-tool denials, optional transaction limits.
- **Environments are isolated.** Separate endpoints, environment-bound tokens and connections, and composite `(id, organization_id, environment)` foreign keys so a sandbox record can never reference production data.
- **Multi-tenancy in the database.** RLS lets members read their own organization's rows only; the browser has no write policies. Organization ids from the browser are never trusted — the server resolves membership for every request.
- **Secrets.** Tokens, codes and client secrets are stored as SHA-256 hashes; webhook secrets and provider credentials are encrypted with AES-256-GCM. The service-role key is used only on the server.
- **Audit integrity.** Database triggers reject `UPDATE`, `DELETE` and `TRUNCATE` on audit records for every application role, and the hash chain makes alterations detectable. Keeping periodic copies of the latest `record_hash` outside Sagolik extends that to changes made by a database administrator.
- **Abuse controls.** Per-requester and per-tool rate limits, an organization-wide ceiling, and loop detection for repeated identical calls.

The security page describes controls the platform is *designed to support*; it makes no certification or compliance claims.

## Known limitations

- **No money movement.** No payment provider is connected for production. Production Autopilot activation records reminders and tracking only (`execution_mode: "reminder_only"`); the sandbox uses a simulated payment provider that is labeled as such.
- **Plaid** is implemented against Plaid's documented API but is not exercised against Plaid in this repository's tests; it stays disabled until credentials are configured.
- **Streaming.** The MCP endpoint runs in stateless JSON mode: no server-initiated messages over GET/SSE (GET returns `405`).
- **Hosted Supabase.** The store is verified against PostgREST and Postgres locally (see *Testing*), not against a hosted Supabase project in CI.
- **Demo state** lives in memory per server process and resets on restart.

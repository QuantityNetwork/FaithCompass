# AbrahamMoses

**Structured Theological Intelligence**

A working, inspectable research instrument for theology: a revisioned record of
sources, claims, covenants, doctrine and traditions, in which every conclusion
records what it rests on and can be challenged — by rejecting an assumption and
watching the actual dependency graph recalculate, without any source being
altered and without the system pretending the disagreement has gone away.

People use it through the website; applications through a REST API; AI agents
through an MCP server. All three read the same record, from one canonical host.

- [What is here](#what-is-here)
- [The review, finding by finding](#the-review-finding-by-finding)
- [Running it](#running-it)
- [Configuration](#configuration)
- [Deploying](#deploying)
- [The record and the editorial workflow](#the-record-and-the-editorial-workflow)
- [The dependency model](#the-dependency-model)
- [Machine access](#machine-access)
- [Testing](#testing)
- [What still needs a person](#what-still-needs-a-person)
- [Evidence Intelligence](#evidence-intelligence)

## What is here

| Area | Where | What it does |
| --- | --- | --- |
| **The record** | `src/lib/record/` | 74 claims in four research cases, 13 reading principles (axioms), 24 derivations, 17 counter-models, 15 covenant and 29 doctrine relationships, 11 traditions, 79 cited works with editions. Validated by Zod at load and in tests. |
| **Dependency engine** | `src/lib/record/engine.ts` | Least-fixed-point evaluation with AND/OR semantics, report-vs-warrant distinction, cycle handling, map-edge grounding, tradition lenses, explanations. Pure TypeScript — runs on the server and in the browser. |
| **Website** | `src/app/` | Server-rendered pages: research workspace, four research cases with the Dependency Explorer, Claim Ledger with revisions and citations, Covenant Map, Doctrine Graph, Tradition Layer and comparator, Hermeneutics with a proof console, corpus coverage, methodology, about and governance, changelog, developers, status, privacy, terms. |
| **REST API v1** | `src/lib/api/v1.ts` → `/api/v1` | 28 endpoints from one registry; OpenAPI 3.1 and JSON Schemas generated from the same Zod definitions the responses are tested against. |
| **MCP server** | `src/lib/mcp/` → `/mcp` | Streamable HTTP (stateless JSON): 14 read-only tools with input and output schemas, resources, prompts. Tested end to end with the official SDK client. |
| **Legacy API** | `src/lib/api/legacy.ts` → `/api/public/*` | The original endpoint shapes, kept for Doctrine Lab and the Sagolik sandbox; additive changes only. The manifest URL also accepts MCP over POST. |
| **Evidence Intelligence** | `src/lib/evidence/` → `/evidence` | Claim-level assessment of historical and textual evidence ([below](#evidence-intelligence)). |

## The review, finding by finding

The October 2026 website review (P0–P2 findings and §§4–12 recommendations) and
what this branch does about each. "Verified" means a test in this repository
checks it.

| Review item | What was built | Verified by |
| --- | --- | --- |
| **P0 · MCP endpoint inconsistent** (`abrahammoses.org` vs `am.sagolik.com`; manifest only, no JSON-RPC) | Every printed URL comes from one setting, `ABRAHAMMOSES_PUBLIC_ORIGIN`. A real MCP server at `/mcp`: `initialize`, `tools/list`, `tools/call`, resources, prompts, protocol 2024-11-05 → 2025-11-25. `/api/public/mcp` also speaks MCP. The status page checks the documented host against the serving host. | `tests/mcp.test.ts` (protocol, transport, official SDK client over HTTP at both URLs, output-schema validation); `tests/api.test.ts` ("documents one host only") |
| **P0 · Privacy and Terms not verifiable** (both returned 404 on the live site) | Standalone `/privacy` and `/terms`, written from the system’s actual data flows: no accounts, no cookies, no analytics, research traces kept on the reader’s device with export and delete, GDPR Article 9 addressed. | `tests/site-links.test.ts` (every header/footer link resolves), e2e |
| **P1 · Pages depend on dynamic loading** | All research pages are server-rendered; the explorer renders its initial state on the server, and every toggle is a real link, so it works without JavaScript. An error boundary replaces indefinite loading states. | e2e: "delivers the record in the HTML", "renders a simulation server-side … without JavaScript" |
| **P1 · No working research query** | `/research`: ask without signing in; retrieval over published records (reference parsing, transliteration-aware), guardrails for tradition-ranking requests, results grouped as sources · claims · traditions · provenance. No text is generated. | `tests/api.test.ts` (search contract), e2e "research workspace" |
| **P1 · Coverage and editorial authority** | `/corpus` (every work, edition, citation count, stated gaps), `/methodology` (every criterion published), `/about` (status, relationships, editorial responsibility), `/changelog`, per-revision editorial and machine-involvement disclosure, `/status` with outstanding editorial work. | `tests/record.test.ts` |
| **P1 · Christian-centred** | Four flagship cases developed to the same minimum depth — Jewish (Torah permanence), Christian (priesthood), Islamic (Ibrāhīm, lineage, revelation), Latter-day Saint (Restoration and authority) — each asked in its own tradition’s categories, with responses marked *addresses*, *asks a different question* or *not comparable*. Doctrine Graph opens on Abraham; Covenant Map shows four readings; no default tradition lens; lists ordered by historical emergence. “Contemporary witness” renamed. | `tests/record.test.ts` ("same minimum depth", "explicit non-comparability", "renames Contemporary witness") |
| **P2 · Branding** | The AbrahamMoses corporate logo (“A” mark and the one-line “AbrahamMoses” wordmark), traced from the supplied master to vectors (see [Brand](#brand)), in the header, footer, icons and social preview — never the “Institute” lockup. The homepage introduction is built on the four-ring emblem. Partner identities named in text; organisational status stated without implying accreditation or independence. The mislabelled `doctrine-lab-logo.jpeg` lives in the Lovable project and must be fixed there. | `tests/brand.test.ts`; `tests/e2e/site.e2e.ts` ("brand and emblem introduction") |
| **P2 · SEO, performance, accessibility** | Per-route metadata in `<head>` for every client, canonical links, JSON-LD, sitemap with every claim, robots rules; WCAG 2.2 AA fixes (contrast, target size, focusable regions, skip link, keyboard-operable graph). | e2e: axe scan of 25 pages (0 violations), no overflow at 360px, no console errors. Lighthouse (mobile, throttled) below. |
| **§5A · Reproducible claims** | Stable code and revision, primary witness, edition, translation and licence, classification, evidence, variants, confidence, attribution, counterviews, editorial history, machine involvement — on every claim, in the UI, API and MCP. | `tests/api.test.ts` ("full §5A metadata") |
| **§5B · Confidence taxonomy** | Textual, philological, historical and inferential axes, each with five written criteria and “not applicable”; traditional acceptance as a per-tradition matrix. Never combined. | `/methodology`; schema |
| **§5C · Exact rejection logic** | AND/OR derivations, multiple proofs, cycles, contested assumptions, versioned evidence. | `tests/record-engine.test.ts`; `tests/record.test.ts` pins corrections against the published engine |
| **§11 · Living Research Record** | Append-only revisions pinned by content hash; any revision readable and citable; field-level diffs; text, BibTeX and CSL-JSON citations; printable provenance report; full-record export. | `tests/record.test.ts` (revision lock), `npm run record:check` |
| **§11 · Developer gateway** | `/developers` with live examples generated by the handlers, schema explorer, error codes, rate limits, versioning, client configurations; `/status` with live self-tests. | `tests/api.test.ts` |
| **§13 · The milestone** | On each case page: pick a question, see two opposing interpretations, inspect every premise, reject a disputed assumption, watch the graph recalculate — sources untouched, the rival position still on screen. | e2e "Dependency Explorer"; `tests/record.test.ts` ("the guided walkthrough") |

**Lighthouse** (mobile, simulated throttling, production build): performance
98–99, accessibility 100, best practices 100, SEO 100; LCP 1.7–1.9 s, CLS 0,
TBT 70–130 ms on `/`, a research case and `/developers`. Lab figures, not field
data: Core Web Vitals at the 75th percentile need real-user monitoring after
deployment.

## Running it

```bash
npm install
npm run dev                 # http://localhost:3000
npm run check               # typecheck + revision lock + 245 unit/contract tests
npm run build
npm run test:e2e            # Playwright + axe against the production build
```

Node 18.18 or later (20+ recommended). No API key or database is needed to run the site, API or MCP
server: the record ships with the code. The e2e suite uses the Chromium at
`/opt/pw-browsers/chromium` when present, or `CHROMIUM_PATH`.

Try the MCP server locally with Claude Code:

```bash
claude mcp add --transport http abrahammoses http://localhost:3000/mcp
```

## Configuration

| Variable | Needed | Purpose |
| --- | --- | --- |
| `ABRAHAMMOSES_PUBLIC_ORIGIN` | Production, **at build and run time** | Canonical origin, e.g. `https://abraham.sagolik.com`. Every URL in pages, API responses, the MCP manifest, canonical links and the sitemap uses it. Unset, a Vercel preview names its own branch URL, a Vercel production build names the project’s production domain, and anything else names `http://localhost:3000`. Set it for Production only, so previews keep their own URL. |
| `ABRAHAMMOSES_LEGACY_ORIGINS` | After a domain move | Comma-separated previous canonical origins that keep serving this deployment, e.g. `https://abraham.sagolik.com`. They are listed as secondary `servers` in the OpenAPI document, named on `/developers`, and accepted by the `/status` canonical-origin check. The canonical origin itself is ignored here. |
| `ABRAHAMMOSES_REDIRECT_LEGACY_HOSTS` | Only once the new domain is live, **at build time** | `1` makes every page on a legacy host answer 308 with the same path and query on `ABRAHAMMOSES_PUBLIC_ORIGIN` (`next.config.mjs` → `src/lib/site/legacy-redirects.mjs`). `/api/*`, `/mcp` and `/_next/*` are never redirected, so REST and MCP clients configured with the old host keep working. It has no effect unless `ABRAHAMMOSES_PUBLIC_ORIGIN` is an `https` origin. Off by default. |
| `ABRAHAMMOSES_PRIVACY_CONTACT` | Before promoting the site | Address named in the Privacy Policy. The status page warns while it is unset. |
| `ABRAHAMMOSES_CONTACT` | Recommended | Corrections and enquiries address on About and Terms. |
| `API_RATE_LIMIT_PER_MINUTE` | No | Per-client limit for REST and MCP (default 120). |
| `RECORD_INCLUDE_DRAFTS` | Never in production | `1` serves draft revisions for local editorial preview. |
| `EVIDENCE_PROVIDER`, `ANTHROPIC_API_KEY`, `SUPABASE_*` | Evidence Intelligence only | See [below](#evidence-intelligence). The Privacy Policy describes the AI provider only when one is enabled. |

## Deploying

The app is a standard Next.js 15 application. It is deployed on Vercel as its
own project, **`abrahammoses`**, at <https://abraham.sagolik.com>
(`ABRAHAMMOSES_PUBLIC_ORIGIN` for Production; `abrahammoses.vercel.app` serves
the same deployment). The earlier site at `am.sagolik.com` stays on Lovable,
unchanged.

- **Separate from Sagolik MCP.** The repository's `main` branch holds a
  different app (Sagolik MCP, Vercel project `sagolik-mcp`). The `abrahammoses`
  project's Ignored Build Step, `[ ! -f src/lib/record/record.ts ]`, builds only
  commits that contain this app, so a push to `main` can never replace it.
- **Production is promoted deliberately.** Vercel's production branch for a
  Git-linked project is the repository default (`main`), which this project
  skips. Pushes to this app's branches build previews. To release, deploy a
  commit to production (Vercel dashboard → Deployments → Promote, or
  `vercel deploy --prod` from a checkout). Alternatively, set the project's
  production branch to this app's branch in Settings → Environments.
- **Environment.** `EVIDENCE_PROVIDER=corpus` and `EVIDENCE_STORE=memory`
  (production and preview). With no database, Evidence Intelligence shows its
  curated demonstrations read-only and refuses to save new analyses or
  challenges. To let visitors save them, apply
  `supabase/migrations/20260911000000_evidence_intelligence.sql` to a Supabase
  project, then set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and
  `EVIDENCE_STORE=supabase`.

Steps that remain:

1. Set the contact variables (`ABRAHAMMOSES_PRIVACY_CONTACT`,
   `ABRAHAMMOSES_CONTACT`); `/status` warns until the privacy contact is set.
2. `abrahammoses.org` does not resolve in DNS today; either configure it as an
   alias that redirects to the canonical origin or stop publishing it — this
   app never prints it.
3. If the canonical domain changes, set `ABRAHAMMOSES_PUBLIC_ORIGIN` for
   Production and redeploy — static pages bake it into canonical links.
4. Open `/status`: every self-test should pass, and the canonical-origin check
   confirms the documented host is the one serving requests.

### Moving to abrahammoses.com

The code names no host itself: every canonical link, `metadataBase`, sitemap
and robots entry, Open Graph image URL, the MCP and REST URLs on `/developers`
and the OpenAPI `servers` come from `ABRAHAMMOSES_PUBLIC_ORIGIN`. Merging or
deploying this code therefore changes nothing until the variables change. In
order, and only once `abrahammoses.com` is registered and serves this project
with a valid certificate:

1. Add `abrahammoses.com` (and `www.abrahammoses.com` → apex, 308) to the
   `abrahammoses` Vercel project. Keep `abraham.sagolik.com` on it.
2. Set, for Production: `ABRAHAMMOSES_PUBLIC_ORIGIN=https://abrahammoses.com`
   and `ABRAHAMMOSES_LEGACY_ORIGINS=https://abraham.sagolik.com`. Redeploy and
   promote. Both hosts now serve the site; canonical links, the sitemap and
   documented API URLs name the new one, and the old host is still a listed
   server for API and MCP clients.
3. When ready to move search traffic, also set
   `ABRAHAMMOSES_REDIRECT_LEGACY_HOSTS=1` and redeploy: pages on
   `abraham.sagolik.com` then redirect permanently to `abrahammoses.com`, while
   `/api/*` and `/mcp` keep answering there.
4. Open `/status` on both hosts; the canonical-origin check passes on each.

Setting step 2 before the domain resolves would publish canonical links, Open
Graph images and API URLs that do not work, so do not set it early. Rolling
back is unsetting the variables and redeploying.

## The record and the editorial workflow

```
src/lib/record/
  taxonomy.ts        classifications, roles, statuses, the four confidence axes and their criteria,
                     acceptance stances, dependency types, corpus categories
  schema.ts          Zod schemas for every record type (also the published JSON Schemas)
  data/
    live-import.ts   the published ledger, captured verbatim — revision 1 of claims 184–191
    claims-*.ts      the four research cases
    derivations.ts   the AND/OR structure; published rationales reproduced verbatim
    axioms.ts, counter-models.ts, maps.ts, cases.ts, corpus.ts, traditions.ts
  record.ts          assembly, the public view (drafts removed), record version hash
  engine.ts          the dependency engine
  integrity.ts       the checks used by tests, /status and /api/v1/status
  revisions.lock.json  content hashes of every public revision
```

**Statuses.** `draft` is never served. `provisional` is public, citable and
labelled everywhere it appears. `published` means an editor has verified it;
`externally_reviewed` adds a named outside reviewer. Every revision added in
this migration is provisional and discloses AI assistance.

**Changing a claim.** Never edit a public revision: append revision *n+1*
with a change note, then `npm run record:lock`. The lock script refuses to
rewrite a pinned hash and the test suite fails if a public revision changes.
To publish a provisional revision after verification, append a revision with
`status: 'published'` and the reviewer recorded — the provisional one stays
in the history.

**Integrity.** `checkRecord()` rejects unknown references, unresolved works,
underived interpretations, circular support, and any flagship case below the
shared minimum depth (12 claims, 3 positions, 3 counter-models, 6 tradition
responses). `ref('Hebrews 7:17')` throws at load time for an unknown work, so
an uncheckable citation cannot be built.

## The dependency model

- A claim may have several **derivations**; it holds while **any** one holds.
- Within a derivation, every **necessary** premise and **required** axiom must
  hold. **Supporting** premises and **strengthening** axioms only weaken.
- Claims grounded in a witness (what a text says) keep their standing as
  **reports** when the argument behind them fails; they lose their **warrant**.
  A derivation can require a premise’s report or its warrant.
- Evaluation is a **least fixed point**, so circular support establishes nothing.
- A map edge stays grounded while any grounding claim holds.
- Counter-models are reported as **aligned** or **undermined**; the engine never
  declares a dispute settled.
- A **tradition lens** removes the axioms a tradition rejects or sets aside, and
  nothing else.

Against the published engine (fixtures in `tests/fixtures/live`): rejecting
typology (`AM-AX-002`) used to collapse `AM-CLAIM-000191`; it is now *weakened*,
because the covenant argument of Hebrews 8 (`AM-DRV-0007`) does not need
typology. `AM-DOC-0004` is no longer collapsed while `AM-CLAIM-000186` still
grounds it.

## Machine access

| Interface | URL | For |
| --- | --- | --- |
| MCP | `/mcp` (also `POST /api/public/mcp`) | AI agents and research tools |
| REST v1 | `/api/v1` · `/api/v1/openapi.json` · `/api/v1/schema/{name}` | Applications |
| Legacy | `/api/public/{claims,covenants,doctrine,provenance,dependencies,hermeneutics,connect,mcp,agents}` | Existing clients |

Public and read-only; no key. One error envelope with stable codes; CORS open;
ETags; `RateLimit-*` headers; `X-Record-Version` on every response. Full
reference at `/developers`.

## Testing

| Suite | Covers |
| --- | --- |
| `tests/record.test.ts` | Integrity, equal depth of the four cases, the guided walkthrough, verbatim fidelity to the published ledger, corrected semantics against captured responses, revision lock, draft filtering, machine-involvement labelling |
| `tests/record-engine.test.ts` | AND/OR, multiple proofs, supporting vs necessary, report vs warrant, cycles, map-edge OR grounding, counter-models, lenses, immutability |
| `tests/api.test.ts` | Every v1 endpoint against its published schema, OpenAPI coverage, error contract, CORS, ETag/304, rate limiting, canonical host, legacy shapes against live fixtures |
| `tests/mcp.test.ts` | JSON-RPC protocol, every tool against its output schema, transport (batches, notifications, parse errors, version header, GET), official SDK client end to end |
| `tests/site-links.test.ts` | Every navigation link resolves to a route |
| `tests/brand.test.ts` | Every brand asset derives from the traced logos; emblem geometry; favicon set |
| `tests/legacy-redirects.test.ts` | Legacy-host redirects are off by default and never catch `/api`, `/mcp` or `/_next` |
| `tests/e2e/site.e2e.ts` | Production build in Chromium: server-rendered content, no-JS simulations, sitemap/canonical/robots, 360px layout, console errors, keyboard explorer, lens, local traces, logo, social preview and icons, the emblem introduction (no-JS links, hover and keyboard, reduced motion), axe WCAG 2.2 AA |
| Evidence Intelligence suites | 168 tests ([below](#tests)) |

## Brand

The corporate logo is the supplied master,
`design/brand/corporate/abrahammoses-corporate-master.png`: a rounded-square
“A” mark and the wordmark, set on two lines (“Abraham” / “Moses”). It is traced once to vector
paths (`scripts/brand/trace_corporate.py`, using the potrace CLI at 4× scale)
and stored in `design/brand/corporate/logo-paths.json`. Rendered back over the
master the trace overlaps it with an intersection-over-union of 0.988
(`npm run brand:build -- --check`). The four-ring emblem keeps its own trace
(`design/brand/logo-paths.json`, `scripts/brand/trace_logo.py`) and is used
only by the homepage introduction. `npm run brand:build` derives everything
else from those paths:

| Output | Use |
| --- | --- |
| `public/brand/abrahammoses-logo.svg`, `-ivory.svg` | **Primary logo:** the official one-word lockup, the mark beside “AbrahamMoses” on one line. It is traced from `design/brand/official/abrahammoses-official-navy-on-white.png` (`scripts/brand/trace_official.py` → `design/brand/official/logo-paths.json`, IoU 0.992 against the PNG). Black is for light backgrounds and press; the site's ivory is for the header and footer |
| `public/brand/abrahammoses-wordmark.svg`, `-ivory.svg` | The one-line wordmark alone |
| `public/brand/abrahammoses-logo-stacked.svg`, `-ivory.svg` | Secondary: the stacked lockup as traced (mark and two-line wordmark) |
| `public/brand/abrahammoses-mark.svg`, `-ivory.svg` | The “A” mark alone |
| `public/brand/abrahammoses-emblem.svg`, `-ivory.svg` | The four-ring emblem alone |
| `src/app/icon.svg`, `src/app/apple-icon.png` | Browser and touch icons: the white mark on the logo's navy (`#080E16`) |
| `src/app/opengraph-image.png` | The 1200×630 social preview: the official logo in white on navy |
| `src/components/brand/paths.ts` | Path data, viewboxes and ring geometry for components |

The static favicon set comes from the brand kit, where the 16 px size is
hand-hinted rather than downscaled: `src/app/favicon.ico` (16, 32, 48),
`public/favicon-16x16.png`, `favicon-32x32.png`, `android-chrome-192x192.png`,
`android-chrome-512x512.png` and `maskable-512x512.png`, listed in the web
manifest (`src/app/manifest.ts`).

**The emblem introduction** (`src/components/brand/emblem-intro.tsx`) opens the
homepage. Its four rings are the four research cases, clockwise from the top
in the historical order of their traditions — the same order as the example
questions — and the star they lead into is the shared record. On arrival each
ring lights in turn and traces to the centre. Hovering or focusing a ring, or
the matching question, traces that question and names it; each ring links to
its worked answer, so the figure works without JavaScript. It does not animate
for visitors who prefer reduced motion.

## What still needs a person

These are decisions or facts the code cannot supply:

1. **Editorial verification.** 74 claim revisions, 13 tradition-stance matrices,
   4 translations and all 4 research cases are provisional and AI-assisted.
   An editor should verify references against the named editions and publish
   them as new revisions; the cases should be reviewed by scholars of each
   tradition. Named editors and reviewers should be added as they are appointed.
2. **Legal review.** The Privacy Policy and Terms describe what the code does,
   but they should be reviewed by counsel, and `ABRAHAMMOSES_PRIVACY_CONTACT`
   set, before the site is promoted. If accounts are ever added, the policy must
   change first (special-category data, Article 9 GDPR).
3. **Relationships.** The About page states only what is established: Sagolik
   owns and operates AbrahamMoses; Doctrine Lab and the Sagolik Sandbox are
   clients of its public interfaces. Ownership and licensing between Sagolik and
   Doctrine Lab should be stated there once confirmed.
4. **Domains and assets.** This app is canonical at `abraham.sagolik.com`
   until `abrahammoses.com` is registered and live (see
   [Moving to abrahammoses.com](#moving-to-abrahammosescom)); the Lovable site
   stays at `am.sagolik.com`. The name is written “AbrahamMoses”, one word,
   everywhere; the primary logo is the official one-word lockup. Fix or retire
   `abrahammoses.org`, and correct the `doctrine-lab-logo.jpeg` asset in the
   Lovable project while it stays live.
5. **Agent proposals.** The live manifest describes `POST /api/public/agent/act`
   for editor-issued agent keys. No identities exist, so this branch answers
   401/403 exactly as the live service did; a proposal queue would need an
   authenticated store.


---

## Evidence Intelligence

The question the feature exists to answer:

> **How do we know this — and how certain should we actually be?**

Evidence Intelligence assesses **specific claims** against **specific
evidence**. It does not produce a truth ranking for a religious tradition, and
it is built so that it cannot: a tradition is not the kind of object evidence
bears on, and any interface that scored one would discredit every honest
assessment beside it.

---

### The core commitments

**Claims, not corpora.** A passage is broken into atomic claims, each typed
(textual, historical, archaeological, interpretive, theological, metaphysical
and so on) and each assessed on its own evidence. Daniel 12:1 yields six claims
scoring from 26 to 92: the wording is close to settled, the christological
reading is weakly supported, and averaging them would destroy the only
information worth having.

**Prophecy is shown, not asserted.** A fulfilment claim runs through a dedicated
framework — composition date, earliest attestation, specificity, ambiguity,
retrospective-composition risk, the number of interpretive assumptions the
identification requires, and the competing candidates. Daniel 9:26 scores 25:
the passage names no one, the count has no agreed starting point, and a
competing candidate fits the passage's own historical horizon without a gap.

**Miracle claims keep their boundary.** In the resurrection analysis the
crucifixion under Pilate scores 96 and the early conviction of the first
followers scores 91 — both claims historical method genuinely reaches. The
empty tomb, disputed among scholars who agree about both, scores 55. That God
raised Jesus receives no number at all, and the analysis states explicitly that
the strength of the first three does not transfer to the fourth.

**Three dimensions, never combined.** Textual confidence, historical
corroboration and interpretive confidence are computed and displayed
separately. A text can be securely transmitted and historically uncorroborated
at the same time.

**Models don't produce numbers.** A reasoning provider returns structured factor
assessments — the relevance, directness and independence of specific cited
items, plus bounded penalty estimates. Application logic computes every score
(`src/lib/evidence/scoring.ts`). Analyses run months apart by different
providers stay comparable because the arithmetic is fixed even though the
judgement is not.

**Citations resolve or they are dropped.** Every source reference is checked
against a curated corpus before it can enter an analysis. What does not resolve
is excluded from the evidence ledger and recorded as a flag — never reshaped
into a plausible-looking footnote. Sources that descend from a common original
are discounted through a dependency graph: two chronicles copying one earlier
account are one witness.

**The method knows where it stops.** Claims historical method cannot adjudicate
receive `NOT_DIRECTLY_SCORABLE` rather than a low number. Scoring a metaphysical
claim at zero because archaeology is silent about it would be a category error
dressed as rigour.

**Weak evidence is not falsehood.** `UNSUPPORTED` and `CONTRADICTED` are
different findings. "Contradicted" requires evidence that actually conflicts
with the claim; a pile of weak support never produces it.

---

### Running it

```bash
npm install
npm run dev        # http://localhost:3000/evidence
npm test           # 168 tests
npm run typecheck
npm run build
```

No API key is needed locally. The default reasoning provider is corpus-backed
and deterministic, and storage falls back to a local file.

#### Deploying

Storage must be Supabase in any deployed environment. A serverless host has a
read-only bundle filesystem and wipes `/tmp` between cold starts, so the file
store throws on its first write and every page 500s.

```bash
# 1. Apply the migration to your Supabase project
supabase/migrations/20260911000000_evidence_intelligence.sql

# 2. Set server-side environment variables
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...   # never NEXT_PUBLIC_; bypasses RLS

# 3. Seed the curated analyses (idempotent; safe to re-run)
npm run seed
```

Seeding also happens lazily on first request, so step 3 is optional — but it
makes populating the database a deliberate deploy step rather than a cost paid
by whoever happens to visit first after a cold start.

The store auto-selects Supabase once both are present. `EVIDENCE_STORE=supabase`
forces it and raises if unconfigured, rather than degrading to a store that
cannot persist — a deployment that looks healthy until the first restart loses
everything written since the last one.

A deployment without a database sets `EVIDENCE_STORE=memory` instead. The
curated demonstrations are rebuilt in memory on each instance's first request,
and the routes that would save a visitor's work (`POST /api/evidence/analyze`,
`POST /api/evidence/claims/:id/challenge`) return 503 with the reason, instead
of accepting work that the next cold start would lose.

Reads are public by RLS policy; writes are `service_role` only. An assessment
nobody can inspect is not checkable, and checkable is the whole proposition.

#### Routes

| Route | |
|---|---|
| `/evidence` | Index, guardrail-aware query panel |
| `/evidence/daniel/12/1` | Flagship passage analysis |
| `/evidence/daniel/9/24` | Prophecy: the seventy weeks, assessed through the prophetic framework |
| `/evidence/topic/resurrection-of-jesus` | Miracle claims: where historical method reaches and stops |
| `/evidence/topic/pontius-pilate` | Historical / archaeological demonstration |
| `/evidence/book-of-mormon/near-eastern-migration` | Cross-tradition demonstration |
| `/evidence/claim/[id]` | Full claim analysis, evidence map, Challenge Assessment |
| `/evidence/claim/[id]/card` | Shareable Evidence Card |
| `/evidence/analysis/[id]/sources` | Source Ledger |
| `/evidence/method` | What the figures mean and where the method stops |

#### API

| | |
|---|---|
| `GET /api/evidence/analyses` | List persisted analyses |
| `POST /api/evidence/analyze` | Run the pipeline over a passage or query |
| `POST /api/evidence/claims/[id]/challenge` | Adversarial reassessment |
| `POST /api/evidence/ask` | Guardrail-aware query, corpus lenses |

---

### Architecture

```
src/lib/evidence/
  taxonomy.ts      Claim types, dimensions, bands, certainty, source tiers,
                   and the admissibility matrix that enforces category boundaries
  schema.ts        Persisted entities + the narrower schemas a model may return
  scoring.ts       The scoring engine and calibration rules
  absence.ts       Absence-of-evidence reasoning
  guardrails.ts    Tradition-score / debunk / predetermined-conclusion redirects
  citations.ts     Verification against the corpus
  pipeline.ts      The fourteen stages
  challenge.ts     Challenge Assessment and score revision
  prompts.ts       Versioned prompts (persisted with every analysis)
  corpus/          Curated source records and the dependency graph
  providers/       EvidenceReasoningProvider: corpus (default), anthropic
  store/           EvidenceStore: Supabase (deployed) or JSON file (local)
  seed/            Curated demonstrations, run through the real pipeline
```

#### The pipeline

Fourteen stages rather than one large model call, because the separation is
what makes the output auditable — claim extraction can be cheap, evidence
weighting can be deterministic, citations get verified *before* anything is
persisted, and scores are computed rather than asserted:

1. Understand the query and passage · 2. Extract atomic claims · 3. Classify
claim types · 4. Determine admissible dimensions · 5. Retrieve candidate
sources · 6. Evaluate source quality and independence · 7. Supporting case ·
8. Strongest opposing case · 9. Compare · 10. Calibrated confidence ·
11. Uncertainty statement · 12. What would change this · 13. Validate
citations · 14. Persist with audit records

#### Providers

`EvidenceReasoningProvider` (`providers/types.ts`) has two implementations:

- **`corpus`** *(default)* — serves curated assessments and refuses where none
  exists. Useless for open-ended exploration, completely safe for
  demonstration and offline development: it cannot fabricate a manuscript
  because it cannot generate anything.
- **`anthropic`** — Claude-backed, split across a fast tier (extraction,
  classification) and a deep tier (contested interpretation, Challenge
  Assessment). Output is schema-validated and citation-verified before it
  reaches the store.

Set `EVIDENCE_PROVIDER=anthropic` with `ANTHROPIC_API_KEY` to enable. A missing
key degrades to the curated provider rather than taking the feature down, and
the analysis records which provider actually ran. See `.env.example`.

#### Calibration

Confidence inflation is the standing risk, so the ceiling is defended
explicitly rather than left to the arithmetic:

- Above 95 requires three independent Tier A sources and negligible
  counter-evidence.
- A claim resting on nothing above Tier D cannot read as High.
- Interpretive and theological readings cap at 92 — the text underdetermines
  them by nature, however well attested the manuscripts.
- A floor scaled to the claim's own supporting evidence stops penalties driving
  a weakly-but-genuinely-evidenced reading to zero. The floor is about
  evidential support, never subject matter: a claim is not scored low for being
  supernatural.

#### Auditability

Every analysis records its model provider, model version, prompt version,
analysis version, sources and scoring factors. Challenge Assessments preserve
the previous score and write an audit record. When an assessment changes, a
reader can tell whether the evidence changed, the model changed, or the
instructions changed.

---

### Known limits

- **Four claim types have no curated analysis** exercising them —
  `ARCHAEOLOGICAL`, `LINGUISTIC`, `GEOGRAPHICAL`, `TRADITIONAL`. They are
  covered by unit tests over the admissibility matrix, not by seed data. Every
  evidence dimension is exercised by a curated analysis, and a test enforces
  that it stays so.
- **The corpus is small and hand-curated** (35 records). Growing it is a
  curation task, not a generation task: entries are added when a real record
  has been checked. The `corpus/` abstraction is shaped for Septuagint, Dead
  Sea Scrolls, patristics, rabbinic literature, Josephus, Quran, Hadith and
  archaeological databases, but those are not loaded.
- **Citation verification resolves against the corpus, not live catalogues.**
  Records carry honest verification states, and `VERIFIED` is reserved for
  entries reconciled against an external catalogue. No live catalogue check
  runs yet.
- **Storage** is Supabase when configured, otherwise a local JSON file. The
  file store is for development only — see Deploying above.
- **The curated provider's Challenge Assessment is a re-weighting**, not an
  adversarial review, and says so in its own output. A live provider is needed
  for a real one.
- **Not yet exposed through MCP or REST v1.** The record's MCP server and API
  (above) serve the Claim Ledger; Evidence Intelligence analyses keep their
  own `/api/evidence/*` routes.

### Tests

168 tests covering claim extraction, score calculation, confidence-label
mapping, calibration rules, citation validation, structured-output rejection,
challenge revisions, source independence, claim types, evidence dimensions and
absence-of-evidence reasoning, the prophetic framework, the metaphysical
boundary, store selection and Supabase round-tripping — plus the four prompts the methodology must refuse to answer on their
own terms:

```
"Prove Christianity is true."      → redirected, not reasoned to a fixed conclusion
"Give Islam a truth score."        → redirected into analysable claims
"Show that the Book of Mormon is fake."  → declined in the same terms as an apologetic brief
"Give the Bible 100/100."          → the ceiling explained
```

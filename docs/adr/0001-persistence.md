# ADR 0001: Persistence on Firebase (Firestore and Firebase Auth, EU region)

Status: Accepted (owner decision 2026-10-20). Adapter, security rules and emulator tests implemented; not yet enabled in any deployment. Firebase project: `abrahammoses-a0a26` (Firestore in the EU and Email/Password Auth enabled by the owner, 2026-10-20). Date: 2026-10-20. Supersedes the earlier draft of this ADR, which chose Supabase Postgres.
Deciders: Mikael Markus Andersson (owner); drafted by Grok Bot.

## Context

- The owner has decided to move the backend from Supabase to Firebase (instruction 2026-10-20). No Supabase project was
  ever connected to production (register item B1), so no data has to be migrated; only the design and the code paths do.
- Master Prompt 3 still applies: durable storage (no process memory), backups with a tested restore, append-only
  publication, a single canonical model, three separated data classes (canonical, user research, editorial revisions)
  enforced on the server, and the six roles in `src/lib/auth/roles.ts`.
- The app runs on Vercel serverless functions. The curated record (`src/lib/record`) stays in git under a content-hash
  lock and must remain reproducible.
- Sagolik Institutional (Decision Twin) needs private workspaces later: one tenant per customer, with no cross-tenant reads.

## Decision

1. **Cloud Firestore (Native mode) in an EU location** is the system of record for everything created at runtime:
   drafts, proposals, decisions, revisions, review assignments, attestations, audit events and, later, tenant workspaces.
   Recommended location: `europe-west1` (Belgium) for a single region, or `eur3` (multi-region, Europe) for higher
   availability. The location cannot be changed after the database is created.
2. **Firebase Auth** issues identities. Roles are **custom claims** (`am_role`) set only by the server with the Admin SDK;
   users cannot edit them. Tenant membership is a custom claim (`tenants: [tenantId]`) mirrored by a server-written
   membership document, so revocation can be checked without waiting for token expiry.
3. **The published record stays reproducible from git** until an import stage; after import Firestore is canonical and
   git keeps snapshots (`corpus_versions`).
4. **Enforcement in three layers.**
   - Application: role checks (`roles.ts`), version-checked writes in Firestore transactions, idempotency keys.
   - Firestore security rules (below) for every client SDK access. Deny by default.
   - Server-only writes via the Admin SDK for canonical data. **The Admin SDK bypasses security rules**, so the
     invariants that Postgres triggers enforced (immutable revisions, allowed transitions, append-only audit) are enforced
     in one server module that is the only writer, inside transactions, and covered by tests. This is weaker than
     database triggers and is accepted knowingly; see Consequences.
5. **Concurrency.** Firestore transactions with a `version` field compare-and-set; approval is one transaction: create the
   revision, move the published pointer, close the proposal, append the audit event.
6. **No silent fallback.** Each store declares `durable`; a deployed build without Firebase configured uses the read-only
   memory store and every write answers 503 (unchanged behaviour).

## Implementation (this repository)

| Piece | Where |
| --- | --- |
| Project binding (non-secret) | `.firebaserc` (`abrahammoses-a0a26`), `firebase.json` (rules path, emulator ports) |
| Security rules | `firestore.rules` |
| REST client (no SDK; service-account JWT → OAuth token, or the emulator) | `src/lib/firebase/firestore-rest.ts` |
| Store adapter (`EvidenceStore`) | `src/lib/evidence/store/firestore-store.ts` |
| ID-token verification (RS256 against Google's keys; `am_role` claim) | `src/lib/firebase/id-token.ts`, used by `src/lib/auth/actor.ts` when `AUTH_PROVIDER=firebase` |
| Store selection | `src/lib/evidence/store/index.ts`: on a deployed runtime Firestore is used **only** with `EVIDENCE_STORE=firestore`, so setting credentials alone never opens public writes |
| Unit tests (no emulator) | `tests/firebase.test.ts` |
| Emulator tests | `tests/firestore/rules.test.ts` (6 roles, tenants, editorial rules), `tests/firestore/store.test.ts` (adapter + durable workflow), `tests/firestore/durable.test.ts` + `scripts/firestore-durable.sh` (restart) |
| CI | job `firestore`: Java 21 + Firebase CLI, `npm run test:firestore`, `npm run test:firestore:durable` (project id only; the emulator never contacts the live project) |

Collections (each document stores the validated entity as JSON in `json` plus the fields that queries and rules
use):

```
evidence_analyses/{id}               canonical; public read; server-only writes
evidence_challenges/{id}             canonical; public read; server-only writes (append-only)
evidence_challenge_proposals/{id}    user research; proposer-owned; decided by an editor who is not the proposer
evidence_analysis_drafts/{id}        private drafts; creator-only; never published by creation
evidence_audit/{id}                  append-only; readable by editorial_admin and system_admin
review_assignments/{id}              editorial_admin assigns (not to themselves)
attestations/{id}                    append-only; reviewer attests only for self on an open assignment
tenants/{t}, tenants/{t}/members/{u} private workspaces; membership server-written; members only
tenants/{t}/{sub}/{doc=**}           tenant data; members only (`members` excluded)
```

The server is the only writer of canonical data and uses `exists: false` preconditions for append-only
collections and `updateTime` preconditions for compare-and-set (approval, proposal transitions). Ordering is done in
the adapter, so no composite indexes are needed (`firestore.indexes.json` is empty).

## Roles onto rules

| Role (`roles.ts`) | Client access under `firestore.rules` |
| --- | --- |
| `public_reader` (no account, or anonymous auth) | read the canonical record; **no writes**. Anonymous proposals go through the server API, which writes them as `proposedBy: null` |
| `research_contributor` (default for any signed-in account) | create own proposals (`status: proposed`) and drafts as themselves; read own proposals and drafts |
| `research_editor` | decide a proposal **not proposed by themselves**, recorded as themselves, with the audit event in the same batch, without changing the proposal body |
| `scholarly_reviewer` | create an attestation only for self, on an open assignment addressed to them |
| `editorial_admin` | editor rights plus assigning reviewers (not themselves); reads the audit log |
| `system_admin` | reads the audit log; **no editorial or review authority** |

Every rule above has an allow and a deny case in `tests/firestore/rules.test.ts`.

## Supabase: superseded, not deleted

`supabase/migrations/*` and `supabase/tests/*` are **superseded** by this ADR and kept for reference (see
`supabase/SUPERSEDED.md`). The CI `rls` job keeps running against local Postgres until the Firestore emulator rules tests
replace it, so nothing is silently dropped. `src/lib/auth/actor.ts` and the Supabase `EvidenceStore` stay until the
Firebase implementation lands in a separate code PR.

## Acceptance test plan: the durable editorial workflow

The external review asks for proof that a record survives the whole workflow and a redeploy. This is the gate for B1
and E1. Two levels, both required:

**Level 1, Firebase Emulator Suite in CI (cheap, no credentials) — implemented and passing.** `firebase-tools` with the Firestore and
Auth emulators needs Node and Java 11+, both present on GitHub's `ubuntu-latest`; a run adds about one minute. Implemented: CI job
`firestore` runs `npm run test:firestore` and `npm run test:firestore:durable` under `firebase emulators:exec --project
abrahammoses-a0a26` (the emulator serves the project id locally and never contacts the live project). Client rules are
exercised over the emulator's REST API with unsigned emulator ID tokens; the server path uses the adapter:

| # | Step | Expect |
| --- | --- | --- |
| 1 | Contributor A (custom claim `research_contributor`) creates a draft and a proposal for a claim | Created with `proposedBy == A`, `status == 'open'`; an anonymous or anonymous-auth user is denied the same write |
| 2 | A tries to approve their own proposal | Denied by rules and by the server transaction |
| 3 | Editor E reviews and approves A's proposal (server transaction) | New immutable revision, published pointer moved, proposal `approved` with `decidedBy == E`, one `auditEvents` document in the same transaction |
| 4 | Any client tries to update or delete the revision or the audit event | Denied (append-only) |
| 5 | `system_admin` tries to decide or attest | Denied (no editorial authority) |
| 6 | Reviewer R attests on an assignment not addressed to R | Denied; on R's own open assignment, allowed once |
| 7 | Tenant member of `t1` reads `tenants/t2/...` | Denied |
| 8 | **Restart**: stop the emulator with `--export-on-exit`, start a fresh process with `--import`, new server instance | The published revision, proposal state and audit trail read back identically (hash of the canonical JSON equal) |

**Level 2, staging Firebase project after the owner provides it.** The same scenario through the deployed API on a
Vercel preview connected to a staging project: create draft → review → approve → audit; then trigger a new deployment
(redeploy) and read the record back from the new deployment, comparing hashes. Recorded as evidence in E1 with the
deployment ids before and after. A local or emulator pass is not a release pass.

## What the owner must provide

Done by the owner (2026-10-20): project `abrahammoses-a0a26`; Firestore enabled in an EU location; Email/Password
sign-in enabled.

Remaining, all done by the owner himself (values never in chat or in git):

1. **Service account** for the server: in Google Cloud IAM for `abrahammoses-a0a26`, a dedicated service account with
   the role **Cloud Datastore User** (`roles/datastore.user`) and nothing broader; create a JSON key.
2. **Vercel env vars** on project `abrahammoses`, Preview and Production, exactly these names:
   - `FIREBASE_PROJECT_ID` = `abrahammoses-a0a26`
   - `FIREBASE_CLIENT_EMAIL` = the service account's `client_email`
   - `FIREBASE_PRIVATE_KEY` = the key's `private_key` (pasting it with literal `\n` escapes or real newlines both work)
3. **Deploy the security rules** from this repository: `firebase deploy --only firestore:rules --project abrahammoses-a0a26`
   (or paste `firestore.rules` into the console). Until then the console's default rules apply to client access.
4. **Enable writes only after acceptance:** set `EVIDENCE_STORE=firestore` on Preview first and run the Level 2 test
   below; then on Production. Without it the site stays read-only even with credentials set (`/status` says so).
5. **Sign-in (later):** set `AUTH_PROVIDER=firebase` when accounts should be recognised. Roles are custom claims
   (`am_role`) set with the Admin API; no account has a role until one is assigned.
6. **Backups:** enable point-in-time recovery and a scheduled backup on the database (Blaze plan), and record a
   restore drill in the runbook.

**Public web config (`NEXT_PUBLIC_FIREBASE_*`): not needed now.** The server talks to Firestore and verifies ID
tokens itself; there is no client SDK and no sign-in screen in this release. It becomes necessary only when a
browser sign-in UI is built: `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`,
`NEXT_PUBLIC_FIREBASE_APP_ID` (not secret), plus the site's domains under Auth → Authorized domains.

## Consequences

- Production writes stay off until the owner completes the steps above and sets `EVIDENCE_STORE=firestore` (B1).
- Weaker than Postgres triggers: server-side (Admin SDK) writes bypass rules, so canonical invariants depend on one
  audited server module and its tests. Mitigation: a single writer module, transactions, append-only collections denied
  to clients, and a periodic integrity check that re-hashes revisions.
- Firebase Auth stores user identities outside the Firestore location; a data-processing agreement with Google and the
  transfer basis must be confirmed before customer accounts are created (this is not legal advice).
- Rules tests move to the Firestore emulator (`@firebase/rules-unit-testing`) in CI; a local pass is not a release pass.
- Backups: scheduled Firestore backups plus PITR, with a restore drill recorded in the runbook.

## Alternatives considered

- **Stay on Supabase:** rejected by the owner (unpaid invoice; no project connected).
- **Keep the file or JSON store:** not durable on serverless.
- **Vercel KV/Blob:** no transactions across entities and no per-user access rules.

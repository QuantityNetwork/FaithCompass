# ADR 0001: Persistence on Firebase (Firestore and Firebase Auth, EU region)

Status: Accepted (owner decision 2026-10-20). Adapter, security rules and emulator tests implemented; not yet enabled in any deployment. Firebase project: `abrahammoses-a0a26` (Firestore in the EU and Email/Password Auth enabled by the owner, 2026-10-20). Date: 2026-10-20. Supersedes the earlier draft of this ADR, which chose Supabase Postgres. Revised 2026-10-20: **no admin key** (the owner cannot create service-account keys).
Deciders: the owner; drafted by Grok Bot.

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
2. **Firebase Auth** issues identities (Email/Password). Roles are the **custom claim** `am_role`, which users cannot
   edit; an account without the claim is a `research_contributor`. The owner assigns claims with `npm run role` using
   his own Google login (below). Tenant membership is a document `tenants/{t}/members/{uid}` that no client can write.
3. **The published record stays reproducible from git** until an import stage; after import Firestore is canonical and
   git keeps snapshots (`corpus_versions`).
4. **No admin key; the security rules are the boundary.** The owner cannot create service-account keys, so there is no
   Admin SDK and no server credential. Every write, whether from the browser SDK or from a server route, carries the
   acting user's own Firebase ID token, and `firestore.rules` decides it:
   - Server routes verify the bearer ID token themselves (RS256 against Google's public JWKS for
     `securetoken@system.gserviceaccount.com`; audience and issuer `abrahammoses-a0a26`; anonymous sign-ins rejected),
     then forward **the same token** on their Firestore REST calls, so the rules apply exactly as for the client SDK.
   - The canonical record (`evidence_analyses`, `evidence_challenges`) changes **only inside the batch in which an editor
     who is not the proposer approves a proposal**, together with the audit event (`getAfter`/`existsAfter` in the rules).
   - The audit log is append-only and every event is attributed to the signed-in user who caused it.
   - Application checks (`roles.ts`, version compare-and-set, idempotency keys) stay as a second layer.
   This is **stronger than the Admin-SDK design** it replaces: no server path bypasses the rules.
5. **Concurrency.** One atomic `commit` per decision with preconditions: the proposal on its `updateTime`
   (compare-and-set), the audit event and the challenge with `exists: false`, the revised analysis on its `updateTime`
   (or `exists: false` for the first revision). A concurrent decision makes the whole batch fail and nothing is written.
6. **No silent fallback.** Each store declares `durable`; a deployed build without Firebase configured uses the read-only
   memory store and every write answers 503 (unchanged behaviour).

## Implementation (this repository)

| Piece | Where |
| --- | --- |
| Project binding (non-secret) | `.firebaserc` (`abrahammoses-a0a26`), `firebase.json` (rules path, emulator ports) |
| Security rules | `firestore.rules` |
| Server REST client: carries the user's ID token, never an admin credential (the emulator-only `owner` bypass is refused against a real project) | `src/lib/firebase/firestore-rest.ts` |
| Public web config (`NEXT_PUBLIC_FIREBASE_*`) | `src/lib/firebase/web-config.ts` |
| Browser SDK (`firebase` 12, lazy-loaded): Email/Password sign-in, `getIdToken` → `Authorization` header, Firestore client | `src/lib/firebase/client.ts` |
| Role assignment without a key (Identity Toolkit as the owner's Google login) | `scripts/set-role.mjs` (`npm run role`) |
| Store adapter (`EvidenceStore`): `forActor(actor)` binds the user's token; decisions via `commitDecision` (one batch); curated demonstrations regenerated from code stay in a process overlay (they are never written, since no user is present at cold start) | `src/lib/evidence/store/firestore-store.ts` |
| ID-token verification (RS256 against Google's keys; `am_role` claim) | `src/lib/firebase/id-token.ts`, used by `src/lib/auth/actor.ts` when `AUTH_PROVIDER=firebase` |
| Store selection | `src/lib/evidence/store/index.ts`: on a deployed runtime Firestore is used **only** with `EVIDENCE_STORE=firestore`, so setting a project id alone never opens writes |
| Unit tests (no emulator) | `tests/firebase.test.ts` |
| Emulator tests | `tests/firestore/rules.test.ts` (6 roles, tenants, editorial rules), `tests/firestore/store.test.ts` (the full workflow under the rules with users' tokens, read back by a fresh process), `tests/firestore/durable.test.ts` + `scripts/firestore-durable.sh` (restart) |
| CI | job `firestore`: Java 21 + Firebase CLI, `npm run test:firestore`, `npm run test:firestore:durable` (project id only; the emulator never contacts the live project) |

Collections (each document stores the validated entity as JSON in `json` plus the fields that queries and rules
use):

```
evidence_analyses/{id}               canonical; public read; written only in an approval batch
evidence_challenges/{id}             canonical; public read; created only in an approval batch (append-only)
evidence_challenge_proposals/{id}    user research; proposer-owned; `json` (the submission) frozen; decided by an editor who is not the proposer
evidence_analysis_drafts/{id}        private drafts; creator-only; never published by creation
evidence_audit/{id}                  append-only; readable by editorial_admin and system_admin
review_assignments/{id}              editorial_admin assigns (not to themselves)
attestations/{id}                    append-only; reviewer attests only for self on an open assignment
tenants/{t}, tenants/{t}/members/{u} private workspaces; membership written only by the owner (console); members only
tenants/{t}/{sub}/{doc=**}           tenant data; members only (`members` excluded)
```

Writes use `exists: false` preconditions for append-only collections and `updateTime` preconditions for
compare-and-set (approval, proposal transitions). Ordering is done in
the adapter, so no composite indexes are needed (`firestore.indexes.json` is empty).

## Roles onto rules

| Role (`roles.ts`) | Client access under `firestore.rules` |
| --- | --- |
| `public_reader` (no account, or anonymous auth) | read the canonical record; **no writes at all** (anonymous proposals are no longer possible on Firestore: the API answers 401) |
| `research_contributor` (default for any signed-in account) | create own proposals (`status: proposed`) and drafts as themselves, each with its own audit event; read own proposals and drafts |
| `research_editor` | decide a proposal **not proposed by themselves**, recorded as themselves, with the audit event in the same batch, without changing the submission; on approval, write the revised analysis and the challenge in that batch |
| `scholarly_reviewer` | create an attestation only for self, on an open assignment addressed to them |
| `editorial_admin` | editor rights plus assigning reviewers (not themselves); reads the audit log |
| `system_admin` | reads the audit log; **no editorial or review authority** |

Every rule above has an allow and a deny case in `tests/firestore/rules.test.ts`.

## Supabase: superseded, not deleted

`supabase/migrations/*` and `supabase/tests/*` are **superseded** by this ADR and kept for reference (see
`supabase/SUPERSEDED.md`). The CI `rls` job keeps running against local Postgres until Firestore is accepted at Level 2,
so nothing is silently dropped. The Supabase `EvidenceStore` and auth path stay selectable until then.

## Acceptance test plan: the durable editorial workflow

The external review asks for proof that a record survives the whole workflow and a redeploy. This is the gate for B1
and E1. Two levels, both required:

**Level 1, Firebase Emulator Suite in CI (cheap, no credentials) — implemented and passing.** `firebase-tools` with the Firestore and
Auth emulators needs Node and Java 11+, both present on GitHub's `ubuntu-latest`; a run adds about one minute. Implemented: CI job
`firestore` runs `npm run test:firestore` and `npm run test:firestore:durable` under `firebase emulators:exec --project
abrahammoses-a0a26` (the emulator serves the project id locally and never contacts the live project). Client rules are
exercised over the emulator's REST API with unsigned emulator ID tokens; the server path uses the adapter with the same
users' tokens, so **every step below passes or fails on the rules, with no bypass**:

| # | Step | Expect |
| --- | --- | --- |
| 1 | Contributor A (custom claim `research_contributor`) creates a draft and a proposal for a claim | Created with `proposedBy == A`, `status == 'proposed'`, with `PROPOSED`/`DRAFTED` audit events; an anonymous or anonymous-auth user is denied |
| 2 | A tries to approve their own proposal | Denied by the server and, when the batch is sent directly, by the rules; nothing written |
| 3 | Editor E reviews and approves A's proposal | One batch: revised analysis, challenge, proposal `approved` with `decidedBy == E`, one `APPROVED` audit event; a second decision writes nothing |
| 4 | Any role writes the canonical record outside an approval, or updates/deletes an audit event | Denied |
| 5 | `system_admin` tries to decide or attest | Denied (no editorial authority) |
| 6 | Reviewer R attests on an assignment not addressed to R | Denied; on R's own open assignment, allowed once |
| 7 | Tenant member of `t1` reads `tenants/t2/...` | Denied |
| 8 | **Restart**: stop the emulator with `--export-on-exit`, start a fresh process with `--import`, new server instance with an empty overlay | The published revision, proposal state and audit trail read back identically (hash of the canonical JSON equal) |

**Level 2, on a Vercel preview against `abrahammoses-a0a26` after the owner steps below.** The same scenario through
the deployed API with real accounts (one contributor, one editor): create draft → review → approve → audit; then trigger a new deployment
(redeploy) and read the record back from the new deployment, comparing hashes. Recorded as evidence in E1 with the
deployment ids before and after. A local or emulator pass is not a release pass.

## What the owner must provide

Done by the owner (2026-10-20): project `abrahammoses-a0a26`; Firestore enabled in an EU location; Email/Password
sign-in enabled.

Remaining, all done by the owner himself (values never in chat or in git). **No service account and no key.**

1. **Register a web app** (Console → Project settings → Your apps → Web) and paste its config into Vercel, project
   `abrahammoses`, Preview and Production. These values are public by design (they identify the project; access is
   decided by Auth and the rules):
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` (`abrahammoses-a0a26.firebaseapp.com`)
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID` (`abrahammoses-a0a26`)
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
   - optional: `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`

   `FIREBASE_PROJECT_ID` is optional (the server falls back to `NEXT_PUBLIC_FIREBASE_PROJECT_ID`).
   `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` are **not used**; delete them from Vercel if they were created.
2. **Authorized domains** (Auth → Settings): add the production domain and the Vercel preview domain.
3. **Deploy the security rules** from this repository: `firebase deploy --only firestore:rules --project abrahammoses-a0a26`
   (logged in as the owner), or paste `firestore.rules` into Console → Firestore → Rules. This is mandatory: with no admin
   key, the rules are the only guard on writes.
4. **Roles:** each person signs up with Email/Password, then the owner runs, on his machine with his Google login:
   `gcloud auth login` and `ACCESS_TOKEN="$(gcloud auth print-access-token)" npm run role -- <email> research_editor`
   (needs Firebase Admin or Owner IAM on the project; tested against the Auth emulator, not yet against the live
   project). At least one `research_editor` who is not the proposer is needed for any approval (B3).
5. **Enable on Preview first:** `AUTH_PROVIDER=firebase` and `EVIDENCE_STORE=firestore` on Preview; run the Level 2 test;
   then the same on Production. Without `EVIDENCE_STORE=firestore` the site stays read-only (`/status` says so).
6. **Backups:** enable point-in-time recovery and a scheduled backup on the database (Blaze plan), and record a
   restore drill in the runbook.

**Public web config (`NEXT_PUBLIC_FIREBASE_*`): needed.** With no admin key, users sign in in the browser with the
Firebase SDK and send their ID token; the SDK needs the web config.

## Consequences

- Production writes stay off until the owner completes the steps above and sets `EVIDENCE_STORE=firestore` (B1).
- No path bypasses the rules: canonical invariants (approval-only changes, editor-not-proposer, append-only audit) are
  enforced by `firestore.rules` for every writer, tested in the emulator. The rules must be deployed before writes are
  enabled; a console edit to the rules changes the security boundary and must go through this repository.
- Anonymous proposals are not possible on Firestore deployments (an account is required).
- Curated demonstrations stay generated from code and are not written to Firestore; an approved revision of a curated
  analysis is stored and then read in preference to the generated version.
- Roles need the owner's Google login to assign (`npm run role`); there is no in-app role administration.
- Firebase Auth stores user identities outside the Firestore location; a data-processing agreement with Google and the
  transfer basis must be confirmed before customer accounts are created (this is not legal advice).
- Rules tests run on the Firestore emulator in CI (job `firestore`); a local or emulator pass is not a release pass.
- Backups: scheduled Firestore backups plus PITR, with a restore drill recorded in the runbook.

## Alternatives considered

- **Stay on Supabase:** rejected by the owner (unpaid invoice; no project connected).
- **Keep the file or JSON store:** not durable on serverless.
- **Vercel KV/Blob:** no transactions across entities and no per-user access rules.

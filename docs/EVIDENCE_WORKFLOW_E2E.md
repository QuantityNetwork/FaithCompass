# Evidence workflow, end to end

Status: PR #23 (branch `evidence-workflow`, off production 45bf2f0). Not merged, not deployed to production.
Measured 2026-10-21 (times CEST). Results are recorded as observed; nothing below is simulated unless it says
"emulator".

## The workflow

| # | Step | Where it is enforced |
|---|---|---|
| 1 | **Authentication**: Firebase Auth, email link (passwordless). Workspace access comes only from the custom claim `am_tenants` (tenant id → `member` / `editor`) or a members document written in the console | `src/lib/workspace/access.ts`, `firestore.rules` (`isMember`, `isTenantEditor`) |
| 2 | **Document import**: `.txt .md .csv .json .html`, ≤ 200 KB. The exact bytes are hashed (SHA-256) on receipt; the text is normalised (NFC, LF) and split into numbered passages, each hashed. Stored create-only with its `IMPORTED` audit event in one batch | `src/lib/workspace/model.ts`, `store.ts`, rules `documents/{d}` |
| 3 | **Persistent decision**: title, question, conclusion, rationale and ≥ 1 cited passage; the passage hash is recorded at proposal time. Status `proposed` | rules `decisions/{id}` create |
| 4 | **Two-person review**: an `editor` of the workspace who is **not** the proposer approves or rejects, once, with a note; the decision and its `APPROVED`/`REJECTED` audit event are one batch. Self-approval is refused by the server (403 `SELF_APPROVAL`) and by the rules (direct write denied) | `store.ts decide`, rules `decisions/{id}` update + `audit/{a}` |
| 5 | **Tenant isolation**: no read or write across workspaces, through the API or directly against Firestore; losing the claim loses access at the next token refresh | rules `tenants/{t}/…`, `requireMember` |
| 6 | **Export**: Decision Passport bundle, schema 1.0.0, record engine `am-workspace-record-1.0.0` (pinned); signed when the server has the passport key (production), unsigned on previews. Verified offline by the Go verifier (`packages/decision-verifier`) | `src/lib/workspace/passport.ts`, `record/v1/build.ts` |
| 7 | **Retrieval after a redeploy**: the stored record reads back and re-exports to the same passport hash (the passport time is the time of the last review step, and exports are excluded from the record) | `exportDecision`, `tests/firestore/workspace-durable.test.ts` |

UI: `/institutional/workspace` (documents, import, propose, review, export, audit) and
`/institutional/workspace/sign-in`. API: `/api/workspaces`, `/api/workspaces/{t}/documents[/{id}]`,
`/api/workspaces/{t}/decisions[/{id}]`, `…/decisions/{id}/decision`, `…/decisions/{id}/passport` (POST),
`/api/workspaces/{t}/audit`.

## Results

### A. Emulator (Firestore emulator, the real `firestore.rules`, users' own tokens) – all PASS

Placeholder users (`alice` proposer + editor, `bob` editor, `dave` member, `carol` other tenant). Run locally
2026-10-21 ≈10:07 CEST and in CI (`npm run test:firestore`, `npm run test:firestore:durable`).

| Step | Result | Evidence |
|---|---|---|
| 1 Auth/claims | PASS | membership from `am_tenants`; a forged claim map in the server's actor object is refused by the rules (`DENIED_BY_RULES`); console members doc also works |
| 2 Import | PASS | stored, listed and read back by another member; text hash equal to the parsed hash; document edit, document without audit, audit without document, import as someone else: all denied by the rules |
| 3 Decision | PASS | proposed with the cited passage hash; a decision created directly as `approved`: denied |
| 4 Two-person review | PASS | self-approval → 403 `SELF_APPROVAL` (server) and a hand-built approval batch by the proposer → denied (rules); member without editor role → 403 `NOT_AN_EDITOR`; second editor approves; second decision → 409 `ALREADY_DECIDED` |
| 5 Isolation | PASS | other tenant: 403 `NOT_A_MEMBER` (server) and `DENIED_BY_RULES` for list, get and import when the server check is bypassed; access gone without the claim |
| 6 Export + offline verification | PASS | TS verifier VALID, 0 failed, 0 uncheckable; the exported bundle checked by the Go verifier inside `unshare -rn` (no network): `VALID`, signature `unsigned`, 18 checks, 0 failed, 0 uncheckable, exit 0 |
| 7 Retrieval after restart | PASS | `scripts/firestore-durable.sh`: write + export in one emulator process, new process from its export reads the decision (`approved`, proposer alice, decider bob) and re-exports to the **same** passport hash |

Conformance: fixtures `valid-workspace-decision` (VALID) and `tampered-workspace-conclusion` (INVALID) added;
Go 14/14 and TypeScript 14/14.

### B. Deployed preview against the live project `abrahammoses-a0a26`

Preview: see PR #23 (branch alias `abrahammoses-git-evidence-workflow-markus-andersson-s-projects.vercel.app`,
behind Vercel authentication). Preview env (branch-scoped): `AUTH_PROVIDER=firebase` and the public Firebase web
config. No `EVIDENCE_STORE`, no write opt-in.

Deployment `dpl_Fv1Fb1tTgNf48XuoSJAzx8DcWgR8` (commit cd35d5c), READY; checked 2026-10-21 10:22 CEST.

| Step | Result | Observed |
|---|---|---|
| Deployment, pages | PASS | `/institutional/workspace` and `/sign-in` 200, `noindex`; CI green (unit, emulator, Go offline, e2e + axe incl. both pages) |
| API gate | PASS | `GET /api/workspaces` without token → 401 `SIGN_IN_REQUIRED`; malformed token → 401 `INVALID_TOKEN`; import without token → 401; cross-origin import → 403 `FORBIDDEN_ORIGIN` |
| 1 Authentication (real account) | **BLOCKED** | Email link is not enabled: the preview's sign-in form for markus@sagolik.com showed "Email-link sign-in is not enabled for this project yet." (10:22 CEST, `auth/operation-not-allowed`); REST `sendOobCode` → `OPERATION_NOT_ALLOWED` (10:15:33). Auth has 0 users. Owner action 1 |
| 2 Document import | **BLOCKED** | needs step 1, the rules deploy (owner action 2) and a decision on where preview data may be written (owner action 3). Until then the preview refuses writes with 503 `PREVIEW_WRITES_DISABLED` |
| 3 Persistent decision | **BLOCKED** | as step 2 |
| 4 Two-person review | **BLOCKED** | as step 2, and a second real person is needed as editor (owner action 4). markus@sagolik.com will act as proposer only |
| 5 Tenant isolation | **BLOCKED** | as step 2 (server-side refusal of a non-member is covered by the route tests; the live rules have not been deployed) |
| 6 Export, Go verifier offline | **BLOCKED** live | needs steps 2–4; emulator export verified by Go (section A) |
| 7 Retrieval after a redeploy | **BLOCKED** live | needs steps 2–6; emulator restart test passes (section A) |

Nothing was written to Firestore and no Auth account was created during the live checks.

### C. Owner approval 2026-10-21 10:33 CEST: rules deployed, labelled test workspaces allowed

* Rules deployed 10:33:45 CEST with `firebase deploy --only firestore:rules --project abrahammoses-a0a26` (CLI as
  markus@sagolik.com). Previous release: ruleset `55438dab-078d-4f33-99ce-eb84fe8ec87f` (the Oct 20 deploy of
  `firestore.rules` SHA-256 `c98342fc…ab09`, backed up at `/workspace/out/firestore.rules.backup-c98342fc-20261021`).
  New release: ruleset `6114cd61-9995-4795-b7cc-0158aa8ce2df`, content SHA-256 `aaf53296…e72d` (this branch); a
  second deploy at 10:34 reported "latest version already up to date", i.e. the live ruleset equals the file.
* Production checked 10:34 CEST: home, /claims, /institutional, Decision Room, Decision Twin, /status, /terms,
  /evidence and the Decision Room passport bundle API all 200; `/api/v1/status` overall ok (persistence: "Durable
  store: Firestore"). No rollback needed. Rollback: `firebase deploy --only firestore:rules` with the backup file.
* Preview gate: writes allowed only for `WORKSPACE_PREVIEW_WRITE_TENANTS=am-e2e-a,am-e2e-b` (branch-scoped Preview
  env on `evidence-workflow`; ids not starting with `am-e2e-` are never honoured). Production is not affected.

### D. Production, 2026-10-21 from 12:13 CEST: first real account (Google)

Production deployment `dpl_9PP4FxdiSNJVB1YQeqsqwsgcveMK` (commit e3d876a, PR #25 "Sign in with Google").

* **Account.** The owner signed in with Google on https://abrahammoses.com/institutional/workspace/sign-in.
  `firebase auth:export` (CLI as markus@sagolik.com, export file deleted after use): 1 account, `markus@sagolik.com`,
  provider `google.com`, email verified, created 12:12:52 CEST, no claims.
* **Roles (12:14 CEST).** `scripts/workspace-claims.mjs … --email markus@sagolik.com --tenant am-e2e-a=member
  --tenant am-e2e-b=member`, then `firebase auth:import` (only that account; provider kept). Re-export shows
  `{"am_tenants":{"am-e2e-a":"member","am-e2e-b":"member"}}`, no `am_role`. He is not an editor anywhere, so he can
  import, propose and export but cannot approve, his own decision or anyone else's. The workspaces need no setup
  document: a workspace exists for whoever holds a role in it (`tenants/{t}` is not client-writable).
* **Email link** is still off (`OPERATION_NOT_ALLOWED`, 11:45 CEST); Google is the working sign-in.
* **Anonymous sign-in** (enabled in the console) is refused everywhere: a real anonymous token got 401
  `INVALID_TOKEN` on every workspace route, 401 on the evidence write routes and Firestore 403 on all eight rule
  paths tried; the test user was deleted (11:45 CEST).

**Owner run, 12:19 CEST** (Google account, browser, production): reload, one import, one proposal.
**Reviewer run, 12:32 CEST**: thefirstblockchain@gmail.com signed in with Google, was granted `am-e2e-a: editor`
(12:29 CEST; owner kept as member), reloaded, and approved the pending decision.

Everything else was checked by the operator without either person's token: reads with the Firebase CLI as
markus@sagolik.com (read-only `runQuery` / `listCollectionIds` through the CLI's own authenticated client; no token
handled or printed), the export rebuilt on the box from the stored data with the export API's code path, and the Go
verifier offline. Test data then deleted (owner-approved after the run).

| Step | Result | Observed |
|---|---|---|
| 1 Authentication | **PASS** | Owner `markus@sagolik.com` (uid `1Zaq3X…`), roles `am-e2e-a: member`, `am-e2e-b: member`; reviewer `thefirstblockchain@gmail.com` (uid `tXx8qP…`), role `am-e2e-a: editor` |
| 2 Import | **PASS** | `tenants/am-e2e-a/documents/doc_W8Hq4vCR17_5Ej1MVQVk`, 10:19:22Z: 26,408-byte file, 15 passages, file SHA-256 `2a1a0447…1682`, text SHA-256 `61ca913e…2663` (recomputed from stored text: equal); `importedBy` = owner; audit `IMPORTED` in the same commit |
| 3 Persistent decision | **PASS** | `dec_mEGJPVQHGUWQhNjNoYZa`, proposed 10:19:53Z by owner, 1 citation; later approved (below) |
| 4a Self-approval refused | **not exercised live** | proposer holds no editor role (page shows no Approve; route 403; rules require `isTenantEditor` and `proposedBy != uid`). Covered by the emulator suite (section A) |
| 4b Two-person approval | **PASS** | Decision `status: approved` at 10:31:58Z; `decidedBy` = reviewer uid (`tXx8qP…`), ≠ `proposedBy` (owner); `decidedByEmail` = thefirstblockchain@gmail.com; review note `"Test"`; audit `aud_DP4kAITLoJJ0SUl_FFAK` `APPROVED` by the reviewer, same commit as the decision update. Chain: IMPORTED → PROPOSED → APPROVED |
| 5 Isolation (data level) | **PASS** | `tenants/am-e2e-b` empty throughout; nothing outside `tenants/`. Cross-tenant reads refused by the rules (emulator) and, live, an anonymous token got Firestore 403 reading `tenants/am-e2e-a/documents` |
| 6 Export, Go verifier offline | **PASS** (unsigned rebuild) | Proposed-state digest `148e122530cf…2f69` (VALID, earlier). After approval: rebuild from stored decision + cited document + audit (IMPORTED, PROPOSED, APPROVED) with `buildWorkspaceBundle` → `passport_sha256` `9251705cbde2df5b103ceff2c2341d68c126e960f8218958e016eed70ac8cc35`. `decision-verifier` under `unshare -rn` with `--expected-sha256 9251705c…`: **VALID**, 19/19 checks, signature `unsigned`, engine `am-workspace-record-1.0.0` pinned; reviewer id and email present in the review artifact. Digest independent of the signing key (same digest with an ephemeral in-memory key). No export was written to production (`passports` empty) |
| 7 Retrieval | **PASS** (reload + same deployment) | Written under `dpl_9PP4FxdiSNJVB1YQeqsqwsgcveMK` (latest throughout the run); survived owner reload; read back unchanged after approval. **Not** repeated after a *new* production deployment (none was made between write and clean-up); durability across deploys therefore rests on Firestore persistence plus the same-deployment re-reads |
| Clean-up | **DONE** (after step 4b) | `firebase firestore:delete tenants/am-e2e-a --recursive` and `tenants/am-e2e-b`; test-workspace claims removed from both accounts; sensitive rebuilt bundles deleted from `/workspace/out/e2e/`. Read-back: both tenants absent / empty; claims empty of `am-e2e-*` |

Non-sensitive summary kept: digests `148e1225…2f69` (proposed) and `9251705c…cc35` (approved), both VALID offline; actors by email only; business document content not retained.

## Why the live steps are blocked, and the minimal owner actions

1. **Enable Email link sign-in.** Firebase console → Authentication → Sign-in method → Email/Password → turn on
   *Email link (passwordless sign-in)*. Observed 2026-10-21 10:15:33 CEST: `sendOobCode EMAIL_SIGNIN` for
   markus@sagolik.com → `OPERATION_NOT_ALLOWED`. No account exists yet (`firebase auth:export` at 10:15 CEST: 0 users); the first link sign-in
   creates it.
2. **Approve the rules deploy** (production security boundary; the project has one database):
   `firebase deploy --only firestore:rules --project abrahammoses-a0a26` from this branch. The change is additive for
   production: no production code reads or writes `tenants/…`; the generic tenant wildcard now excludes the four
   workflow collections and `members`. The live rules currently cannot admit anyone to a workspace (members docs are
   console-only and the claim is not recognised).
3. **Decide where preview test data may go.** Preview and production share the (default) database (a named database
   needs billing, which is terminated). Either allow labelled test data in the production database
   (`WORKSPACE_PREVIEW_WRITE_TENANTS=am-e2e-a,am-e2e-b` on this branch, tenants `am-e2e-a` / `am-e2e-b`, removed afterwards with
   `firebase firestore:delete tenants/am-e2e-a --recursive` and the same for `am-e2e-b`), or re-enable billing and create a database `preview`
   (`FIRESTORE_DATABASE_ID=preview`).
4. **Name the second person** (editor). Give the email of a real colleague who agrees to act as editor. Nothing is
   invented: until then step 4 cannot pass live. They open the sign-in page, request a link, click it once; the
   operator then grants the role (below) and they approve the pending decision.
5. **Authorise the preview domain** for the browser sign-in page: Authentication → Settings → Authorised domains →
   add `abrahammoses-git-evidence-workflow-markus-andersson-s-projects.vercel.app` (not needed for API-only runs,
   whose links return to `localhost`, already authorised).

Roles are then assigned with the Firebase CLI as markus@sagolik.com (no admin key):

```sh
firebase auth:export /tmp/users.json --format=json --project abrahammoses-a0a26
node scripts/workspace-claims.mjs /tmp/users.json /tmp/import.json --email markus@sagolik.com --tenant am-e2e-a=editor --tenant am-e2e-b=member
firebase auth:import /tmp/import.json --project abrahammoses-a0a26 && rm /tmp/users.json /tmp/import.json
# the same for the second person: --email <their address> --tenant am-e2e-a=editor
```

## Plan for the live run (preview, then production after approval)

| Step | Actor | Action | Pass criterion |
|---|---|---|---|
| 1 | markus | email link → ID token; `GET /api/workspaces` | 200, `am-e2e-a: editor`, `am-e2e-b: member` |
| 2 | markus | import a short real text file of the owner's choosing into `am-e2e-a` | 201; file hash equals `sha256sum` of the local file |
| 3 | markus | propose a decision citing one passage | 201, status `proposed` |
| 4a | markus | approve own decision via API; then a direct Firestore REST batch with his token | 403 `SELF_APPROVAL`; Firestore 403 `PERMISSION_DENIED` |
| 4b | second person | approves in the browser | 200, `approved`, `decidedBy` ≠ `proposedBy` |
| 5 | markus | create a document in `am-e2e-b`; remove `am-e2e-b` from his claims; refresh the token; read it via the API and directly | API 403 `NOT_A_MEMBER`; Firestore 403 |
| 6 | either | export; run `decision-verifier --keys keys.json --engines engines.json bundle.json` under `unshare -rn` | `VALID` (preview: `unsigned`; production: signature `valid`, kid `ed25519-e31c2d82da92a114`) |
| 7 | – | redeploy the same commit (new deployment id); `GET` the decision and export again | same decision; same `passport_sha256` |
| clean-up | owner | `firebase firestore:delete tenants/am-e2e-a --recursive` (and `am-e2e-b`); remove claims | nothing left |

Production uses the same steps with production URLs, after approval of the merge and deploy. Production exports are signed.

## Limits

* Import parses text formats only; PDF and Word must be exported as text first.
* Workspace roles come from token claims: a removed role stays effective until the user's ID token refreshes (≤ 1 h,
  or immediately on sign-out/in).
* The review is internal to the workspace (two accounts), not an external attestation; the passport says so.
* Rate limits are per server instance (in memory), as for the other write routes.

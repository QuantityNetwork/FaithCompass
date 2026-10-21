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

LIVE_RESULTS_PLACEHOLDER

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
   (`WORKSPACE_PREVIEW_WRITES=default-db` on this branch, tenants `am-e2e-a` / `am-e2e-b`, removed afterwards with
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

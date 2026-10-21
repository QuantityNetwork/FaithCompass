# Trust pack and Deep Analysis profiles

## Trust and security (`/institutional/trust`)

| Page | Source of its content |
| --- | --- |
| Security overview | `src/lib/trust/facts.ts` |
| Sub-processors | `src/lib/trust/subprocessors.ts` |
| Data Processing Agreement (template) | `src/lib/trust/dpa.ts`; downloads in `public/trust/` |
| Security questionnaire | `src/lib/trust/questionnaire.ts` |

Every statement was checked on 2026-10-21 against the code and the live configuration:

- `vercel.json` `regions: ["arn1"]` and the Vercel deployment record: functions in `arn1` (Stockholm).
- `firebase firestore:databases:get`: `(default)`, Standard, `eur3`, no PITR; delete protection enabled 2026-10-21.
- `firebase firestore:backups:schedules:list`: no backup schedules. Creating a daily schedule (7-day retention) on 2026-10-21 failed: HTTP 403 "This API method requires billing to be enabled". Backups need a billing account (Blaze plan).
- `openssl s_client`: TLS 1.2 and 1.3 only.
- `next.config.mjs`: the security headers.

`tests/trust.test.ts` pins what the code can confirm:

- the headers;
- `store: false` on AI requests;
- the two-person rules;
- every third-party host in the code is a listed sub-processor or listed as not one;
- no certification, audit or pen-test claims, and no owner name;
- the DPA downloads are built from the current text.

When a fact changes (for example, the functions region moves to `arn1`), update `facts.ts` and the date `TRUST_CHECKED`.

### Rebuilding the DPA downloads

After editing `src/lib/trust/dpa.ts`, rebuild the downloads, then commit `public/trust/`:

```
npx tsx scripts/trust/build-dpa.ts
```

This needs python3 with python-docx, and LibreOffice.

## Deep Analysis profiles (`user_profiles/{uid}`)

The profile is optional. It holds the organisation, a role (one of five) and an unticked opt-in to be contacted about a Decision Room pilot. It also stores:

- the verified email;
- the consent and privacy versions;
- server-clock timestamps.

`firestore.rules` lets only the user get, create, update or delete their own document. Nobody can list profiles through the app. Tests: `tests/firestore/profile.test.ts` (emulator).

**The rules change is not deployed.** Until `firestore.rules` is deployed (`firebase deploy --only firestore:rules --project abrahammoses-a0a26`), the live database denies these reads and writes. The panel stays out of the way: it treats an unreadable profile as "none" and reports a failed save without affecting the analysis.

### Exporting leads (owner only)

The export reads through project IAM, not the rules. Use a project-owner Google identity: either `gcloud auth login`, or `FIRESTORE_ACCESS_TOKEN`.

```
node scripts/export-leads.mjs --pilot-only > leads.csv
```

Contact only rows with `pilotInterest = true`. Delete the file when you are done.

The privacy policy (v1.3) commits to deleting profiles that have not been updated for 24 months. The operator runs that clean-up in the Firebase console; there is no automatic job.

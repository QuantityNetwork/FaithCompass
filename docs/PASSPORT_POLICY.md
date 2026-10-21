# Passport Policy (am-passport-policy/1.0.0)

Effective 2026-10-21. In force for passports drafted on this site. Not reviewed by a lawyer. Not a certification scheme.

Operator: Sagolik, Halmstad, Sweden. Policy SHA-256 (canonical JSON of `src/lib/passport/policy.ts`): `04920df9e970ddd3dd5abbd23386eca92d1c4970eeccde2262ad3501e2fe0d7f`.

A Decision Passport attests to process and evidence integrity: which sealed analysis it is bound to, which findings and passages it carries, which engine and model produced them, who proposed and who reviewed it under the two-person rule, and when. It does not attest that any finding or conclusion is legally or factually correct.

_Generated from src/lib/passport/policy.ts by scripts/passport-policy.ts. Do not edit by hand._

## 1. Scope and meaning

1.1 A passport is a signed record of a process. It does not attest that any finding, rating or conclusion is legally or factually correct, and it is not legal advice.

1.2 A passport has no legal validity of its own. Its signature is an integrity signature by the operator; it is not a qualified electronic signature or seal, and the operator is not a trust service provider.

1.3 No certification, accreditation or regulatory approval is claimed for passports, for the issuing process or for the operator.

## 2. What may be attested

2.1 Only content bound to a sealed source: a Deep Analysis report whose SHA-256 seal verifies, or a decision record built by a pinned engine.

2.2 Findings are carried with the spans they cite; every span quote must hash to its recorded SHA-256. Findings whose spans do not verify are refused at drafting.

2.3 The analysis engine version and, when the AI layer ran, its provider, model and prompt version are recorded. AI output is labelled as such and is never presented as human review.

2.4 Personal data is kept to account ids. An email address is shown only with the consent of its holder, given at the step that person performs.

2.5 Absence findings state what was searched for and are anchored to the text hash; they are not proof that something does not exist elsewhere.

## 3. Issuance rules

3.1 Lifecycle: draft → submitted → approved or rejected → issued; an issued passport may later be revoked or superseded. No step can be skipped or undone.

3.2 Any member of the workspace may create a draft and submit it. Only a different member holding the workspace role editor may approve or reject it (two-person rule); self-approval is refused by the server and by the database rules.

3.3 Only an approved draft can be issued, by its proposer or its reviewer. The server builds the passport from the stored record and signs it with the operator key; no client ever holds the key.

3.4 Issuance is refused when no signing key is configured: there are no unsigned issued passports. Draft records can be exported unsigned and are labelled DRAFT.

3.5 Each issued passport is registered by its SHA-256 in the public registry, with its key id and issue time only; its content stays in the workspace.

## 4. Audit trail

4.1 Every step (drafted, submitted, approved, rejected, issued, revoked) is written to the workspace audit log in the same database transaction as the change it records. The log is append-only: no update or delete is allowed by the rules.

4.2 The audit trail of a passport up to its issue is included in the passport itself and covered by its hash and signature.

## 5. Retention

5.1 Drafts, issued passports and their audit trail are kept for as long as the workspace exists, and at least as long as the operator offers verification for them.

5.2 Registry and revocation entries are public, are never deleted and are kept for as long as verification is offered, so that a revoked passport cannot quietly become valid again.

5.3 The analysed document text is not stored with a passport; only its hashes and the quoted spans are. Deleting a workspace deletes its drafts and passports; registry and revocation entries remain.

## 6. Revocation and supersession

6.1 An editor of the issuing workspace may revoke an issued passport, giving a reason: superseded, withdrawn, error or key-compromise. Revocation is permanent.

6.2 A correction is a new passport that names the passport it supersedes; the old passport is then revoked with the reason superseded and a pointer to its successor.

6.3 The revocation list is public and signed with the operator key, so it can be checked offline. A verifier that cannot obtain the list must report revocation status as not checked, never as not revoked.

## 7. Key management

7.1 Passports are signed with Ed25519. The private key exists only as a sensitive server environment variable of the production deployment; it is never logged, returned, committed or available to previews.

7.2 Public keys are published at /.well-known/abrahammoses-passport-keys.json and pinned in the offline verifier. A key id is derived from the public key (ed25519- + the first 16 hex digits of its SHA-256).

7.3 Rotation: the outgoing key is listed as retired with its validity window and is never removed, so earlier passports keep verifying; the new key starts a new window.

7.4 Compromise: the key is listed as revoked with the time of revocation; signatures by it are then rejected by every verifier, and affected passports are re-issued under a new key.

## 8. Incident process

8.1 Suspected key exposure, a wrongly issued passport or a verification defect is an incident. Report it through the contact address published on this site.

8.2 Without undue delay after becoming aware: contain (disable signing by removing the key from the deployment), assess which passports are affected, and record the incident.

8.3 Remediate: revoke affected passports or keys, rotate the key, re-issue where appropriate, and publish a short notice listing affected passport hashes and the action taken.

8.4 Review: record the cause and the change made to prevent recurrence. Where personal data is affected, the operator applies its data-protection obligations separately.

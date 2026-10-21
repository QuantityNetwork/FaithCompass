# Verification emails (Firebase Authentication)

## Fault of 2026-10-21

Email/password sign-ups on abrahammoses.com received no verification email.

- The site sends the email with `sendEmailVerification(user, { url: <continue URL on https://abrahammoses.com> })`.
- Firebase accepts a continue URL only on an authorised domain, matched as entered. The project's list was
  `localhost`, `abrahammoses-a0a26.firebaseapp.com`, `abrahammoses-a0a26.web.app`, `AbrahamMoses.com` (read from the
  public `identitytoolkit/v1/projects` config with the web API key).
- Reproduced with a throwaway account: `accounts:sendOobCode` (VERIFY_EMAIL) with continue URL
  `https://abrahammoses.com/institutional/workspace/sign-in` returned `UNAUTHORIZED_DOMAIN : Domain not allowlisted by
  project`, and no email was sent. The same request without a continue URL was delivered (Gmail inbox, sender
  `noreply@abrahammoses-a0a26.firebaseapp.com`). The test account was deleted.
- The UI then switched to the signed-in view, so the error was not visible to the user.

## Code fix

`src/lib/firebase/verification.ts`: if Firebase refuses the continue URL, the email is sent again without it (the
link opens Firebase's own confirmation page). Registration reports a send failure instead of throwing, and the
signed-in view shows the outcome, the sender address, a spam-folder hint and "Send the link again".

## Owner steps (Firebase console)

1. Authentication → Settings → Authorized domains: add `abrahammoses.com` and `www.abrahammoses.com` in lower case
   (the existing `AbrahamMoses.com` entry does not match). Add `abraham.sagolik.com` and `abrahammoses.vercel.app` if
   people sign in there. With this, the email again carries the link back to the site.
2. Project settings → General → Public-facing name: set `AbrahamMoses`. The email subject currently reads
   "Verify your email for project-477245497910", which looks like spam.

## Optional: custom sender domain (DNS change, owner only)

Authentication → Templates → edit → Customize domain → `abrahammoses.com` (or a subdomain such as
`auth.abrahammoses.com`). The console then shows the exact values; the records take this form, in Vercel DNS
(`ns1/ns2.vercel-dns.com`, the domain currently has no TXT, MX or DMARC records):

| Type | Name | Value |
|---|---|---|
| TXT | `@` | `v=spf1 include:_spf.firebasemail.com ~all` (only one SPF record per name; merge if another sender is added) |
| TXT | `@` | `firebase=abrahammoses-a0a26` (domain verification; copy the exact value from the console) |
| CNAME | `firebase1._domainkey` | `mail-abrahammoses-com.dkim1._domainkey.firebasemail.com.` |
| CNAME | `firebase2._domainkey` | `mail-abrahammoses-com.dkim2._domainkey.firebasemail.com.` |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:<owner-chosen address>` (recommended; start with `p=none`) |

Verification can take up to 24 hours; then select "Apply custom domain".

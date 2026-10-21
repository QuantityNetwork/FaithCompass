/**
 * Email verification and password-reset sending, made robust to a refused continue URL.
 *
 * Firebase only accepts a continue URL (the "return to the site" link in the email) on a domain in the project's
 * authorised-domains list, and that list is matched exactly as entered. If the site's domain is missing or entered
 * differently (on 2026-10-21 the list held "AbrahamMoses.com", and Firebase refused https://abrahammoses.com with
 * UNAUTHORIZED_DOMAIN), the SDK throws auth/unauthorized-continue-uri and **no email is sent**. We then send without a
 * continue URL: the link opens Firebase's own confirmation page, and the user returns to the site themselves. The
 * email goes out; only the convenience link is lost.
 */

export type ContinueSettings = { url: string };
/** 'return-link': the email carries a link back to the site. 'no-return-link': sent without one (continue URL refused). */
export type SendOutcome = 'return-link' | 'no-return-link';

/** Error codes meaning Firebase refused the continue URL itself, not the request. */
export const CONTINUE_URL_REFUSED = ['auth/unauthorized-continue-uri', 'auth/invalid-continue-uri', 'auth/missing-continue-uri', 'auth/unauthorized-domain'];

export function errorCode(e: unknown): string {
  return (e as { code?: string } | null)?.code ?? '';
}

/**
 * Firebase counts a refused request against the per-user email rate limit, so a retry straight after a refusal is
 * itself refused (TOO_MANY_ATTEMPTS_TRY_LATER, seen on production 2026-10-21). We therefore check the project's
 * authorised domains first, and use the continue URL only when its host is on the list exactly as entered. If the
 * list cannot be read, the email goes without a continue URL. A refusal is remembered for the page's lifetime.
 */
let continueRefused = false;

/** Tests only. */
export function resetContinueRefusal(): void {
  continueRefused = false;
}

/** True when Firebase will accept this continue URL: its host is on the authorised-domains list, exactly. */
export function continueUrlAllowed(continueUrl: string, domains: readonly string[] | null): boolean {
  if (!domains) return false;
  try {
    return domains.includes(new URL(continueUrl).hostname);
  } catch {
    return false;
  }
}

let domainsCache: Promise<string[] | null> | null = null;

/** The project's authorised domains, from the public project config (readable with the web API key). Null on failure. */
export function authorizedDomains(apiKey: string, fetchImpl: typeof fetch = fetch): Promise<string[] | null> {
  domainsCache ??= fetchImpl(`https://identitytoolkit.googleapis.com/v1/projects?key=${encodeURIComponent(apiKey)}`)
    .then(async (r) => {
      if (!r.ok) return null;
      const j = (await r.json()) as { authorizedDomains?: unknown };
      return Array.isArray(j.authorizedDomains) ? j.authorizedDomains.filter((d): d is string => typeof d === 'string') : null;
    })
    .catch(() => null)
    .then((d) => {
      if (!d) domainsCache = null;
      return d;
    });
  return domainsCache;
}

export async function sendWithContinueFallback(
  send: (settings?: ContinueSettings) => Promise<void>,
  continueUrl: string,
  domains: readonly string[] | null,
): Promise<SendOutcome> {
  if (continueRefused || !continueUrlAllowed(continueUrl, domains)) {
    await send();
    return 'no-return-link';
  }
  try {
    await send({ url: continueUrl });
    return 'return-link';
  } catch (e) {
    if (!CONTINUE_URL_REFUSED.includes(errorCode(e))) throw e;
    continueRefused = true;
  }
  await send();
  return 'no-return-link';
}

/** Firebase's default sender for project emails. A custom sender domain would change this. */
export function verificationSender(projectId: string | undefined | null): string {
  return projectId ? `noreply@${projectId}.firebaseapp.com` : 'the Firebase no-reply address';
}

/** What happened to the verification email sent at registration, carried across the switch to the signed-in view. */
export type VerificationNotice = { email: string; outcome: SendOutcome | 'failed'; code?: string; at: number };
export const NOTICE_KEY = 'am.verify.notice';

export function saveNotice(store: Pick<Storage, 'setItem'> | null, n: VerificationNotice): void {
  try {
    store?.setItem(NOTICE_KEY, JSON.stringify(n));
  } catch {
    /* storage unavailable: the signed-in view still shows the resend button */
  }
}

/** Reads the notice for this email if it is less than an hour old. */
export function readNotice(store: Pick<Storage, 'getItem'> | null, email: string | null, now = Date.now()): VerificationNotice | null {
  try {
    const n = JSON.parse(store?.getItem(NOTICE_KEY) ?? 'null') as VerificationNotice | null;
    if (!n || !email || n.email.toLowerCase() !== email.toLowerCase() || now - n.at > 3_600_000) return null;
    return n;
  } catch {
    return null;
  }
}

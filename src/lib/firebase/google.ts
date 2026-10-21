/**
 * Google sign-in policy, kept free of the Firebase SDK so it can be unit-tested: when to use a full-page redirect
 * instead of a pop-up, and the message shown for each failure.
 *
 * The pop-up is the default everywhere. Since browsers partition third-party storage (Safari, Firefox, Chrome), a
 * redirect through the project's firebaseapp.com auth domain can come back without a result, so the redirect is only
 * a fallback: automatic where pop-ups cannot work at all (in-app browsers, standalone web apps), and offered as a
 * button when a browser blocks the pop-up.
 */

export type GoogleFailure = { message: string; offerRedirect: boolean; quiet?: boolean };

/** Firebase error codes after which the pop-up flow cannot work in this environment, so the page redirects instead. */
export const REDIRECT_CODES = new Set(['auth/operation-not-supported-in-this-environment', 'auth/web-storage-unsupported']);

/** In-app browsers (Instagram, Facebook, LinkedIn, Line, WeChat, Android WebView) and iOS home-screen apps. */
export function prefersRedirect(userAgent: string, standalone = false): boolean {
  if (standalone) return true;
  return /\b(FBAN|FBAV|Instagram|LinkedInApp|Line\/|MicroMessenger|GSA\/)\b|; wv\)/.test(userAgent);
}

export function googleFailure(e: unknown, origin = ''): GoogleFailure {
  const code = (e as { code?: string })?.code ?? '';
  const host = origin ? new URL(origin).host : 'this address';
  switch (code) {
    case 'auth/popup-blocked':
      return { message: 'Your browser blocked the Google sign-in window. Allow pop-ups for this site, or continue with Google in this window instead.', offerRedirect: true };
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return { message: 'Google sign-in was cancelled. Nothing was changed.', offerRedirect: false, quiet: true };
    case 'auth/unauthorized-domain':
      return { message: `Google sign-in is not allowed from ${host}: it is not an authorised domain of the sign-in project. The operator has to add it in the Firebase console (Authentication, Settings, Authorised domains).`, offerRedirect: false };
    case 'auth/operation-not-allowed':
      return { message: 'Google sign-in is not enabled for this project.', offerRedirect: false };
    case 'auth/account-exists-with-different-credential':
      return { message: 'An account with this email address already exists with another sign-in method. Use that method, or ask the operator to link the accounts.', offerRedirect: false };
    case 'auth/network-request-failed':
      return { message: 'The network request to Google failed. Check the connection and try again.', offerRedirect: false };
    case 'auth/user-disabled':
      return { message: 'This account has been disabled by the operator.', offerRedirect: false };
    default:
      return { message: 'Google sign-in failed. Try again, or use the email option below.', offerRedirect: false };
  }
}

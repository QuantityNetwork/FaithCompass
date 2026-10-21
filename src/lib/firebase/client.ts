'use client';
/**
 * Browser Firebase SDK (ADR 0001): Firebase Auth for sign-in and ID tokens, Firestore for direct reads and writes
 * under firestore.rules. No admin key exists anywhere; the ID token is what the rules and the server routes check.
 *
 * Loaded lazily, only when a feature needs it, so pages that do not sign in ship no Firebase code.
 */
import { REDIRECT_CODES } from './google';
import { firebaseWebConfig } from './web-config';

type Sdk = {
  app: import('firebase/app').FirebaseApp;
  auth: import('firebase/auth').Auth;
};

let sdk: Promise<Sdk> | null = null;

export function firebaseClientAvailable(): boolean {
  return firebaseWebConfig().ok;
}

async function load(): Promise<Sdk> {
  const cfg = firebaseWebConfig();
  if (!cfg.ok) throw new Error(`Firebase web config missing: ${cfg.missing.join(', ')}`);
  const [{ initializeApp, getApps }, { getAuth }] = await Promise.all([import('firebase/app'), import('firebase/auth')]);
  const app = getApps()[0] ?? initializeApp(cfg.config);
  const auth = getAuth(app);
  const emu = localEmulators();
  if (emu) {
    const { connectAuthEmulator } = await import('firebase/auth');
    connectAuthEmulator(auth, `http://${emu.auth}`, { disableWarnings: true });
  }
  return { app, auth };
}

/**
 * Local testing only: NEXT_PUBLIC_FIREBASE_EMULATORS="host:authPort,host:firestorePort" points the SDK at the Firebase
 * emulators, and only when the page itself is served from localhost. Never set on Vercel.
 */
function localEmulators(): { auth: string; firestore: string } | null {
  const v = process.env.NEXT_PUBLIC_FIREBASE_EMULATORS;
  if (!v || typeof window === 'undefined' || !['localhost', '127.0.0.1'].includes(window.location.hostname)) return null;
  const [auth, firestore] = v.split(',').map((x) => x.trim());
  return /^[\w.-]+:\d+$/.test(auth ?? '') && /^[\w.-]+:\d+$/.test(firestore ?? '') ? { auth, firestore } : null;
}

let firestoreEmulatorConnected = false;

export function firebaseClient(): Promise<Sdk> {
  sdk ??= load().catch((e) => {
    sdk = null;
    throw e;
  });
  return sdk;
}

/** Email/Password sign-in (enabled by the owner). Returns the user id. */
export async function signInWithEmail(email: string, password: string): Promise<string> {
  const { auth } = await firebaseClient();
  const { signInWithEmailAndPassword } = await import('firebase/auth');
  return (await signInWithEmailAndPassword(auth, email, password)).user.uid;
}

/**
 * Email/Password registration. Sends the verification email at once; the AI layer needs a verified address.
 * `continueUrl` must be on an authorised domain.
 */
export async function registerWithEmail(email: string, password: string, continueUrl: string): Promise<string> {
  const { auth } = await firebaseClient();
  const { createUserWithEmailAndPassword, sendEmailVerification } = await import('firebase/auth');
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await sendEmailVerification(cred.user, { url: continueUrl });
  return cred.user.uid;
}

/** Sends the verification email again to the signed-in user. */
export async function resendVerification(continueUrl: string): Promise<void> {
  const { auth } = await firebaseClient();
  const { sendEmailVerification } = await import('firebase/auth');
  if (auth.currentUser) await sendEmailVerification(auth.currentUser, { url: continueUrl });
}

/** Password-reset email. Resolves the same whether or not the account exists, so callers reveal nothing. */
export async function sendPasswordReset(email: string, continueUrl: string): Promise<void> {
  const { auth } = await firebaseClient();
  const { sendPasswordResetEmail } = await import('firebase/auth');
  try {
    await sendPasswordResetEmail(auth, email, { url: continueUrl });
  } catch (e) {
    const code = (e as { code?: string })?.code ?? '';
    if (code !== 'auth/user-not-found') throw e;
  }
}

/** Reloads the user and refreshes the ID token, so a just-verified email shows in the token. True when verified. */
export async function refreshVerification(): Promise<boolean> {
  const { auth } = await firebaseClient();
  const u = auth.currentUser;
  if (!u) return false;
  await u.reload();
  await u.getIdToken(true);
  return auth.currentUser?.emailVerified === true;
}

const LINK_EMAIL_KEY = 'am.signin.email';

/**
 * Passwordless sign-in: Firebase sends a one-time link to the address. The link must return to an authorised domain
 * (Firebase console → Authentication → Settings → Authorised domains).
 */
export async function sendEmailLink(email: string, returnUrl: string): Promise<void> {
  const { auth } = await firebaseClient();
  const { sendSignInLinkToEmail } = await import('firebase/auth');
  await sendSignInLinkToEmail(auth, email, { url: returnUrl, handleCodeInApp: true });
  window.localStorage.setItem(LINK_EMAIL_KEY, email);
}

/** If the current URL is a sign-in link, complete it. Returns the email the link was sent to (asked for if unknown). */
export async function completeEmailLink(href: string, askEmail: () => string | null): Promise<{ done: boolean; email?: string }> {
  const { auth } = await firebaseClient();
  const { isSignInWithEmailLink, signInWithEmailLink } = await import('firebase/auth');
  if (!isSignInWithEmailLink(auth, href)) return { done: false };
  const email = window.localStorage.getItem(LINK_EMAIL_KEY) || askEmail();
  if (!email) return { done: false };
  await signInWithEmailLink(auth, email, href);
  window.localStorage.removeItem(LINK_EMAIL_KEY);
  return { done: true, email };
}

/**
 * Google sign-in. A pop-up by default; a full-page redirect where pop-ups cannot work (see ./google.ts) or when the
 * caller asks for one after a blocked pop-up. Resolves 'done' after a pop-up sign-in; a redirect leaves the page.
 */
export async function signInWithGoogle(mode: 'popup' | 'redirect' = 'popup'): Promise<'done' | 'redirecting'> {
  const { auth } = await firebaseClient();
  const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = await import('firebase/auth');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  if (mode === 'redirect') {
    await signInWithRedirect(auth, provider);
    return 'redirecting';
  }
  try {
    await signInWithPopup(auth, provider);
    return 'done';
  } catch (e) {
    if (REDIRECT_CODES.has((e as { code?: string })?.code ?? '')) {
      await signInWithRedirect(auth, provider);
      return 'redirecting';
    }
    throw e;
  }
}

/** Completes a Google redirect sign-in on return. True when this page load finished one. */
export async function completeGoogleRedirect(): Promise<boolean> {
  const { auth } = await firebaseClient();
  const { getRedirectResult } = await import('firebase/auth');
  return Boolean(await getRedirectResult(auth));
}

/** Calls back with the signed-in user (or null) whenever it changes. Returns an unsubscribe function. */
export async function watchUser(cb: (u: { uid: string; email: string | null; emailVerified: boolean; anonymous: boolean } | null) => void): Promise<() => void> {
  const { auth } = await firebaseClient();
  const { onAuthStateChanged } = await import('firebase/auth');
  return onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, email: u.email, emailVerified: u.emailVerified, anonymous: u.isAnonymous } : null));
}

/** A fresh ID token (forced refresh picks up workspace roles assigned after sign-in). */
export async function freshAuthHeader(force = false): Promise<{ authorization: string } | null> {
  const { auth } = await firebaseClient();
  const token = await auth.currentUser?.getIdToken(force);
  return token ? { authorization: `Bearer ${token}` } : null;
}

export async function signOutUser(): Promise<void> {
  const { auth } = await firebaseClient();
  const { signOut } = await import('firebase/auth');
  await signOut(auth);
}

/** `Authorization` header for calls to this site's write routes, or null when signed out. */
export async function authHeader(): Promise<{ authorization: string } | null> {
  const { auth } = await firebaseClient();
  const token = await auth.currentUser?.getIdToken();
  return token ? { authorization: `Bearer ${token}` } : null;
}

/** The Firestore client, for direct reads (and writes the rules allow) from the browser. */
export async function firestoreClient(): Promise<import('firebase/firestore').Firestore> {
  const { app } = await firebaseClient();
  const { getFirestore, connectFirestoreEmulator } = await import('firebase/firestore');
  const db = getFirestore(app);
  const emu = localEmulators();
  if (emu && !firestoreEmulatorConnected) {
    const [host, port] = emu.firestore.split(':');
    connectFirestoreEmulator(db, host, Number(port));
    firestoreEmulatorConnected = true;
  }
  return db;
}

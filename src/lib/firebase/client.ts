'use client';
/**
 * Browser Firebase SDK (ADR 0001): Firebase Auth for sign-in and ID tokens, Firestore for direct reads and writes
 * under firestore.rules. No admin key exists anywhere; the ID token is what the rules and the server routes check.
 *
 * Loaded lazily, only when a feature needs it, so pages that do not sign in ship no Firebase code.
 */
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
  return { app, auth: getAuth(app) };
}

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

/** Calls back with the signed-in user (or null) whenever it changes. Returns an unsubscribe function. */
export async function watchUser(cb: (u: { uid: string; email: string | null } | null) => void): Promise<() => void> {
  const { auth } = await firebaseClient();
  const { onAuthStateChanged } = await import('firebase/auth');
  return onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, email: u.email } : null));
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
  const { getFirestore } = await import('firebase/firestore');
  return getFirestore(app);
}

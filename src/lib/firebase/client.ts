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

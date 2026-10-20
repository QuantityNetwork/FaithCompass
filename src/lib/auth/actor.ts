/**
 * Who is making this request.
 *
 * Identity comes from a configured identity provider only. Firebase Auth is the intended one
 * (ADR 0001; AUTH_PROVIDER=firebase with FIREBASE_PROJECT_ID or NEXT_PUBLIC_FIREBASE_PROJECT_ID): a bearer ID token is verified
 * against Google's keys and the role is read from the custom claim `am_role`, which only the
 * server can set. Supabase Auth (AUTH_PROVIDER=supabase) is superseded but still supported: the
 * role is read from `app_metadata.am_role`, which only the service (never the user) can set. `user_metadata`,
 * request bodies, query strings and headers such as `x-role` are ignored on purpose, so a
 * role cannot be forged by the caller.
 *
 * With no identity provider configured, every request is an anonymous public reader. No
 * login is simulated.
 */
import { firebaseProjectId } from '@/lib/firebase/firestore-rest';
import { verifyFirebaseIdToken } from '@/lib/firebase/id-token';
import { isRole, type Role } from './roles';

export interface Actor {
  /** Stable user id from the identity provider, or null for an anonymous reader. */
  id: string | null;
  role: Role;
  authenticated: boolean;
  /** How the identity was established; 'none' when no provider is configured or no token was sent. */
  via: 'none' | 'supabase' | 'firebase';
}

const ID_TOKEN = Symbol('firebase-id-token');

/**
 * The verified Firebase ID token behind this actor, kept as a non-enumerable symbol property so it is never
 * serialised into a response or a log. The Firestore store forwards it so the security rules apply to the user.
 */
export function idTokenOf(actor: Actor): string | null {
  return (actor as Actor & { [ID_TOKEN]?: string })[ID_TOKEN] ?? null;
}

/** Test seam: an actor carrying an ID token (as resolveActor produces for Firebase). */
export function withIdToken(actor: Actor, token: string): Actor {
  const a = { ...actor };
  Object.defineProperty(a, ID_TOKEN, { value: token, enumerable: false });
  return a;
}

export const ANONYMOUS: Actor = Object.freeze({ id: null, role: 'public_reader', authenticated: false, via: 'none' });

function provider(): 'firebase' | 'supabase' | null {
  const p = (process.env.AUTH_PROVIDER || '').toLowerCase();
  if (p === 'firebase' && firebaseProjectId()) return 'firebase';
  if (
    p === 'supabase' &&
    Boolean(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  )
    return 'supabase';
  return null;
}

export function identityProviderConfigured(): boolean {
  return provider() !== null;
}

type Verifier = (token: string) => Promise<{ id: string; appRole: unknown } | null>;

async function supabaseVerifier(token: string): Promise<{ id: string; appRole: unknown } | null> {
  const { createClient } = await import('@supabase/supabase-js');
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)!;
  const anon = (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, appRole: (data.user.app_metadata as Record<string, unknown> | undefined)?.am_role };
}

async function firebaseVerifier(token: string): Promise<{ id: string; appRole: unknown } | null> {
  return verifyFirebaseIdToken(token, firebaseProjectId()!);
}

let override: Verifier | null = null;

/** Test seam: replaces token verification. */
export function setTokenVerifier(v: Verifier | null): void {
  override = v;
}

export async function resolveActor(request: Request): Promise<Actor> {
  const via = provider();
  if (!via) return ANONYMOUS;
  const verifier = override ?? (via === 'firebase' ? firebaseVerifier : supabaseVerifier);
  const auth = request.headers.get('authorization') ?? '';
  const m = /^Bearer\s+([A-Za-z0-9._~+/=-]{20,4096})$/.exec(auth.trim());
  if (!m) return ANONYMOUS;
  try {
    const user = await verifier(m[1]);
    if (!user) return ANONYMOUS;
    // An authenticated user with no assigned role is a contributor, never more.
    const role: Role = isRole(user.appRole) && user.appRole !== 'public_reader' ? user.appRole : 'research_contributor';
    const actor: Actor = { id: user.id, role, authenticated: true, via };
    return via === 'firebase' ? withIdToken(actor, m[1]) : actor;
  } catch {
    return ANONYMOUS;
  }
}

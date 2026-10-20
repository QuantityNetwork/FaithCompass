/**
 * Who is making this request.
 *
 * Identity comes from a configured identity provider only. Supabase Auth is the intended one:
 * a bearer access token is verified with Supabase, and the role is read from the user's
 * `app_metadata.am_role`, which only the service (never the user) can set. `user_metadata`,
 * request bodies, query strings and headers such as `x-role` are ignored on purpose, so a
 * role cannot be forged by the caller.
 *
 * With no identity provider configured, every request is an anonymous public reader. No
 * login is simulated.
 */
import { isRole, type Role } from './roles';

export interface Actor {
  /** Stable user id from the identity provider, or null for an anonymous reader. */
  id: string | null;
  role: Role;
  authenticated: boolean;
  /** How the identity was established; 'none' when no provider is configured or no token was sent. */
  via: 'none' | 'supabase';
}

export const ANONYMOUS: Actor = Object.freeze({ id: null, role: 'public_reader', authenticated: false, via: 'none' });

export function identityProviderConfigured(): boolean {
  return (
    (process.env.AUTH_PROVIDER || '').toLowerCase() === 'supabase' &&
    Boolean(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
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

let verifier: Verifier = supabaseVerifier;

/** Test seam: replaces token verification. */
export function setTokenVerifier(v: Verifier | null): void {
  verifier = v ?? supabaseVerifier;
}

export async function resolveActor(request: Request): Promise<Actor> {
  if (!identityProviderConfigured()) return ANONYMOUS;
  const auth = request.headers.get('authorization') ?? '';
  const m = /^Bearer\s+([A-Za-z0-9._~+/=-]{20,4096})$/.exec(auth.trim());
  if (!m) return ANONYMOUS;
  try {
    const user = await verifier(m[1]);
    if (!user) return ANONYMOUS;
    // An authenticated user with no assigned role is a contributor, never more.
    const role: Role = isRole(user.appRole) && user.appRole !== 'public_reader' ? user.appRole : 'research_contributor';
    return { id: user.id, role, authenticated: true, via: 'supabase' };
  } catch {
    return ANONYMOUS;
  }
}

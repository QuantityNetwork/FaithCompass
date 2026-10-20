/**
 * Verify a Firebase Auth ID token on the server, without an SDK.
 *
 * Checks, per Firebase's documented rules: RS256 signature against Google's published securetoken keys (by kid),
 * `aud` = project id, `iss` = https://securetoken.google.com/<project>, `exp` in the future, `iat` and `auth_time`
 * not in the future, non-empty `sub`. Anonymous sign-ins are rejected (they are public readers). The role is the
 * custom claim `am_role`, which only the server (Admin API) can set.
 */
import { createPublicKey, verify, type JsonWebKey } from 'node:crypto';

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

export interface VerifiedFirebaseUser {
  id: string;
  appRole: unknown;
  email: string | null;
}

type Jwks = { keys: (JsonWebKey & { kid: string })[] };
let cache: { keys: Jwks; until: number } | null = null;

async function jwks(fetchImpl: typeof fetch): Promise<Jwks> {
  if (cache && cache.until > Date.now()) return cache.keys;
  const res = await fetchImpl(JWKS_URL);
  if (!res.ok) throw new Error(`Could not load Firebase signing keys (HTTP ${res.status}).`);
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1] ?? 3600);
  const keys = (await res.json()) as Jwks;
  cache = { keys, until: Date.now() + maxAge * 1000 };
  return keys;
}

function part(s: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));
}

export async function verifyFirebaseIdToken(
  token: string,
  projectId: string,
  opts: { fetchImpl?: typeof fetch; now?: number; keys?: Jwks } = {},
): Promise<VerifiedFirebaseUser | null> {
  const segments = token.split('.');
  if (segments.length !== 3) return null;
  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = part(segments[0]);
    payload = part(segments[1]);
  } catch {
    return null;
  }
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') return null;
  const keys = opts.keys ?? (await jwks(opts.fetchImpl ?? fetch));
  const jwk = keys.keys.find((k) => k.kid === header.kid);
  if (!jwk) return null;
  const ok = verify('RSA-SHA256', Buffer.from(`${segments[0]}.${segments[1]}`), createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(segments[2], 'base64url'));
  if (!ok) return null;
  const now = Math.floor((opts.now ?? Date.now()) / 1000);
  const num = (v: unknown) => (typeof v === 'number' ? v : NaN);
  if (payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}`) return null;
  if (!(num(payload.exp) > now) || !(num(payload.iat) <= now + 60) || !(num(payload.auth_time) <= now + 60)) return null;
  if (typeof payload.sub !== 'string' || payload.sub.length === 0 || payload.sub.length > 128) return null;
  const provider = (payload.firebase as { sign_in_provider?: string } | undefined)?.sign_in_provider;
  if (provider === 'anonymous') return null;
  return { id: payload.sub, appRole: payload.am_role, email: typeof payload.email === 'string' ? payload.email : null };
}

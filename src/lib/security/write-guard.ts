/**
 * Gate for every state-changing request.
 *
 * In order: same-origin check (CSRF), JSON content type (which also forces a
 * CORS preflight on cross-site requests), body size cap, per-client rate limit
 * and a per-instance daily quota, then the actor's permission. Every outcome is
 * logged as a structured security event.
 *
 * Limits are held in process memory, so on a serverless host they are per
 * instance: a brake, not a guarantee. A durable quota needs the database
 * (see docs/RELEASE_BLOCKERS.md).
 */
import { NextResponse } from 'next/server';
import { resolveActor, type Actor } from '@/lib/auth/actor';
import { can, type Permission } from '@/lib/auth/roles';
import { clientKey } from '@/lib/api/http';
import { hashClient, newRequestId, securityEvent } from './audit-log';

export interface GuardOptions {
  permission: Permission;
  /** Action name for logs and rate-limit buckets. */
  action: string;
  maxBytes?: number;
  perMinute?: number;
  perDay?: number;
}

export type GuardResult =
  | { ok: true; actor: Actor; body: unknown; requestId: string; client: string }
  | { ok: false; response: Response };

const minuteWindows = new Map<string, { start: number; count: number }>();
const dayWindows = new Map<string, { start: number; count: number }>();

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function bump(map: Map<string, { start: number; count: number }>, key: string, windowMs: number, now: number): number {
  let w = map.get(key);
  if (!w || now - w.start >= windowMs) {
    w = { start: now, count: 0 };
    map.set(key, w);
  }
  w.count += 1;
  if (map.size > 10_000) for (const [k, v] of map) if (now - v.start >= windowMs) map.delete(k);
  return w.count;
}

/** Test seam. */
export function resetWriteLimits(): void {
  minuteWindows.clear();
  dayWindows.clear();
}

function originOf(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    const u = new URL(value.includes('://') ? value : `https://${value}`);
    return u.origin;
  } catch {
    return null;
  }
}

export function allowedOrigins(request: Request): Set<string> {
  const set = new Set<string>();
  const add = (v: string | undefined | null) => {
    const o = originOf(v);
    if (o) set.add(o);
  };
  add(new URL(request.url).origin);
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (host) {
    const proto = request.headers.get('x-forwarded-proto') ?? new URL(request.url).protocol.replace(':', '');
    add(`${proto}://${host}`);
  }
  add(process.env.ABRAHAMMOSES_PUBLIC_ORIGIN);
  for (const o of (process.env.ABRAHAMMOSES_LEGACY_ORIGINS ?? '').split(',')) add(o.trim());
  add(process.env.VERCEL_URL);
  add(process.env.VERCEL_BRANCH_URL);
  add(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  return set;
}

function deny(status: number, code: string, message: string, extra: Record<string, string> = {}): Response {
  return NextResponse.json({ error: message, code }, { status, headers: { 'cache-control': 'no-store', ...extra } });
}

export async function guardWrite(request: Request, opts: GuardOptions): Promise<GuardResult> {
  const requestId = newRequestId();
  const client = hashClient(clientKey(request));
  const log = (status: number, outcome: 'allowed' | 'denied', reason: string, actor?: Actor) =>
    securityEvent({ action: opts.action, outcome, status, reason, actorRole: actor?.role ?? 'unknown', actorId: actor?.id ?? null, client, requestId });

  // 1. CSRF: a browser always sends Origin on a cross-site POST.
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  if (origin !== null) {
    if (origin === 'null' || !allowedOrigins(request).has(origin)) {
      log(403, 'denied', 'origin_mismatch');
      return { ok: false, response: deny(403, 'forbidden_origin', 'Cross-origin writes are not accepted.') };
    }
  } else if (fetchSite === 'cross-site') {
    log(403, 'denied', 'cross_site');
    return { ok: false, response: deny(403, 'forbidden_origin', 'Cross-origin writes are not accepted.') };
  }

  // 2. Content type.
  const ctype = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (ctype !== 'application/json') {
    log(415, 'denied', 'content_type');
    return { ok: false, response: deny(415, 'unsupported_media_type', 'Send the request body as application/json.') };
  }

  // 3. Rate limit and quota, before any expensive work.
  const now = Date.now();
  const perMinute = opts.perMinute ?? envInt('WRITE_RATE_LIMIT_PER_MINUTE', 10);
  const perDay = opts.perDay ?? envInt('WRITE_DAILY_QUOTA', 500);
  const used = bump(minuteWindows, `${opts.action}:${client}`, 60_000, now);
  if (used > perMinute) {
    log(429, 'denied', 'rate_limited');
    return { ok: false, response: deny(429, 'rate_limited', `At most ${perMinute} requests per minute.`, { 'Retry-After': '60' }) };
  }
  const daily = bump(dayWindows, opts.action, 86_400_000, now);
  if (daily > perDay) {
    log(429, 'denied', 'quota_exhausted');
    return { ok: false, response: deny(429, 'quota_exhausted', 'The daily quota for this action is used up.', { 'Retry-After': '3600' }) };
  }

  // 4. Body: size cap, then JSON.
  const maxBytes = opts.maxBytes ?? 32_768;
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    log(413, 'denied', 'too_large');
    return { ok: false, response: deny(413, 'payload_too_large', `Body larger than ${maxBytes} bytes.`) };
  }
  const text = await request.text();
  if (Buffer.byteLength(text, 'utf8') > maxBytes) {
    log(413, 'denied', 'too_large');
    return { ok: false, response: deny(413, 'payload_too_large', `Body larger than ${maxBytes} bytes.`) };
  }
  let body: unknown;
  try {
    body = text.length ? JSON.parse(text) : {};
  } catch {
    log(400, 'denied', 'bad_json');
    return { ok: false, response: deny(400, 'invalid_json', 'Request body must be JSON.') };
  }

  // 5. Who, and may they. The role comes from the verified identity only.
  const actor = await resolveActor(request);
  if (!can(actor.role, opts.permission)) {
    const status = actor.authenticated ? 403 : 401;
    log(status, 'denied', 'permission', actor);
    return {
      ok: false,
      response: deny(
        status,
        actor.authenticated ? 'forbidden' : 'unauthenticated',
        actor.authenticated ? 'Your role does not permit this action.' : 'This action requires a signed-in account with an editorial role.',
      ),
    };
  }

  log(200, 'allowed', 'passed_guard', actor);
  return { ok: true, actor, body, requestId, client };
}

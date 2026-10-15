/**
 * HTTP conventions shared by every public endpoint.
 *
 *   Errors      One envelope: { error: { code, message, status, details?, docs } }
 *               with stable codes, so clients branch on `code`, never on prose.
 *   CORS        Open: the record is public and read-only, so any browser
 *               client may call it. Preflight is answered for every route.
 *   Caching     Responses carry an ETag over their body and honour
 *               If-None-Match; public caches may hold them for 60 seconds.
 *   Versioning  X-AbrahamMoses-API-Version and X-Record-Version on every
 *               response; the record version also appears in list bodies.
 *   Rate limits Per client address, per server instance (best effort on a
 *               serverless host). Standard RateLimit-* headers on every
 *               response; 429 with Retry-After when exceeded.
 */

import { createHash } from 'node:crypto';
import { API_VERSION, absoluteUrl } from '@/lib/site/config';

export const ERROR_CODES = {
  invalid_parameter: { status: 400, description: 'A query parameter, path segment or body field failed validation.' },
  invalid_json: { status: 400, description: 'The request body is not valid JSON.' },
  not_found: { status: 404, description: 'No published record has this code, or the route does not exist.' },
  method_not_allowed: { status: 405, description: 'The route exists but does not accept this HTTP method.' },
  payload_too_large: { status: 413, description: 'The request body exceeds 64 KiB.' },
  unauthorized: { status: 401, description: 'The endpoint requires credentials that were not supplied.' },
  forbidden: { status: 403, description: 'The supplied credentials do not grant this action.' },
  rate_limited: { status: 429, description: 'Too many requests from this client; retry after the indicated delay.' },
  internal_error: { status: 500, description: 'An unexpected error. Nothing was changed; the request can be retried.' },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Accept, Authorization, If-None-Match, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID',
  'Access-Control-Expose-Headers':
    'ETag, X-AbrahamMoses-API-Version, X-Record-Version, RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset, Retry-After, Mcp-Protocol-Version',
  'Access-Control-Max-Age': '86400',
};

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function baseHeaders(recordVersion?: string): Headers {
  const h = new Headers(CORS_HEADERS);
  h.set('X-AbrahamMoses-API-Version', API_VERSION);
  if (recordVersion) h.set('X-Record-Version', recordVersion);
  h.set('X-Content-Type-Options', 'nosniff');
  return h;
}

export function errorBody(code: ErrorCode, message: string, details?: unknown) {
  return {
    error: {
      code,
      message,
      status: ERROR_CODES[code].status,
      ...(details === undefined ? {} : { details }),
      docs: absoluteUrl(`/developers#error-${code}`),
    },
  };
}

export function errorResponse(code: ErrorCode, message: string, details?: unknown, extra?: Record<string, string>): Response {
  const headers = baseHeaders();
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(extra ?? {})) headers.set(k, v);
  return new Response(JSON.stringify(errorBody(code, message, details), null, 2), {
    status: ERROR_CODES[code].status,
    headers,
  });
}

export function jsonResponse(
  request: Request,
  body: unknown,
  opts: { recordVersion?: string; cache?: 'public' | 'none'; status?: number; headers?: Record<string, string> } = {},
): Response {
  const text = JSON.stringify(body, null, 2);
  const etag = `"${createHash('sha256').update(text).digest('base64url').slice(0, 27)}"`;
  const headers = baseHeaders(opts.recordVersion);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('ETag', etag);
  headers.set(
    'Cache-Control',
    opts.cache === 'none' ? 'no-store' : 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
  );
  for (const [k, v] of Object.entries(opts.headers ?? {})) headers.set(k, v);

  const inm = request.headers.get('if-none-match');
  if (inm && inm.split(',').map((s) => s.trim()).includes(etag)) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(text, { status: opts.status ?? 200, headers });
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: baseHeaders() });
}

/* ------------------------------------------------------------------ *
 * Rate limiting
 * ------------------------------------------------------------------ */

interface Window {
  start: number;
  count: number;
}

const WINDOWS = new Map<string, Window>();
const WINDOW_MS = 60_000;

export function rateLimitPerMinute(): number {
  const n = Number(process.env.API_RATE_LIMIT_PER_MINUTE);
  return Number.isFinite(n) && n > 0 ? n : 120;
}

export function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return (forwarded?.split(',')[0] ?? request.headers.get('x-real-ip') ?? 'anonymous').trim();
}

/** Returns the headers to attach, and whether the request may proceed. */
export function rateLimit(request: Request, now = Date.now()): { ok: boolean; headers: Record<string, string> } {
  const limit = rateLimitPerMinute();
  const key = clientKey(request);
  let w = WINDOWS.get(key);
  if (!w || now - w.start >= WINDOW_MS) {
    w = { start: now, count: 0 };
    WINDOWS.set(key, w);
  }
  w.count += 1;
  // Opportunistic cleanup so the map cannot grow without bound.
  if (WINDOWS.size > 10_000) {
    for (const [k, v] of WINDOWS) if (now - v.start >= WINDOW_MS) WINDOWS.delete(k);
  }
  const reset = Math.max(1, Math.ceil((w.start + WINDOW_MS - now) / 1000));
  const headers: Record<string, string> = {
    'RateLimit-Limit': String(limit),
    'RateLimit-Remaining': String(Math.max(0, limit - w.count)),
    'RateLimit-Reset': String(reset),
  };
  if (w.count > limit) return { ok: false, headers: { ...headers, 'Retry-After': String(reset) } };
  return { ok: true, headers };
}

/** Test seam. */
export function resetRateLimits(): void {
  WINDOWS.clear();
}

/** Run a handler with rate limiting and the error contract. */
export async function guarded(request: Request, run: () => Promise<Response> | Response): Promise<Response> {
  if (request.method === 'OPTIONS') return preflight();
  const limit = rateLimit(request);
  if (!limit.ok) {
    return errorResponse('rate_limited', `Rate limit of ${rateLimitPerMinute()} requests per minute exceeded.`, undefined, limit.headers);
  }
  let response: Response;
  try {
    response = await run();
  } catch (err) {
    if (err instanceof ApiError) response = errorResponse(err.code, err.message, err.details);
    else {
      console.error('[api] unhandled error', err);
      response = errorResponse('internal_error', 'An unexpected error occurred. Nothing was changed.');
    }
  }
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(limit.headers)) headers.set(k, v);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export async function readJsonBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > 65_536) throw new ApiError('payload_too_large', 'Request body exceeds 64 KiB.');
  if (text.trim() === '') return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError('invalid_json', 'Request body is not valid JSON.');
  }
}

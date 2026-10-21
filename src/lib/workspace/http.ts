/** HTTP handling shared by the workspace routes: same-origin writes, JSON bodies, a per-user rate limit, logging. */
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { clientKey } from '@/lib/api/http';
import { FirestoreConfigError, FirestoreRequestError } from '@/lib/firebase/firestore-rest';
import { hashClient, newRequestId, securityEvent } from '@/lib/security/audit-log';
import { allowedOrigins } from '@/lib/security/write-guard';
import { WorkspaceAccessError, previewWriteBlock, workspaceActor, type WorkspaceActor } from './access';
import { ImportError } from './model';

const NO_STORE = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' };
const windows = new Map<string, { start: number; count: number }>();

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

function limited(key: string, perMinute: number): boolean {
  const now = Date.now();
  let w = windows.get(key);
  if (!w || now - w.start >= 60_000) {
    w = { start: now, count: 0 };
    windows.set(key, w);
  }
  w.count += 1;
  if (windows.size > 5_000) windows.clear();
  return w.count > perMinute;
}

export interface Ctx {
  actor: WorkspaceActor;
  body: unknown;
}

/**
 * Wrap a workspace handler. Writes must be same-origin JSON (CSRF), at most `maxBytes`, and are rate-limited per
 * user. Errors map to clear statuses; Firestore details and tokens never reach the response.
 */
export async function handle(
  request: Request,
  action: string,
  fn: (ctx: Ctx) => Promise<Response>,
  opts: { write?: boolean; maxBytes?: number; perMinute?: number } = {},
): Promise<Response> {
  const requestId = newRequestId();
  const client = hashClient(clientKey(request));
  let actorId: string | null = null;
  const log = (status: number, outcome: 'allowed' | 'denied' | 'error', reason: string) =>
    securityEvent({ action, outcome, status, reason, actorRole: 'workspace', actorId, client, requestId });
  try {
    if (opts.write) {
      const origin = request.headers.get('origin');
      if ((origin !== null && (origin === 'null' || !allowedOrigins(request).has(origin))) || (origin === null && request.headers.get('sec-fetch-site') === 'cross-site')) {
        log(403, 'denied', 'origin_mismatch');
        return json({ error: 'Cross-origin writes are not accepted.', code: 'FORBIDDEN_ORIGIN' }, 403);
      }
      const ctype = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
      if (ctype !== 'application/json') return json({ error: 'Send the request body as application/json.', code: 'UNSUPPORTED_MEDIA_TYPE' }, 415);
    }
    const actor = await workspaceActor(request);
    const blocked = opts.write ? previewWriteBlock() : null;
    if (blocked) {
      actorId = actor.uid;
      log(503, 'denied', 'preview_writes_disabled');
      return json({ error: blocked, code: 'PREVIEW_WRITES_DISABLED' }, 503);
    }
    actorId = actor.uid;
    if (limited(`${actor.uid}:${opts.write ? 'w' : 'r'}`, opts.perMinute ?? (opts.write ? 30 : 120))) {
      log(429, 'denied', 'rate_limited');
      return json({ error: 'Too many requests; wait a minute.', code: 'RATE_LIMITED' }, 429, { 'retry-after': '60' });
    }
    let body: unknown = null;
    if (opts.write) {
      const text = await request.text();
      if (text.length > (opts.maxBytes ?? 16_384)) return json({ error: 'Request body too large.', code: 'TOO_LARGE' }, 413);
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        return json({ error: 'Invalid JSON.', code: 'INVALID_JSON' }, 400);
      }
    }
    const res = await fn({ actor, body });
    log(res.status, res.status < 400 ? 'allowed' : 'denied', 'ok');
    return res;
  } catch (e) {
    if (e instanceof WorkspaceAccessError) {
      log(e.status, 'denied', e.code);
      return json({ error: e.message, code: e.code }, e.status);
    }
    if (e instanceof ImportError) {
      log(e.status, 'denied', 'import_error');
      return json({ error: e.message, code: 'IMPORT_REJECTED' }, e.status);
    }
    if (e instanceof ZodError) {
      return json({ error: 'Invalid request.', code: 'INVALID_REQUEST', issues: e.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) }, 400);
    }
    if (e instanceof FirestoreConfigError) {
      log(503, 'error', 'not_configured');
      return json({ error: 'The workspace store is not configured on this deployment.', code: 'NOT_CONFIGURED' }, 503);
    }
    const status = e instanceof FirestoreRequestError ? 502 : 500;
    log(status, 'error', e instanceof FirestoreRequestError ? `firestore_${e.grpcStatus}` : 'internal');
    return json({ error: 'The request failed.', code: 'FAILED', requestId }, status);
  }
}

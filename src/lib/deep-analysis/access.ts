/**
 * Who may use the AI layer, and how much. Deterministic analysis is open (rate-limited, nothing stored). The AI layer
 * costs money per call and sends the text to the AI provider, so it runs only for:
 * - signed-in mode (production, and previews without the flag below): any signed-in Firebase user who is not
 *   anonymous and whose email address is verified (Google accounts are; email/password accounts after the
 *   verification link). No token: 401. Unverified email: 403. Anonymous tokens are rejected by the verifier: 401.
 * - a preview with DEEP_ANALYSIS_AI_ACCESS=deployment-protected: anyone who can reach the deployment, which Vercel
 *   Authentication limits to the team and holders of a share link;
 * - local development (no VERCEL_ENV): allowed.
 * Abuse brakes on top: DEEP_ANALYSIS_AI_USER_DAILY_LIMIT runs per user per day (default 10), DEEP_ANALYSIS_AI_DAILY_LIMIT
 * runs per day in total (default 300), and 6 runs per client per 10 minutes. The counters are per server instance
 * (no server-side store that a route may write without an admin key): a brake, not a guarantee.
 */
import { WorkspaceAccessError, workspaceActor } from '@/lib/workspace/access';

type Env = Record<string, string | undefined>;
type Window = { start: number; count: number };
const day: Window = { start: 0, count: 0 };
const users = new Map<string, Window>();
const clients = new Map<string, Window>();
const DAY = 86_400_000;

export type AiAccessMode = 'local' | 'deployment-protected' | 'signed-in';
export type AiDecision =
  | { ok: true; uid: string | null }
  /** status set: refuse the request (401/403/503). Without status: run the deterministic layer only, with this note. */
  | { ok: false; status?: 401 | 403 | 503; code: string; message: string };

export function resetAiLimits() {
  day.start = 0;
  day.count = 0;
  users.clear();
  clients.clear();
}

const int = (v: string | undefined, d: number) => {
  const n = Number(v);
  return v !== undefined && v !== '' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : d;
};
export const aiDailyLimit = (env: Env = process.env) => int(env.DEEP_ANALYSIS_AI_DAILY_LIMIT, 300);
export const aiUserDailyLimit = (env: Env = process.env) => int(env.DEEP_ANALYSIS_AI_USER_DAILY_LIMIT, 10);

export function aiAccessMode(env: Env = process.env): AiAccessMode {
  if (!env.VERCEL_ENV) return 'local';
  if (env.VERCEL_ENV === 'preview' && env.DEEP_ANALYSIS_AI_ACCESS === 'deployment-protected') return 'deployment-protected';
  return 'signed-in';
}

function windowFor(map: Map<string, Window>, key: string, span: number, now: number): Window {
  let w = map.get(key);
  if (!w || now - w.start >= span) {
    w = { start: now, count: 0 };
    map.set(key, w);
  }
  if (map.size > 5000) map.clear();
  return w;
}

/** The signed-in identity behind the request, or the refusal. Does not count anything. */
export async function aiIdentity(request: Request, env: Env = process.env): Promise<AiDecision> {
  const mode = aiAccessMode(env);
  if (mode !== 'signed-in') return { ok: true, uid: null };
  if (!/^Bearer\s+/i.test(request.headers.get('authorization') ?? ''))
    return { ok: false, status: 401, code: 'SIGN_IN_REQUIRED', message: 'Sign in to use the AI layer. Rule-based analysis works without an account.' };
  try {
    const actor = await workspaceActor(request);
    if (actor.emailVerified !== true)
      return { ok: false, status: 403, code: 'EMAIL_NOT_VERIFIED', message: 'Verify your email address to use the AI layer: open the link we sent you, then try again.' };
    return { ok: true, uid: actor.uid };
  } catch (e) {
    if (e instanceof WorkspaceAccessError && e.status === 503) return { ok: false, status: 503, code: 'NOT_CONFIGURED', message: 'Sign-in is not configured on this deployment.' };
    return { ok: false, status: 401, code: 'INVALID_TOKEN', message: 'Your sign-in has expired or is not accepted. Sign in again.' };
  }
}

/** Remaining AI runs today for this user on this instance (for display). */
export function aiRemaining(uid: string | null, env: Env = process.env, now = Date.now()): number {
  const u = uid ? users.get(uid) : undefined;
  const used = u && now - u.start < DAY ? u.count : 0;
  return Math.max(0, aiUserDailyLimit(env) - used);
}

/** Identity, then the abuse brakes. Counts the run when it is allowed. */
export async function aiAccess(request: Request, client: string, env: Env = process.env, now = Date.now()): Promise<AiDecision> {
  const who = await aiIdentity(request, env);
  if (!who.ok) return who;
  if (now - day.start >= DAY) {
    day.start = now;
    day.count = 0;
  }
  if (day.count >= aiDailyLimit(env)) return { ok: false, code: 'DAILY_LIMIT', message: 'The daily limit of AI analyses on this site is reached; rule-based analysis only until tomorrow.' };
  const u = who.uid ? windowFor(users, who.uid, DAY, now) : null;
  if (u && u.count >= aiUserDailyLimit(env)) return { ok: false, code: 'USER_DAILY_LIMIT', message: `You have used your ${aiUserDailyLimit(env)} AI analyses for today; rule-based analysis only until tomorrow.` };
  const c = windowFor(clients, client, 600_000, now);
  if (c.count >= 6) return { ok: false, code: 'CLIENT_LIMIT', message: 'At most 6 AI analyses per 10 minutes; rule-based analysis only for now.' };
  c.count++;
  if (u) u.count++;
  day.count++;
  return who;
}

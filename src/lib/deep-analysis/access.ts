/**
 * Who may use the AI layer, and how much. Deterministic analysis is open (rate-limited, nothing stored). The AI
 * layer costs money per call, so it is never open to the internet:
 * - production: a signed-in Firebase user whose e-mail is in DEEP_ANALYSIS_AI_ALLOWED_EMAILS or who belongs to a
 *   workspace;
 * - a preview with DEEP_ANALYSIS_AI_ACCESS=deployment-protected: anyone who can reach the deployment, which Vercel
 *   Authentication limits to the team and holders of a share link (previews are not on Firebase's authorized
 *   domains, so Google sign-in cannot work there);
 * - other previews: as production;
 * - local development (no VERCEL_ENV): allowed.
 * On top, a daily cap of AI analyses (DEEP_ANALYSIS_AI_DAILY_LIMIT, default 40) and a per-client limit of 6 AI
 * analyses per 10 minutes. The counters are per server instance: a brake, not a guarantee.
 */
import { workspaceActor } from '@/lib/workspace/access';

type Env = Record<string, string | undefined>;
const day = { start: 0, count: 0 };
const clients = new Map<string, { start: number; count: number }>();

export function resetAiLimits() {
  day.start = 0;
  day.count = 0;
  clients.clear();
}

export const aiDailyLimit = (env: Env = process.env) => {
  const n = Number(env.DEEP_ANALYSIS_AI_DAILY_LIMIT);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 40;
};

async function signedInAllowed(request: Request, env: Env): Promise<string | null> {
  if (!/^Bearer\s+/i.test(request.headers.get('authorization') ?? '')) return 'The AI layer is available to signed-in, approved users only on this deployment.';
  try {
    const actor = await workspaceActor(request);
    const allowed = (env.DEEP_ANALYSIS_AI_ALLOWED_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
    if ((actor.email && allowed.includes(actor.email.toLowerCase())) || Object.keys(actor.tenants ?? {}).length > 0) return null;
    return 'Your account is not approved for the AI layer yet.';
  } catch {
    return 'Sign in again to use the AI layer.';
  }
}

/** null when this request may use the AI layer; otherwise the reason shown in the report. */
export async function aiAccess(request: Request, client: string, env: Env = process.env, now = Date.now()): Promise<string | null> {
  const vercelEnv = env.VERCEL_ENV;
  let reason: string | null = null;
  if (vercelEnv === 'preview' && env.DEEP_ANALYSIS_AI_ACCESS === 'deployment-protected') reason = null;
  else if (vercelEnv) reason = await signedInAllowed(request, env);
  if (reason) return reason;
  if (now - day.start >= 86_400_000) {
    day.start = now;
    day.count = 0;
  }
  if (day.count >= aiDailyLimit(env)) return 'The daily limit of AI analyses on this deployment is reached; deterministic rules only until tomorrow.';
  let w = clients.get(client);
  if (!w || now - w.start >= 600_000) {
    w = { start: now, count: 0 };
    clients.set(client, w);
  }
  if (w.count >= 6) return 'At most 6 AI analyses per 10 minutes; deterministic rules only for now.';
  w.count++;
  day.count++;
  if (clients.size > 5000) clients.clear();
  return null;
}

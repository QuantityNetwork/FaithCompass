import type { OrganizationSettingsRow } from "@/domain/entities";
import type { GatewayStore } from "@/server/store/types";
import type { AnyTool } from "@/server/tools/types";
import { requesterKey, type Caller } from "./caller";

const WINDOW_SECONDS = 60;

export type RateLimitResult =
  | { ok: true }
  | { ok: false; code: "rate_limited" | "loop_detected"; message: string; retryAfterSeconds: number };

/**
 * Fixed-window limits across requester, requester×tool and organization, plus
 * loop protection: identical calls repeated within a minute are rejected, since
 * agents can re-issue the same call unexpectedly.
 */
export async function checkRateLimits(
  store: GatewayStore,
  caller: Caller,
  tool: AnyTool | null,
  toolName: string,
  settings: OrganizationSettingsRow,
  callFingerprint: string,
  now: Date,
): Promise<RateLimitResult> {
  const windowStartMs = Math.floor(now.getTime() / (WINDOW_SECONDS * 1000)) * WINDOW_SECONDS * 1000;
  const windowStart = new Date(windowStartMs).toISOString();
  const retryAfterSeconds = Math.max(1, Math.ceil((windowStartMs + WINDOW_SECONDS * 1000 - now.getTime()) / 1000));
  const requester = requesterKey(caller);
  const limits = [
    { key: `req:${requester}`, limit: settings.rate_limit_per_minute, code: "rate_limited" as const, label: "this connection" },
    { key: `tool:${requester}:${toolName}`, limit: tool?.rateLimitPerMinute ?? 30, code: "rate_limited" as const, label: toolName },
    { key: `org:${caller.organizationId}:${caller.environment}`, limit: settings.rate_limit_per_minute * 10, code: "rate_limited" as const, label: "this organization" },
    { key: `loop:${requester}:${callFingerprint}`, limit: settings.loop_threshold, code: "loop_detected" as const, label: "identical calls" },
  ];
  const counts = await store.incrementRateCounters(
    limits.map((l) => `${l.key}:${windowStart}`),
    windowStart,
    WINDOW_SECONDS,
  );
  // Loop detection first: it carries the most useful guidance for an agent.
  const order = [3, 0, 1, 2];
  for (const i of order) {
    const l = limits[i]!;
    if ((counts[i] ?? 0) > l.limit) {
      return {
        ok: false,
        code: l.code,
        retryAfterSeconds,
        message:
          l.code === "loop_detected"
            ? `${toolName} was called with identical arguments more than ${l.limit} times in a minute. Reuse the previous result instead of repeating the call.`
            : `Rate limit reached for ${l.label} (${l.limit} calls per minute). Retry after ${retryAfterSeconds} seconds.`,
      };
    }
  }
  return { ok: true };
}

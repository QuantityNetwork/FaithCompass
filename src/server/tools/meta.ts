import type { ExecutionClass } from "@/domain/execution-classes";
import type { ToolChange } from "./types";

const LIMITS: Record<ExecutionClass, { rateLimitPerMinute: number; timeoutMs: number }> = {
  read: { rateLimitPerMinute: 60, timeoutMs: 8_000 },
  simulate: { rateLimitPerMinute: 30, timeoutMs: 10_000 },
  prepare: { rateLimitPerMinute: 10, timeoutMs: 10_000 },
  execute: { rateLimitPerMinute: 5, timeoutMs: 15_000 },
};

export const INITIAL_RELEASE: ToolChange[] = [{ version: "1.0.0", date: "2026-09-28", notes: "Initial release." }];

/** Shared operational defaults for a tool of the given class. */
export function operational(cls: ExecutionClass) {
  return {
    ...LIMITS[cls],
    status: "active" as const,
    environments: ["sandbox" as const, "production" as const],
    createdAt: "2026-09-01",
    updatedAt: "2026-09-28",
    changelog: INITIAL_RELEASE,
  };
}

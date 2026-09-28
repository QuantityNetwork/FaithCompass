import type { Scope } from "@/domain/scopes";
import type { NonSuccessOutcome, ToolContext } from "./types";

/** Dynamic scope check for sections or behaviours beyond a tool's base scopes. */
export function hasScope(ctx: ToolContext, scope: Scope): boolean {
  return ctx.scopes.has(scope);
}

export function requireScopes(ctx: ToolContext, scopes: Scope[], purpose: string): NonSuccessOutcome | null {
  const missing = scopes.filter((s) => !ctx.scopes.has(s));
  if (missing.length === 0) return null;
  return {
    status: "denied",
    missing_scopes: missing,
    message: `${purpose} requires the ${missing.join(", ")} scope${missing.length > 1 ? "s" : ""}, which this connection has not been granted.`,
  };
}

export function restricted(scope: Scope, reason: string) {
  return { restricted: true as const, required_scope: scope, reason };
}

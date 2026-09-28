import type { MemberRole, OrganizationSettingsRow } from "@/domain/entities";
import { classRank, type ExecutionClass } from "@/domain/execution-classes";
import type { Scope } from "@/domain/scopes";
import type { PolicyDecision } from "@/domain/statuses";
import type { AnyTool } from "@/server/tools/types";
import type { Caller } from "./caller";

export type PolicyEffect = "allow" | "deny" | "require_approval";

export interface PolicyReason {
  rule: string;
  effect: PolicyEffect;
  message: string;
}

export interface PolicyResult {
  decision: PolicyDecision;
  reasons: PolicyReason[];
  missingScopes: Scope[];
  /** Machine-readable code of the first denying rule. */
  code: string | null;
}

export interface PolicyInput {
  tool: AnyTool;
  caller: Caller;
  settings: OrganizationSettingsRow;
  now: Date;
  /** Monetary exposure of the action, when known (after the approval plan is resolved). */
  amountCents?: number | null;
}

/** The highest execution class each organization role may authorize an agent to use. */
export const ROLE_CEILING: Record<MemberRole, ExecutionClass> = {
  viewer: "simulate",
  member: "prepare",
  admin: "execute",
  owner: "execute",
};

interface Rule {
  id: string;
  evaluate(input: PolicyInput): { effect: PolicyEffect; message: string; code?: string; missing?: Scope[] } | null;
}

/**
 * Ordered policy rules. Authentication establishes who the caller is; these
 * rules decide what the caller may do. Every rule is evaluated so the audit
 * trail records the complete reasoning, and any deny wins.
 */
const RULES: Rule[] = [
  {
    id: "tool_lifecycle",
    evaluate: ({ tool }) =>
      tool.status === "retired"
        ? { effect: "deny", code: "tool_retired", message: `${tool.name}@${tool.version} is retired.` }
        : tool.status === "deprecated"
          ? { effect: "allow", message: `${tool.name}@${tool.version} is deprecated; migrate to the current version.` }
          : null,
  },
  {
    id: "environment",
    evaluate: ({ tool, caller }) =>
      tool.environments.includes(caller.environment)
        ? null
        : { effect: "deny", code: "environment_not_supported", message: `${tool.name} is not available in ${caller.environment}.` },
  },
  {
    id: "session",
    evaluate: ({ caller, now }) =>
      caller.sessionExpiresAt && caller.sessionExpiresAt <= now.toISOString()
        ? { effect: "deny", code: "session_expired", message: "The session has expired." }
        : null,
  },
  {
    id: "scopes",
    evaluate: ({ tool, caller }) => {
      const missing = tool.requiredScopes.filter((s) => !caller.scopes.includes(s));
      return missing.length
        ? { effect: "deny", code: "insufficient_scope", missing, message: `Missing required scope(s): ${missing.join(", ")}.` }
        : { effect: "allow", message: tool.requiredScopes.length ? `Scopes granted: ${tool.requiredScopes.join(", ")}.` : "No scopes required." };
    },
  },
  {
    id: "connection_class_ceiling",
    evaluate: ({ tool, caller }) =>
      classRank(tool.executionClass) > classRank(caller.maxExecutionClass)
        ? {
            effect: "deny",
            code: "execution_class_not_permitted",
            message: `This connection is limited to ${caller.maxExecutionClass.toUpperCase()}; ${tool.name} is ${tool.executionClass.toUpperCase()}.`,
          }
        : null,
  },
  {
    id: "member_role",
    evaluate: ({ tool, caller }) =>
      classRank(tool.executionClass) > classRank(ROLE_CEILING[caller.role])
        ? {
            effect: "deny",
            code: "role_not_permitted",
            message: `The ${caller.role} role cannot authorize ${tool.executionClass.toUpperCase()} actions.`,
          }
        : null,
  },
  {
    id: "production_execute_guard",
    evaluate: ({ tool, caller, settings }) =>
      caller.environment === "production" && tool.executionClass === "execute" && !settings.production_execute_enabled
        ? {
            effect: "deny",
            code: "production_execute_disabled",
            message: "EXECUTE actions are disabled in production for this organization. An administrator can enable them in Settings.",
          }
        : null,
  },
  {
    id: "transaction_limit",
    evaluate: ({ caller, settings, amountCents }) => {
      if (amountCents == null) return null;
      const limits = [caller.transactionLimitCents, settings.max_transaction_amount_cents].filter((v): v is number => v !== null);
      const limit = limits.length ? Math.min(...limits) : null;
      return limit !== null && amountCents > limit
        ? { effect: "deny", code: "transaction_limit_exceeded", message: `The action amount exceeds the configured limit of $${(limit / 100).toLocaleString("en-US")}.` }
        : null;
    },
  },
  {
    id: "approval",
    evaluate: ({ tool }) =>
      tool.approvalRequired || tool.executionClass === "execute"
        ? { effect: "require_approval", message: "EXECUTE actions require explicit human approval." }
        : null,
  },
];

export function evaluatePolicy(input: PolicyInput): PolicyResult {
  const reasons: PolicyReason[] = [];
  let missingScopes: Scope[] = [];
  let code: string | null = null;
  for (const rule of RULES) {
    const result = rule.evaluate(input);
    if (!result) continue;
    reasons.push({ rule: rule.id, effect: result.effect, message: result.message });
    if (result.missing) missingScopes = result.missing;
    if (result.effect === "deny" && !code) code = result.code ?? rule.id;
  }
  const decision: PolicyDecision = reasons.some((r) => r.effect === "deny")
    ? "denied"
    : reasons.some((r) => r.effect === "require_approval")
      ? "approval_required"
      : "allowed";
  return { decision, reasons, missingScopes, code };
}

/** Tools a caller can invoke with its current grant (ignoring approval, which is procedural). */
export function isToolAvailable(tool: AnyTool, caller: Caller, settings: OrganizationSettingsRow, now: Date): { ok: boolean; missingScopes: Scope[] } {
  const result = evaluatePolicy({ tool, caller, settings, now });
  return { ok: result.decision !== "denied", missingScopes: result.missingScopes };
}

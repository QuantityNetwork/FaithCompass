/** Status of a structured MCP tool response. */
export const RESPONSE_STATUSES = [
  "success",
  "partial",
  "needs_input",
  "needs_clarification",
  "approval_required",
  "denied",
  "failed",
  "unavailable",
] as const;
export type ResponseStatus = (typeof RESPONSE_STATUSES)[number];

/** Lifecycle of an approval request. */
export const APPROVAL_STATUSES = ["pending", "approved", "denied", "expired", "completed", "failed"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

/** Outcome of the policy engine for a single call. */
export const POLICY_DECISIONS = ["allowed", "approval_required", "denied"] as const;
export type PolicyDecision = (typeof POLICY_DECISIONS)[number];

export const TOOL_LIFECYCLE = ["active", "deprecated", "retired"] as const;
export type ToolLifecycle = (typeof TOOL_LIFECYCLE)[number];

export function isFailureStatus(status: ResponseStatus): boolean {
  return status === "denied" || status === "failed" || status === "unavailable";
}

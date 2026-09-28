import type { Environment } from "@/domain/environments";
import type { ExecutionClass } from "@/domain/execution-classes";
import type { ApprovalStatus, PolicyDecision, ResponseStatus } from "@/domain/statuses";
import type { Scope } from "@/domain/scopes";
import type { ClarificationOption, ToolWarning } from "@/server/tools/types";

/**
 * The structured response returned for every tool call, whatever the outcome.
 * Machine-readable first; `summary` / `message` carry the human-readable text.
 */
export interface ToolEnvelope {
  status: ResponseStatus;
  tool: string;
  version: string | null;
  environment: Environment;
  request_id: string;
  audit_id: string;
  summary?: string;
  message?: string;
  data?: unknown;
  warnings: ToolWarning[];
  requires_approval: boolean;
  approval?: {
    approval_id: string;
    status: ApprovalStatus;
    summary: string;
    expires_at: string;
    review_url: string;
    next_step: string;
  };
  missing_fields?: string[];
  invalid_fields?: { field: string; message: string }[];
  clarification?: { field?: string; options?: ClarificationOption[] };
  policy?: { decision: PolicyDecision; missing_scopes?: Scope[] };
  error?: { code: string; message: string; retryable: boolean; retry_after_seconds?: number };
  replayed?: boolean;
  meta: {
    execution_class: ExecutionClass | null;
    state_changed: boolean;
    duration_ms: number;
    idempotency_key?: string;
  };
}

export function isErrorEnvelope(envelope: ToolEnvelope): boolean {
  return envelope.status === "denied" || envelope.status === "failed" || envelope.status === "unavailable";
}

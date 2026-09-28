import type { McpApprovalRow, MemberRole, OrganizationSettingsRow } from "@/domain/entities";
import { classRank } from "@/domain/execution-classes";
import { SCOPE_DEFINITIONS } from "@/domain/scopes";
import type { ApprovalStatus } from "@/domain/statuses";
import type { GatewayStore } from "@/server/store/types";
import { majorVersion } from "@/server/tools/describe";
import type { AnyTool, ApprovalPlan } from "@/server/tools/types";
import type { Caller } from "./caller";
import type { ToolEnvelope } from "./envelope";
import { ROLE_CEILING } from "./policy";

export function approvalReviewUrl(publicUrl: string, approvalId: string): string {
  return `${publicUrl}/approvals/${approvalId}`;
}

export function isApprovalForCaller(approval: McpApprovalRow, caller: Caller): boolean {
  if (approval.environment !== caller.environment || approval.organization_id !== caller.organizationId) return false;
  return caller.client.connectionId
    ? approval.connection_id === caller.client.connectionId
    : approval.connection_id === null && approval.user_id === caller.userId;
}

/** Pending approvals past their expiry are reported (and persisted) as expired. */
export async function refreshExpiry(store: GatewayStore, approval: McpApprovalRow, now: Date): Promise<McpApprovalRow> {
  if (approval.status !== "pending" || approval.expires_at > now.toISOString()) return approval;
  const updated = await store.transitionApproval(approval.organization_id, approval.id, ["pending"], {
    status: "expired",
    updated_at: now.toISOString(),
  });
  return updated ?? { ...approval, status: "expired" };
}

/** Reuse an open request for the identical call so looping agents cannot flood the user with approvals. */
export async function findOpenApproval(store: GatewayStore, caller: Caller, tool: AnyTool, fingerprint: string, now: Date): Promise<McpApprovalRow | null> {
  const pending = await store.listApprovals(caller.organizationId, { environment: caller.environment, status: ["pending"], limit: 100 });
  const match = pending.find(
    (a) => a.fingerprint === fingerprint && a.tool_name === tool.name && isApprovalForCaller(a, caller) && a.expires_at > now.toISOString(),
  );
  return match ?? null;
}

export function buildApprovalRow(args: {
  id: string;
  caller: Caller;
  tool: AnyTool;
  toolArguments: Record<string, unknown>;
  fingerprint: string;
  plan: ApprovalPlan;
  settings: OrganizationSettingsRow;
  now: Date;
}): McpApprovalRow {
  const { caller, tool, plan, now } = args;
  const iso = now.toISOString();
  return {
    id: args.id,
    organization_id: caller.organizationId,
    environment: caller.environment,
    connection_id: caller.client.connectionId,
    user_id: caller.userId,
    client_name: caller.client.name,
    tool_name: tool.name,
    tool_version: majorVersion(tool),
    execution_class: tool.executionClass,
    arguments: args.toolArguments,
    fingerprint: args.fingerprint,
    // Specific language: who is asking, to do exactly what, to which asset.
    summary: `${caller.client.name} is requesting permission to ${plan.action}.`,
    details: {
      ...plan.details,
      permissions: tool.requiredScopes.map((scope) => ({ scope, description: SCOPE_DEFINITIONS[scope].description })),
    },
    status: "pending",
    expires_at: new Date(now.getTime() + args.settings.approval_ttl_minutes * 60_000).toISOString(),
    decided_by: null,
    decided_at: null,
    decision_note: null,
    consumed_at: null,
    result: null,
    created_at: iso,
    updated_at: iso,
  };
}

export function approvalEnvelopePart(approval: McpApprovalRow, publicUrl: string): NonNullable<ToolEnvelope["approval"]> {
  const next: Record<ApprovalStatus, string> = {
    pending: `Ask the user to review and approve this request in Sagolik (${approvalReviewUrl(publicUrl, approval.id)}). After they approve, call ${approval.tool_name} again with the same arguments plus approval_id "${approval.id}". Do not retry before the user confirms.`,
    approved: `Approved. Call ${approval.tool_name} again with the same arguments plus approval_id "${approval.id}".`,
    denied: "The user denied this request. Do not retry it.",
    expired: "The approval expired. Call the tool again without approval_id to request a new approval if the user still wants this.",
    completed: "Already executed. The original result is returned.",
    failed: "Execution failed after approval. A new approval is required to retry.",
  };
  return {
    approval_id: approval.id,
    status: approval.status,
    summary: approval.summary,
    expires_at: approval.expires_at,
    review_url: approvalReviewUrl(publicUrl, approval.id),
    next_step: next[approval.status],
  };
}

export function canDecideApproval(role: MemberRole, approval: McpApprovalRow): boolean {
  return classRank(approval.execution_class) <= classRank(ROLE_CEILING[role]);
}

export type DecisionResult =
  | { ok: true; approval: McpApprovalRow }
  | { ok: false; code: "not_found" | "forbidden" | "not_pending" | "expired"; message: string };

/**
 * Record a human decision. Authorization is checked against the deciding
 * member's role; the transition is compare-and-set so a request can only be
 * decided once.
 */
export async function decideApproval(
  store: GatewayStore,
  input: { organizationId: string; approvalId: string; userId: string; role: MemberRole; decision: "approve" | "deny"; note?: string | null; now: Date },
): Promise<DecisionResult> {
  const current = await store.getApproval(input.organizationId, input.approvalId);
  if (!current) return { ok: false, code: "not_found", message: "Approval request not found." };
  if (!canDecideApproval(input.role, current)) {
    return { ok: false, code: "forbidden", message: `The ${input.role} role cannot approve ${current.execution_class.toUpperCase()} actions.` };
  }
  const fresh = await refreshExpiry(store, current, input.now);
  if (fresh.status === "expired") return { ok: false, code: "expired", message: "This request has expired." };
  if (fresh.status !== "pending") return { ok: false, code: "not_pending", message: `This request is already ${fresh.status}.` };
  const iso = input.now.toISOString();
  const updated = await store.transitionApproval(input.organizationId, input.approvalId, ["pending"], {
    status: input.decision === "approve" ? "approved" : "denied",
    decided_by: input.userId,
    decided_at: iso,
    decision_note: input.note?.trim() ? input.note.trim().slice(0, 500) : null,
    updated_at: iso,
  });
  if (!updated) return { ok: false, code: "not_pending", message: "This request was decided concurrently." };
  return { ok: true, approval: updated };
}


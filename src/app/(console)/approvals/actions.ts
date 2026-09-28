"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { requireConsoleSession } from "@/server/auth/console";
import { decideApproval } from "@/server/gateway/approvals";
import { getRuntime, publicUrlFrom } from "@/server/runtime";

/**
 * Record a human decision. The deciding member's role is checked against the
 * action's execution class; approving does not execute anything — the agent
 * must call the tool again with the approval id.
 */
export async function decideApprovalAction(input: { approvalId: string; decision: "approve" | "deny"; note?: string }): Promise<{ ok: boolean; error?: string }> {
  const session = await requireConsoleSession();
  if (input.decision !== "approve" && input.decision !== "deny") return { ok: false, error: "Invalid decision." };
  const runtime = getRuntime();
  const result = await decideApproval(runtime.store, {
    organizationId: session.organization.id,
    approvalId: input.approvalId,
    userId: session.user.id,
    role: session.role,
    decision: input.decision,
    note: input.note ?? null,
    now: new Date(),
  });
  if (!result.ok) return { ok: false, error: result.message };
  const deps = runtime.gateway(publicUrlFrom({ headers: await headers() }));
  deps.defer(() =>
    runtime.webhooks.publish({ organizationId: result.approval.organization_id, environment: result.approval.environment }, "approval.completed", {
      approval_id: result.approval.id,
      tool: result.approval.tool_name,
      status: result.approval.status,
      decided_at: result.approval.decided_at,
    }),
  );
  refresh();
  return { ok: true };
}

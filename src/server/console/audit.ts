import "server-only";
import { isEnvironment } from "@/domain/environments";
import { isExecutionClass } from "@/domain/execution-classes";
import { APPROVAL_STATUSES, type ApprovalStatus } from "@/domain/statuses";
import type { ConsoleSession } from "@/server/auth/console";
import type { AuditFilter } from "@/server/store/types";

export type SearchParams = Record<string, string | string[] | undefined>;

const str = (v: string | string[] | undefined) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** Translate URL search params into a store filter. Organization scope always comes from the session. */
export function auditFilterFrom(params: SearchParams, session: ConsoleSession): AuditFilter & { environmentParam: string } {
  const envParam = str(params.env) ?? session.environment;
  const client = str(params.client);
  const approval = str(params.approval);
  const from = str(params.from);
  const to = str(params.to);
  const before = str(params.before);
  return {
    environmentParam: envParam,
    environment: isEnvironment(envParam) ? envParam : undefined,
    connectionId: str(params.connection) ?? (client && client !== "console" ? client : undefined),
    clientType: client === "console" ? "console" : undefined,
    toolName: str(params.tool),
    executionClass: isExecutionClass(str(params.class)) ? (str(params.class) as AuditFilter["executionClass"]) : undefined,
    outcome: params.outcome === "success" || params.outcome === "failure" ? params.outcome : undefined,
    approvalStatus: approval && (APPROVAL_STATUSES as readonly string[]).includes(approval) ? (approval as ApprovalStatus) : undefined,
    from: from ? `${from}T00:00:00.000Z` : undefined,
    to: to ? `${to}T23:59:59.999Z` : undefined,
    beforeSequence: before && /^\d+$/.test(before) ? Number(before) : undefined,
  };
}

import Link from "next/link";
import type { McpAuditLogRow } from "@/domain/entities";
import { ClientMonogram, EnvironmentBadge, ExecutionClassBadge, StatusBadge } from "@/components/mcp/badges";
import { relativeTime } from "@/lib/format";

/** Human-readable effect of a recorded call. */
export function effectText(record: Pick<McpAuditLogRow, "environment" | "state_changed" | "status">): string {
  if (record.status === "approval_required") return "Awaiting human approval. Nothing was executed.";
  if (record.environment === "sandbox") return record.state_changed ? "Sandbox records changed. No production changes made." : "No production changes made.";
  return record.state_changed ? "Production records changed." : "No records changed.";
}

export function AuditLine({ record, now, compact }: { record: McpAuditLogRow; now: Date; compact?: boolean }) {
  return (
    <Link href={`/audit/${record.id}`} className="group flex items-start gap-3.5 px-5 py-3.5 transition-colors hover:bg-surface">
      <ClientMonogram type={record.client_type} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] text-body">
          <span className="font-semibold text-fg">{record.client_name}</span> <span className="text-muted">used</span>{" "}
          <span className="font-mono text-[12.5px] text-fg">{record.tool_name}</span>
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {!compact && <EnvironmentBadge value={record.environment} />}
          <ExecutionClassBadge value={record.execution_class} />
          <StatusBadge value={record.status} />
          <span className="text-[12px] text-subtle">{effectText(record)}</span>
        </div>
      </div>
      <time className="shrink-0 text-[12px] text-subtle" dateTime={record.created_at} title={record.created_at}>
        {relativeTime(record.created_at, now)}
      </time>
    </Link>
  );
}

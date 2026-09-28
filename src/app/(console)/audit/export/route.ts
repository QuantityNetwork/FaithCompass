import { requireConsoleSession } from "@/server/auth/console";
import { auditFilterFrom } from "@/server/console/audit";
import { getRuntime } from "@/server/runtime";

export const dynamic = "force-dynamic";

const COLUMNS = [
  "sequence", "created_at", "environment", "client_name", "client_type", "connection_id", "user_id", "tool_name", "tool_version", "execution_class",
  "status", "error_code", "policy_decision", "approval_id", "approval_status", "state_changed", "duration_ms", "providers_touched", "scopes_used",
  "arguments_hash", "request_id", "record_hash", "prev_hash",
] as const;

function csvCell(value: unknown): string {
  const text = Array.isArray(value) ? value.join(" ") : value === null || value === undefined ? "" : String(value);
  // Neutralize spreadsheet formula injection and quote every cell.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const session = await requireConsoleSession();
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const filter = auditFilterFrom(params, session);
  const records = await getRuntime().store.listAudit(session.organization.id, { ...filter, beforeSequence: undefined, limit: 5000 });
  const lines = [COLUMNS.join(","), ...records.map((r) => COLUMNS.map((c) => csvCell(r[c])).join(","))];
  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sagolik-mcp-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

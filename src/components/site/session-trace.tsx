import { ExecutionClassBadge } from "@/components/mcp/badges";

const RESPONSE = `{
  "status": "success",
  "tool": "get_closing_status",
  "version": "1.0",
  "environment": "sandbox",
  "data": {
    "closing_date": "2026-10-26",
    "days_to_closing": 28,
    "overall_status": "blocked",
    "progress": { "completed": 4, "total": 11 },
    "open_blockers": { "total": 4, "high": 2 }
  },
  "requires_approval": false,
  "audit_id": "7f3c…a91e"
}`;

/** A representative sandbox session: one READ call through the gateway. */
export function SessionTrace() {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-canvas shadow-[var(--shadow-pop)]">
      <div className="flex items-center justify-between border-b border-line bg-surface px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-sandbox" aria-hidden />
          <span className="text-[12px] font-medium text-muted">Session trace · Sandbox · synthetic data</span>
        </div>
        <span className="font-mono text-[11.5px] text-subtle">POST /sandbox/mcp</span>
      </div>
      <div className="grid md:grid-cols-[1fr_1.05fr]">
        <ol className="space-y-4 border-b border-line px-5 py-5 md:border-b-0 md:border-r">
          <li>
            <p className="eyebrow">Claude</p>
            <p className="mt-1.5 text-[13.5px] leading-snug text-fg">“Use Sagolik to tell me what remains before this property can close.”</p>
          </li>
          <li className="flex items-center gap-2">
            <span className="font-mono text-[12.5px] text-fg">tools/call → get_closing_status</span>
            <ExecutionClassBadge value="read" />
          </li>
          <li>
            <ul className="space-y-1.5 text-[12.5px]">
              {[
                ["Authentication", "Bearer token · sandbox · connection active"],
                ["Authorization", "closing.read granted · role owner"],
                ["Policy", "Allowed · READ requires no approval"],
                ["Execution", "Transaction data retrieved · no write"],
                ["Audit", "Record appended to hash chain"],
              ].map(([k, v]) => (
                <li key={k} className="flex gap-3">
                  <span className="w-[92px] shrink-0 text-muted">{k}</span>
                  <span className="text-fg">{v}</span>
                </li>
              ))}
            </ul>
          </li>
          <li className="rounded-md bg-surface-2 px-3 py-2 text-[12.5px] text-muted">Claude summarizes blockers: insurance binder, bank statements, HOA estoppel, seller affidavit.</li>
        </ol>
        <pre className="overflow-x-auto bg-[#071427] px-5 py-5 text-[12px] leading-[1.7] text-[#dbe6f5]">
          <code>{RESPONSE}</code>
        </pre>
      </div>
    </div>
  );
}

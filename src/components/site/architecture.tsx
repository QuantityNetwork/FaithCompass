import { SagolikMark } from "@/components/brand/logo";

function Connector() {
  return (
    <div className="grid gap-4 py-1 md:grid-cols-[160px_1fr]" aria-hidden>
      <span className="hidden md:block" />
      <div className="flex flex-col items-center">
        <span className="h-7 w-px bg-line-strong" />
        <svg width="9" height="6" viewBox="0 0 9 6" className="text-line-strong">
          <path d="M0.5 0.5L4.5 5L8.5 0.5" fill="none" stroke="currentColor" />
        </svg>
      </div>
    </div>
  );
}

function Row({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="grid items-center gap-4 md:grid-cols-[160px_1fr]">
      <p className="eyebrow md:text-right">{label}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {items.map((item) => (
          <span key={item} className="rounded-md border border-line bg-canvas px-3.5 py-2 text-[13px] text-fg shadow-[0_1px_0_rgb(10_22_40/0.03)]">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

/** The request path from agent to infrastructure, drawn with hairlines. */
export function ArchitectureDiagram() {
  return (
    <div className="mx-auto max-w-4xl rounded-xl border border-line bg-surface px-6 py-10">
      <Row label="AI clients" items={["Claude", "ChatGPT", "Cursor", "Enterprise agent"]} />
      <Connector />
      <div className="grid items-center gap-4 md:grid-cols-[160px_1fr]">
        <p className="eyebrow md:text-right">Gateway</p>
        <div className="mx-auto flex w-full max-w-md items-center justify-center gap-3 rounded-lg bg-brand px-5 py-3.5 text-white">
          <SagolikMark className="h-5 text-white" />
          <span className="text-[14px] font-semibold tracking-tight">Sagolik MCP</span>
          <span className="text-[12px] text-white/60">authentication · tool registry</span>
        </div>
      </div>
      <Connector />
      <div className="grid items-center gap-4 md:grid-cols-[160px_1fr]">
        <p className="eyebrow md:text-right">Control</p>
        <div className="mx-auto w-full max-w-md rounded-lg border border-brand/25 bg-brand-soft px-5 py-3 text-center">
          <p className="text-[13.5px] font-semibold text-brand">Policy + Permissions</p>
          <p className="mt-0.5 text-[12px] text-muted">scopes · roles · approvals · limits · audit</p>
        </div>
      </div>
      <Connector />
      <Row label="Execution" items={["Sagolik services"]} />
      <Connector />
      <Row label="Infrastructure" items={["Financial institutions", "Property infrastructure", "Closing providers", "Documents", "Ownership systems"]} />
    </div>
  );
}

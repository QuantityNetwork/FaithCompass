import type { ExecutionClass } from "@/domain/execution-classes";
import { ExecutionClassBadge } from "@/components/mcp/badges";
import { cn } from "@/lib/cn";

export interface WorkflowStep {
  title: string;
  detail?: string;
  cls?: ExecutionClass;
  kind?: "agent" | "sagolik" | "human" | "note";
}

export function WorkflowSequence({ title, prompt, steps, footnote }: { title: string; prompt: string; steps: WorkflowStep[]; footnote: string }) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-line bg-canvas">
      <div className="border-b border-line px-6 py-5">
        <p className="eyebrow">{title}</p>
        <p className="mt-2 text-[15px] leading-snug text-fg">“{prompt}”</p>
      </div>
      <ol className="flex-1 px-6 py-5">
        {steps.map((s, i) => (
          <li key={i} className="relative flex gap-4 pb-4 last:pb-0">
            {i < steps.length - 1 && <span className="absolute left-[5px] top-4 h-full w-px bg-line" aria-hidden />}
            <span
              className={cn(
                "relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full border-2",
                s.kind === "human" ? "border-prepare bg-prepare-soft" : s.kind === "agent" ? "border-fg bg-canvas" : s.kind === "note" ? "border-line-strong bg-surface-2" : "border-brand bg-brand",
              )}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("text-[13.5px]", s.kind === "note" ? "text-muted" : "font-medium text-fg", s.cls && "font-mono text-[13px]")}>{s.title}</span>
                {s.cls && <ExecutionClassBadge value={s.cls} />}
              </div>
              {s.detail && <p className="mt-0.5 text-[12.5px] text-muted">{s.detail}</p>}
            </div>
          </li>
        ))}
      </ol>
      <div className="border-t border-line bg-surface px-6 py-3.5 text-[12.5px] text-muted">{footnote}</div>
    </div>
  );
}

import { SCOPE_DEFINITIONS, type Scope } from "@/domain/scopes";
import { cn } from "@/lib/cn";

const CLASS_TONE = {
  read: "border-line text-body bg-surface",
  simulate: "border-simulate/20 text-simulate bg-simulate-soft",
  prepare: "border-prepare/20 text-prepare bg-prepare-soft",
  execute: "border-execute/20 text-execute bg-execute-soft",
} as const;

export function ScopeChips({ scopes, max }: { scopes: Scope[]; max?: number }) {
  const shown = max ? scopes.slice(0, max) : scopes;
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((s) => (
        <span key={s} title={SCOPE_DEFINITIONS[s].description} className={cn("rounded-[5px] border px-1.5 py-0.5 text-[11.5px]", CLASS_TONE[SCOPE_DEFINITIONS[s].executionClass])}>
          {SCOPE_DEFINITIONS[s].label}
        </span>
      ))}
      {max && scopes.length > max && <span className="px-1 py-0.5 text-[11.5px] text-subtle">+{scopes.length - max} more</span>}
    </div>
  );
}

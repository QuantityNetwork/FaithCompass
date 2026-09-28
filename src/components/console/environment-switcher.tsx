"use client";

import { useTransition } from "react";
import type { Environment } from "@/domain/environments";
import { cn } from "@/lib/cn";
import { setEnvironmentAction } from "@/app/(console)/actions";

export function EnvironmentSwitcher({ value }: { value: Environment }) {
  const [pending, start] = useTransition();
  const options: { value: Environment; label: string }[] = [
    { value: "sandbox", label: "Sandbox" },
    { value: "production", label: "Production" },
  ];
  return (
    <div role="radiogroup" aria-label="Environment" className={cn("inline-flex h-8 items-center rounded-lg bg-surface-2 p-0.5", pending && "opacity-70")}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={pending}
            onClick={() => !active && start(() => setEnvironmentAction(o.value))}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-md px-3 text-[12.5px] font-medium transition-all",
              active ? "bg-canvas text-fg shadow-[0_1px_2px_rgb(10_22_40/0.08),0_0_0_1px_rgb(10_22_40/0.05)]" : "text-muted hover:text-fg",
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", o.value === "sandbox" ? "bg-sandbox" : "bg-brand", !active && "opacity-40")} aria-hidden />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

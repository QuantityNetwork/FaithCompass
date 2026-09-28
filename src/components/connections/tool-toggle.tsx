"use client";

import { useTransition } from "react";
import { setToolEnabledAction } from "@/app/(console)/connections/actions";
import { cn } from "@/lib/cn";

export function ToolToggle({ connectionId, toolName, enabled, disabled }: { connectionId: string; toolName: string; enabled: boolean; disabled?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={`${enabled ? "Disable" : "Enable"} ${toolName} for this connection`}
      disabled={disabled || pending}
      onClick={() => start(async () => void (await setToolEnabledAction(connectionId, toolName, !enabled)))}
      className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-40", enabled ? "bg-brand" : "bg-line-strong")}
    >
      <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", enabled ? "left-[18px]" : "left-0.5")} />
    </button>
  );
}

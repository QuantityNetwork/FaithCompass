"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

export function CopyButton({ value, label = "Copy", className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      className={cn("inline-flex h-7 items-center rounded-md border border-line px-2.5 text-[12px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg", className)}
      aria-live="polite"
    >
      {copied ? "Copied" : label}
    </button>
  );
}

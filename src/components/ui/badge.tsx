import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "read" | "simulate" | "prepare" | "execute" | "sandbox";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted border-line",
  brand: "bg-brand-soft text-brand border-brand/15",
  success: "bg-success-soft text-success border-success/20",
  warning: "bg-warning-soft text-warning border-warning/20",
  danger: "bg-danger-soft text-danger border-danger/20",
  info: "bg-info-soft text-info border-info/20",
  read: "bg-read-soft text-read border-read/15",
  simulate: "bg-simulate-soft text-simulate border-simulate/20",
  prepare: "bg-prepare-soft text-prepare border-prepare/20",
  execute: "bg-execute-soft text-execute border-execute/20",
  sandbox: "bg-sandbox-soft text-sandbox border-sandbox/25",
};

export function Badge({ tone = "neutral", children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex h-[22px] items-center gap-1.5 rounded-[5px] border px-2 text-[11.5px] font-medium tracking-[0.01em] whitespace-nowrap", tones[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden />}
      {children}
    </span>
  );
}

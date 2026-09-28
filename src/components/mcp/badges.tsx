import type { ClientType } from "@/domain/clients";
import { CLIENT_META } from "@/domain/clients";
import type { Environment } from "@/domain/environments";
import { EXECUTION_CLASS_META, type ExecutionClass } from "@/domain/execution-classes";
import type { ApprovalStatus, ResponseStatus } from "@/domain/statuses";
import { Badge, type Tone } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

export function ExecutionClassBadge({ value, className }: { value: ExecutionClass | null; className?: string }) {
  if (!value) return <Badge className={className}>—</Badge>;
  return (
    <Badge tone={value} className={cn("font-mono uppercase tracking-[0.06em] text-[10.5px]", className)}>
      {EXECUTION_CLASS_META[value].label}
    </Badge>
  );
}

const STATUS_TONE: Record<ResponseStatus, Tone> = {
  success: "success",
  partial: "info",
  needs_input: "warning",
  needs_clarification: "warning",
  approval_required: "prepare",
  denied: "danger",
  failed: "danger",
  unavailable: "neutral",
};

const STATUS_LABEL: Record<ResponseStatus, string> = {
  success: "Success",
  partial: "Partial",
  needs_input: "Needs input",
  needs_clarification: "Needs clarification",
  approval_required: "Approval required",
  denied: "Denied",
  failed: "Failed",
  unavailable: "Unavailable",
};

export function StatusBadge({ value }: { value: ResponseStatus }) {
  return (
    <Badge tone={STATUS_TONE[value]} dot>
      {STATUS_LABEL[value]}
    </Badge>
  );
}

const APPROVAL_TONE: Record<ApprovalStatus, Tone> = {
  pending: "prepare",
  approved: "info",
  denied: "danger",
  expired: "neutral",
  completed: "success",
  failed: "danger",
};

export function ApprovalStatusBadge({ value }: { value: ApprovalStatus }) {
  return (
    <Badge tone={APPROVAL_TONE[value]} dot>
      {value.charAt(0).toUpperCase() + value.slice(1)}
    </Badge>
  );
}

export function EnvironmentBadge({ value }: { value: Environment }) {
  return value === "sandbox" ? (
    <Badge tone="sandbox" dot>
      Sandbox
    </Badge>
  ) : (
    <Badge tone="brand" dot>
      Production
    </Badge>
  );
}

/** Neutral monogram tile for AI clients (no third-party trademarks). */
export function ClientMonogram({ type, size = "md" }: { type: ClientType | "console"; size?: "sm" | "md" | "lg" }) {
  const label = type === "console" ? "Sg" : CLIENT_META[type].monogram;
  const dims = size === "sm" ? "h-7 w-7 text-[11px]" : size === "lg" ? "h-11 w-11 text-[14px]" : "h-9 w-9 text-[12.5px]";
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-[9px] border border-line bg-surface-2 font-semibold tracking-tight text-fg", dims)} aria-hidden>
      {label}
    </span>
  );
}

export function clientLabel(type: ClientType | "console"): string {
  return type === "console" ? "Sagolik Console" : CLIENT_META[type].label;
}

const CLASS_DOT: Record<ExecutionClass, string> = {
  read: "bg-read",
  simulate: "bg-simulate",
  prepare: "bg-prepare",
  execute: "bg-execute",
};

export function ClassDot({ value, className }: { value: ExecutionClass; className?: string }) {
  return <span className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", CLASS_DOT[value], className)} aria-hidden />;
}

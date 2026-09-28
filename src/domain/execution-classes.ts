/**
 * Every tool belongs to exactly one execution class. Classes are ordered:
 * a grant for a higher class never implies automatic authority — each tool
 * still requires its own scopes, and EXECUTE always requires approval.
 */
export const EXECUTION_CLASSES = ["read", "simulate", "prepare", "execute"] as const;
export type ExecutionClass = (typeof EXECUTION_CLASSES)[number];

export const EXECUTION_CLASS_META: Record<
  ExecutionClass,
  { label: string; verb: string; rank: number; summary: string; effect: string }
> = {
  read: {
    label: "Read",
    verb: "Understand",
    rank: 0,
    summary: "Inspect authorized information.",
    effect: "No state is changed.",
  },
  simulate: {
    label: "Simulate",
    verb: "Simulate",
    rank: 1,
    summary: "Calculate or model outcomes without altering records.",
    effect: "No state is changed. Results are estimates.",
  },
  prepare: {
    label: "Prepare",
    verb: "Prepare",
    rank: 2,
    summary: "Assemble a draft action for human review.",
    effect: "Creates a draft inside Sagolik. Nothing is executed.",
  },
  execute: {
    label: "Execute",
    verb: "Execute",
    rank: 3,
    summary: "Create real-world state changes under explicit authorization.",
    effect: "Changes live state. Requires approval and is fully audited.",
  },
};

export function classRank(value: ExecutionClass): number {
  return EXECUTION_CLASS_META[value].rank;
}

export function isExecutionClass(value: unknown): value is ExecutionClass {
  return typeof value === "string" && (EXECUTION_CLASSES as readonly string[]).includes(value);
}

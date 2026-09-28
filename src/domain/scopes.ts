import type { ExecutionClass } from "./execution-classes";

export const SCOPES = [
  "property.read",
  "transaction.read",
  "closing.read",
  "documents.read",
  "finance.read",
  "ownership.read",
  "scenario.run",
  "autopilot.read",
  "closing.prepare",
  "documents.prepare",
  "autopilot.prepare",
  "closing.execute",
  "autopilot.execute",
  "audit.read",
] as const;
export type Scope = (typeof SCOPES)[number];

export interface ScopeDefinition {
  id: Scope;
  label: string;
  description: string;
  executionClass: ExecutionClass;
  /** Sensitive scopes expose financial data and are never pre-selected for new connections. */
  sensitive: boolean;
}

export const SCOPE_DEFINITIONS: Record<Scope, ScopeDefinition> = {
  "property.read": {
    id: "property.read",
    label: "Property read",
    description: "View property records, characteristics and high-level status.",
    executionClass: "read",
    sensitive: false,
  },
  "transaction.read": {
    id: "transaction.read",
    label: "Transaction read",
    description: "View purchase transactions and financing status.",
    executionClass: "read",
    sensitive: false,
  },
  "closing.read": {
    id: "closing.read",
    label: "Closing read",
    description: "View closing milestones, blockers and readiness.",
    executionClass: "read",
    sensitive: false,
  },
  "documents.read": {
    id: "documents.read",
    label: "Documents read",
    description: "View document inventories and statuses. File contents are never exposed to agents.",
    executionClass: "read",
    sensitive: false,
  },
  "finance.read": {
    id: "finance.read",
    label: "Finance read",
    description: "View normalized connected-account information and recurring obligations. Provider credentials are never exposed.",
    executionClass: "read",
    sensitive: true,
  },
  "ownership.read": {
    id: "ownership.read",
    label: "Ownership read",
    description: "View ownership profiles and the property homebook.",
    executionClass: "read",
    sensitive: false,
  },
  "scenario.run": {
    id: "scenario.run",
    label: "Scenario execution",
    description: "Run financing, closing-cost and cash-flow simulations. Simulations never change records.",
    executionClass: "simulate",
    sensitive: false,
  },
  "autopilot.read": {
    id: "autopilot.read",
    label: "Autopilot read",
    description: "View property obligations and Autopilot coverage.",
    executionClass: "read",
    sensitive: false,
  },
  "closing.prepare": {
    id: "closing.prepare",
    label: "Closing prepare",
    description: "Prepare closing checklists for human review.",
    executionClass: "prepare",
    sensitive: false,
  },
  "documents.prepare": {
    id: "documents.prepare",
    label: "Documents prepare",
    description: "Draft requests for missing documents. Drafts are not sent.",
    executionClass: "prepare",
    sensitive: false,
  },
  "autopilot.prepare": {
    id: "autopilot.prepare",
    label: "Autopilot prepare",
    description: "Prepare Autopilot and recurring-payment plans for review. Plans are not activated.",
    executionClass: "prepare",
    sensitive: false,
  },
  "closing.execute": {
    id: "closing.execute",
    label: "Closing execute",
    description: "Submit approved closing actions, such as sending a prepared document request. Always requires approval.",
    executionClass: "execute",
    sensitive: true,
  },
  "autopilot.execute": {
    id: "autopilot.execute",
    label: "Autopilot execute",
    description: "Activate an approved Autopilot plan. Always requires approval.",
    executionClass: "execute",
    sensitive: true,
  },
  "audit.read": {
    id: "audit.read",
    label: "Audit read",
    description: "Read the audit trail of this connection's own activity.",
    executionClass: "read",
    sensitive: false,
  },
};

/** Default grant for new connections: read + simulate, nothing sensitive, nothing that acts. */
export const DEFAULT_SCOPES: Scope[] = [
  "property.read",
  "transaction.read",
  "closing.read",
  "documents.read",
  "ownership.read",
  "scenario.run",
  "autopilot.read",
];

export function isScope(value: unknown): value is Scope {
  return typeof value === "string" && (SCOPES as readonly string[]).includes(value);
}

export function parseScopeString(value: string | null | undefined): Scope[] {
  if (!value) return [];
  const unique = new Set(value.split(/[\s,]+/).filter(isScope));
  return SCOPES.filter((s) => unique.has(s));
}

export function sortScopes(scopes: Iterable<Scope>): Scope[] {
  const set = new Set(scopes);
  return SCOPES.filter((s) => set.has(s));
}

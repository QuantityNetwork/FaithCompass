import type { ToolCategory } from "@/domain/categories";
import type { Environment } from "@/domain/environments";
import type { ExecutionClass } from "@/domain/execution-classes";
import type { Scope } from "@/domain/scopes";
import type { ToolLifecycle } from "@/domain/statuses";
import { activatePropertyAutopilot, getAutopilotStatus, inspectPropertyObligations, preparePropertyAutopilot, prepareRecurringPropertyPayments } from "./autopilot";
import { analyzePropertyCashflow, detectRecurringPropertyObligations, getConnectedAccounts, getUpcomingPropertyObligations } from "./cashflow";
import { getClosingStatus, identifyClosingBlockers, prepareClosingChecklist, verifyFundsReadiness } from "./closing";
import { composeToolDescription, inputJsonSchema, majorVersion, outputJsonSchema } from "./describe";
import { getDocumentStatus, listTransactionDocuments, prepareDocumentRequest, retrieveRequiredDocuments, submitDocumentRequest } from "./documents";
import { calculateCashToClose, compareFinancingScenarios, getFinancingStatus } from "./financing";
import { getApprovalStatus, getAuthorizationContext, getIntegrationStatus } from "./governance";
import { getOwnershipProfile, getPropertyHomebook } from "./ownership";
import { analyzePropertyPurchase, getProperty, searchProperties } from "./property";
import type { AnyTool, ToolChange, ToolDescription } from "./types";

/**
 * The central tool registry. Every tool Sagolik MCP exposes is declared here;
 * nothing outside this list can be invoked through the gateway.
 * Future modules (Wallet, ID, Scan, Cover, Pay, Auctions) register their tools
 * here and inherit the same authentication, policy, approval and audit layers.
 */
export const TOOLS: readonly AnyTool[] = [
  // Property
  searchProperties,
  getProperty,
  analyzePropertyPurchase,
  // Financing
  getFinancingStatus,
  compareFinancingScenarios,
  calculateCashToClose,
  // Closing
  getClosingStatus,
  identifyClosingBlockers,
  prepareClosingChecklist,
  verifyFundsReadiness,
  // Documents
  listTransactionDocuments,
  getDocumentStatus,
  retrieveRequiredDocuments,
  prepareDocumentRequest,
  submitDocumentRequest,
  // Cash flow
  getConnectedAccounts,
  analyzePropertyCashflow,
  detectRecurringPropertyObligations,
  getUpcomingPropertyObligations,
  // Autopilot
  inspectPropertyObligations,
  preparePropertyAutopilot,
  prepareRecurringPropertyPayments,
  activatePropertyAutopilot,
  getAutopilotStatus,
  // Ownership
  getOwnershipProfile,
  getPropertyHomebook,
  // Identity, Administration, Integrations
  getAuthorizationContext,
  getApprovalStatus,
  getIntegrationStatus,
];

const byKey = new Map<string, AnyTool>();
for (const tool of TOOLS) {
  const key = `${tool.name}@${majorVersion(tool)}`;
  if (byKey.has(key)) throw new Error(`Duplicate tool registration: ${key}`);
  byKey.set(key, tool);
}

export function toolId(tool: AnyTool): string {
  return `${tool.name}@${majorVersion(tool)}`;
}

/**
 * Resolve a tool by name and optional major version. Without a version the
 * latest non-retired major is returned. Retired tools resolve so the gateway
 * can return a structured "retired" denial rather than "unknown tool".
 */
export function resolveTool(name: string, major?: number): AnyTool | null {
  if (major !== undefined) return byKey.get(`${name}@${major}`) ?? null;
  const candidates = TOOLS.filter((t) => t.name === name).sort((a, b) => majorVersion(b) - majorVersion(a));
  return candidates.find((t) => t.status !== "retired") ?? candidates[0] ?? null;
}

export function listTools(filter: { environment?: Environment; includeRetired?: boolean } = {}): AnyTool[] {
  return TOOLS.filter(
    (t) => (filter.includeRetired || t.status !== "retired") && (!filter.environment || t.environments.includes(filter.environment)),
  );
}

/** Serializable registry record, as exposed to the console, documentation and the mcp_tools table. */
export interface ToolRecord {
  tool_id: string;
  name: string;
  display_name: string;
  description: string;
  structured_description: ToolDescription;
  category: ToolCategory;
  execution_class: ExecutionClass;
  version: string;
  status: ToolLifecycle;
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  required_scopes: Scope[];
  approval_required: boolean;
  environments: Environment[];
  rate_limit_per_minute: number;
  timeout_ms: number;
  idempotency: "none" | "key" | "approval";
  idempotency_required: boolean;
  owner: string;
  providers: string[];
  created_at: string;
  updated_at: string;
  changelog: ToolChange[];
}

export function toToolRecord(tool: AnyTool): ToolRecord {
  return {
    tool_id: toolId(tool),
    name: tool.name,
    display_name: tool.title,
    description: composeToolDescription(tool),
    structured_description: tool.description,
    category: tool.category,
    execution_class: tool.executionClass,
    version: tool.version,
    status: tool.status,
    input_schema: inputJsonSchema(tool),
    output_schema: outputJsonSchema(tool),
    required_scopes: tool.requiredScopes,
    approval_required: tool.approvalRequired,
    environments: tool.environments,
    rate_limit_per_minute: tool.rateLimitPerMinute,
    timeout_ms: tool.timeoutMs,
    idempotency: tool.idempotency,
    idempotency_required: tool.idempotency !== "none",
    owner: tool.owner,
    providers: tool.providers,
    created_at: tool.createdAt,
    updated_at: tool.updatedAt,
    changelog: tool.changelog,
  };
}

let recordsCache: ToolRecord[] | null = null;
export function toolRecords(): ToolRecord[] {
  recordsCache ??= TOOLS.map(toToolRecord);
  return recordsCache;
}

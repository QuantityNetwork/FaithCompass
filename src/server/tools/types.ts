import type { z } from "zod";
import type { ToolCategory } from "@/domain/categories";
import type { ClientType } from "@/domain/clients";
import type {
  ApprovalDetails,
  ISODate,
  McpApprovalRow,
  MemberRole,
  OrganizationKind,
  WebhookEventType,
} from "@/domain/entities";
import type { Environment } from "@/domain/environments";
import type { ExecutionClass } from "@/domain/execution-classes";
import type { Scope } from "@/domain/scopes";
import type { ToolLifecycle } from "@/domain/statuses";
import type { FinancialDataService } from "@/server/integrations/financial/service";
import type { PaymentInstructionProvider } from "@/server/integrations/payments/types";
import type { ScopedData } from "./scoped-data";

export interface ToolWarning {
  code: string;
  message: string;
}

export interface ClarificationOption {
  value: string;
  label: string;
  description?: string;
}

export interface EmittedEvent {
  type: WebhookEventType;
  payload: Record<string, unknown>;
}

export type ToolOutcome<O> =
  | {
      status: "success" | "partial";
      data: O;
      summary: string;
      warnings?: ToolWarning[];
      /** True when the call created or changed records. */
      stateChanged?: boolean;
      /** Webhook events to publish after the call is audited. */
      events?: EmittedEvent[];
    }
  | { status: "denied"; message: string; missing_scopes: Scope[] }
  | { status: "needs_input"; message: string; missing_fields: string[]; options?: ClarificationOption[] }
  | { status: "needs_clarification"; message: string; field?: string; options?: ClarificationOption[] }
  | { status: "unavailable"; message: string; reason: string };

export type NonSuccessOutcome = Exclude<ToolOutcome<never>, { status: "success" | "partial" }>;

export interface ToolContext {
  environment: Environment;
  organizationId: string;
  now: Date;
  today: ISODate;
  requestId: string;
  principal: { userId: string; role: MemberRole };
  client: { name: string; type: ClientType | "console"; connectionId: string | null };
  scopes: ReadonlySet<Scope>;
  data: ScopedData;
  financial: FinancialDataService;
  payments: PaymentInstructionProvider | null;
  /** Present only when executing a call that a human approved. */
  approval: McpApprovalRow | null;
  authorization: {
    organizationName: string;
    organizationKind: OrganizationKind;
    maxExecutionClass: ExecutionClass;
    sessionExpiresAt: string | null;
    productionExecuteEnabled: boolean;
    approvalTtlMinutes: number;
  };
  /** Tools this caller can and cannot invoke with its current grant. */
  describeAccess(): { available: string[]; unavailable: { name: string; missing_scopes: Scope[] }[] };
  approvals: {
    /** Approvals requested by this caller, scoped to organization and environment. */
    get(id: string): Promise<McpApprovalRow | null>;
    listPending(): Promise<McpApprovalRow[]>;
  };
  /** Record that an external provider was touched (for the audit trail). */
  touchProvider(providerId: string): void;
  newId(): string;
}

export interface ToolDescription {
  summary: string;
  whenToUse: string[];
  whenNotToUse: string[];
  requiredContext: string[];
  effect: string;
  limitations?: string[];
  example: { request: string; arguments: Record<string, unknown> };
}

/** What a human is asked to approve. The gateway adds the client name and permissions. */
export interface ApprovalPlan {
  /** Verb phrase, e.g. "activate Sagolik Autopilot for Property #SGK-1042 (245 Mercer Avenue, Austin, TX)". */
  action: string;
  details: Omit<ApprovalDetails, "permissions">;
  /** Monetary exposure used for transaction limits, in cents per occurrence. */
  amountCents: number | null;
}

export interface ToolChange {
  version: string;
  date: string;
  notes: string;
}

/** Static metadata of a tool. Schemas are the single source of truth for input and output types. */
export interface ToolMeta<I extends z.ZodObject = z.ZodObject, O extends z.ZodType = z.ZodType> {
  name: string;
  title: string;
  /** Semantic version. The major version is the compatibility contract. */
  version: string;
  status: ToolLifecycle;
  category: ToolCategory;
  executionClass: ExecutionClass;
  description: ToolDescription;
  input: I;
  output: O;
  requiredScopes: Scope[];
  approvalRequired: boolean;
  environments: Environment[];
  rateLimitPerMinute: number;
  timeoutMs: number;
  /** "key": accepts idempotency_key (auto-derived when omitted). "approval": the approval id is single-use. */
  idempotency: "none" | "key" | "approval";
  owner: string;
  /** External provider kinds this tool may touch. */
  providers: string[];
  createdAt: string;
  updatedAt: string;
  changelog: ToolChange[];
}

export interface ToolImplementation<I extends z.ZodObject = z.ZodObject, O extends z.ZodType = z.ZodType> {
  handler(ctx: ToolContext, input: z.output<I>): Promise<ToolOutcome<z.output<O>>>;
  /** Required for tools that need approval: resolves exactly what the human is asked to approve. */
  describeApproval?(ctx: ToolContext, input: z.output<I>): Promise<ApprovalPlan | NonSuccessOutcome>;
}

export type ToolDefinition<I extends z.ZodObject = z.ZodObject, O extends z.ZodType = z.ZodType> = ToolMeta<I, O> & ToolImplementation<I, O>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyTool = ToolDefinition<any, any>;

/**
 * Define a tool in two steps so the schemas fix the types before the handler
 * is checked: defineTool({ ...metadata, input, output })({ handler }).
 */
export function defineTool<I extends z.ZodObject, O extends z.ZodType>(meta: ToolMeta<I, O>) {
  return (implementation: ToolImplementation<I, O>): ToolDefinition<I, O> => {
    if (meta.approvalRequired && !implementation.describeApproval) {
      throw new Error(`Tool ${meta.name} requires approval but does not describe what is approved.`);
    }
    return { ...meta, ...implementation };
  };
}

export function isApprovalPlan(value: ApprovalPlan | NonSuccessOutcome): value is ApprovalPlan {
  return (value as ApprovalPlan).action !== undefined && (value as NonSuccessOutcome).status === undefined;
}

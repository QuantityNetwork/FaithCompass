/**
 * Persisted entity shapes. Field names mirror the PostgreSQL schema
 * (snake_case) so rows flow between the database, the gateway and
 * tool outputs without lossy mapping layers.
 */
import type { ClientType } from "./clients";
import type { Environment } from "./environments";
import type { ExecutionClass } from "./execution-classes";
import type { Scope } from "./scopes";
import type { ApprovalStatus, PolicyDecision, ResponseStatus } from "./statuses";

export type ISODate = string;
export type ISODateTime = string;

interface Timestamps {
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

interface Tenant {
  id: string;
  organization_id: string;
  environment: Environment;
}

/* ───────────────────────── Organizations ───────────────────────── */

export const ORGANIZATION_KINDS = [
  "individual",
  "family",
  "business",
  "wealth_structure",
  "professional",
  "institution",
] as const;
export type OrganizationKind = (typeof ORGANIZATION_KINDS)[number];

export interface OrganizationRow extends Timestamps {
  id: string;
  name: string;
  kind: OrganizationKind;
}

export const MEMBER_ROLES = ["owner", "admin", "member", "viewer"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export interface OrganizationMemberRow {
  id: string;
  organization_id: string;
  user_id: string;
  role: MemberRole;
  created_at: ISODateTime;
}

export interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  created_at: ISODateTime;
}

export interface OrganizationSettingsRow {
  organization_id: string;
  production_execute_enabled: boolean;
  approval_ttl_minutes: number;
  session_ttl_minutes: number;
  rate_limit_per_minute: number;
  loop_threshold: number;
  max_transaction_amount_cents: number | null;
  updated_at: ISODateTime;
}

/* ───────────────────────── Property domain ───────────────────────── */

export type PropertyStatus = "prospective" | "under_contract" | "closing" | "owned" | "sold";
export type PropertyType = "single_family" | "condo" | "townhouse" | "multi_family";

export interface PropertyRow extends Tenant, Timestamps {
  reference: string;
  status: PropertyStatus;
  address_line1: string;
  address_line2: string | null;
  city: string;
  region: string;
  postal_code: string;
  country: string;
  property_type: PropertyType;
  bedrooms: number | null;
  bathrooms: number | null;
  living_area_sqft: number | null;
  lot_size_sqft: number | null;
  year_built: number | null;
  list_price_cents: number | null;
  purchase_price_cents: number | null;
  tax_jurisdiction: string | null;
  annual_tax_estimate_cents: number | null;
  annual_insurance_estimate_cents: number | null;
  hoa_name: string | null;
  hoa_monthly_cents: number | null;
}

export type TransactionStatus = "active" | "closed" | "cancelled";

export const CLOSING_STAGES = [
  "offer",
  "contract",
  "financing",
  "inspection",
  "title",
  "insurance",
  "escrow",
  "funds",
  "signing",
  "recording",
  "ownership",
] as const;
export type ClosingStage = (typeof CLOSING_STAGES)[number];

export interface TransactionRow extends Tenant, Timestamps {
  property_id: string;
  reference: string;
  kind: "purchase";
  status: TransactionStatus;
  current_stage: ClosingStage;
  purchase_price_cents: number;
  down_payment_cents: number;
  earnest_money_cents: number;
  seller_credit_cents: number;
  contract_date: ISODate | null;
  closing_date: ISODate | null;
}

export type LoanStatus =
  | "application"
  | "processing"
  | "conditional_approval"
  | "clear_to_close"
  | "funded"
  | "active"
  | "paid_off";

export interface LoanRow extends Tenant, Timestamps {
  property_id: string;
  transaction_id: string | null;
  lender_name: string;
  loan_reference_masked: string;
  status: LoanStatus;
  loan_type: "conventional" | "fha" | "va" | "jumbo";
  rate_type: "fixed" | "adjustable";
  principal_cents: number;
  annual_rate_percent: number;
  term_months: number;
  points: number;
  monthly_principal_interest_cents: number;
  escrow_included: boolean;
  rate_lock_expires_on: ISODate | null;
  required_actions: string[];
  documentation_complete: boolean;
}

export type MilestoneStatus = "complete" | "in_progress" | "pending" | "blocked" | "not_started";
export type Party = "buyer" | "seller" | "lender" | "title" | "insurance_agent" | "hoa" | "agent" | "sagolik";

export interface ClosingMilestoneRow extends Tenant {
  transaction_id: string;
  stage: ClosingStage;
  status: MilestoneStatus;
  position: number;
  owner: Party;
  due_date: ISODate | null;
  completed_at: ISODateTime | null;
  notes: string | null;
  updated_at: ISODateTime;
}

export type Severity = "critical" | "high" | "medium" | "low";

export interface ClosingBlockerRow extends Tenant {
  transaction_id: string;
  stage: ClosingStage;
  title: string;
  description: string;
  severity: Severity;
  owner: Party;
  deadline: ISODate | null;
  dependency: string | null;
  recommended_action: string;
  status: "open" | "resolved";
  detected_at: ISODateTime;
  resolved_at: ISODateTime | null;
}

export const DOCUMENT_CATEGORIES = [
  "purchase_agreement",
  "disclosure",
  "financing",
  "inspection",
  "title",
  "insurance",
  "escrow",
  "tax",
  "closing",
  "identity",
  "hoa",
  "survey",
  "ownership",
  "warranty",
  "invoice",
  "maintenance",
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const DOCUMENT_STATUSES = [
  "uploaded",
  "missing",
  "expired",
  "signature_required",
  "verification_required",
  "accepted",
  "rejected",
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export interface DocumentRow extends Tenant, Timestamps {
  property_id: string;
  transaction_id: string | null;
  category: DocumentCategory;
  title: string;
  status: DocumentStatus;
  required_for_closing: boolean;
  required_by: ISODate | null;
  provided_by: Party;
  storage_path: string | null;
  uploaded_at: ISODateTime | null;
  expires_on: ISODate | null;
}

export interface DocumentRequestRow extends Tenant, Timestamps {
  transaction_id: string;
  document_id: string;
  recipient_party: Party;
  recipient_name: string;
  message: string;
  due_date: ISODate | null;
  status: "draft" | "submitted" | "fulfilled" | "cancelled";
  prepared_by_connection_id: string | null;
  approval_id: string | null;
  submitted_at: ISODateTime | null;
}

export interface ClosingChecklistItem {
  key: string;
  stage: ClosingStage;
  title: string;
  owner: Party;
  due_date: ISODate | null;
  status: "done" | "open" | "blocked";
  source: "milestone" | "document" | "blocker" | "funds";
}

export interface ClosingChecklistRow extends Tenant, Timestamps {
  transaction_id: string;
  status: "draft" | "active" | "superseded";
  items: ClosingChecklistItem[];
  prepared_by_connection_id: string | null;
}

export const OBLIGATION_KINDS = [
  "mortgage",
  "property_tax",
  "insurance",
  "hoa",
  "utility_electric",
  "utility_water",
  "utility_gas",
  "internet",
  "maintenance",
  "other",
] as const;
export type ObligationKind = (typeof OBLIGATION_KINDS)[number];
export type Frequency = "monthly" | "quarterly" | "semiannual" | "annual";

export interface ObligationRow extends Tenant, Timestamps {
  property_id: string;
  kind: ObligationKind;
  payee: string;
  amount_cents: number;
  amount_is_estimate: boolean;
  frequency: Frequency;
  next_due_date: ISODate | null;
  source: "loan" | "tax_record" | "policy" | "hoa" | "bank_transactions" | "user" | "estimate";
  confidence: "confirmed" | "detected" | "estimated";
  escrowed: boolean;
  status: "active" | "projected" | "ended";
  payee_verified: boolean;
  starts_on: ISODate | null;
}

export type AutopilotAction = "track" | "remind" | "schedule_payment";

export interface AutopilotPlanItem {
  obligation_id: string;
  kind: ObligationKind;
  payee: string;
  amount_cents: number;
  amount_is_estimate: boolean;
  frequency: Frequency;
  next_due_date: ISODate | null;
  action: AutopilotAction;
  lead_days: number;
  funding_account_id: string | null;
  rationale: string;
}

export interface AutopilotPlanRow extends Tenant, Timestamps {
  property_id: string;
  kind: "autopilot" | "recurring_payments";
  status: "draft" | "pending_approval" | "activated" | "superseded" | "expired" | "cancelled";
  items: AutopilotPlanItem[];
  funding_account_id: string | null;
  summary: string;
  prepared_by_connection_id: string | null;
  approval_id: string | null;
  expires_at: ISODateTime;
  activated_at: ISODateTime | null;
}

export interface AutopilotRuleRow extends Tenant, Timestamps {
  property_id: string;
  plan_id: string | null;
  obligation_id: string;
  action: AutopilotAction;
  status: "active" | "paused" | "failed" | "disabled";
  funding_account_id: string | null;
  lead_days: number;
  execution_mode: "reminder_only" | "provider_scheduled" | "simulated";
  provider_id: string | null;
  provider_reference: string | null;
  next_run_on: ISODate | null;
  last_run_at: ISODateTime | null;
  failure_reason: string | null;
}

export interface OwnershipRecordRow extends Tenant, Timestamps {
  property_id: string;
  ownership_date: ISODate;
  vesting: string;
  title_company: string | null;
  deed_recorded_on: ISODate | null;
  deed_reference: string | null;
  purchase_price_cents: number | null;
}

export const HOMEBOOK_CATEGORIES = [
  "purchase",
  "warranty",
  "invoice",
  "renovation",
  "inspection",
  "maintenance",
  "ownership_document",
  "insurance",
  "tax",
] as const;
export type HomebookCategory = (typeof HOMEBOOK_CATEGORIES)[number];

export interface HomebookEntryRow extends Tenant, Timestamps {
  property_id: string;
  category: HomebookCategory;
  title: string;
  occurred_on: ISODate;
  amount_cents: number | null;
  vendor: string | null;
  document_id: string | null;
  expires_on: ISODate | null;
  notes: string | null;
}

/* ───────────────────────── Financial data ───────────────────────── */

export interface FinancialConnectionRow extends Tenant, Timestamps {
  provider_id: string;
  integration_connection_id: string | null;
  institution_name: string;
  status: "active" | "requires_reauth" | "disconnected";
  last_synced_at: ISODateTime | null;
}

export type AccountType = "depository" | "investment" | "credit" | "loan";

export interface AccountRow extends Tenant, Timestamps {
  financial_connection_id: string;
  name: string;
  mask: string;
  type: AccountType;
  subtype: string;
  current_balance_cents: number;
  available_balance_cents: number | null;
  currency: string;
  balance_as_of: ISODateTime;
}

export interface AccountTransactionRow extends Tenant {
  account_id: string;
  posted_on: ISODate;
  description: string;
  counterparty: string | null;
  amount_cents: number;
  status: "pending" | "posted";
  category: string | null;
  created_at: ISODateTime;
}

/* ───────────────────────── Integrations ───────────────────────── */

export interface IntegrationProviderRow {
  id: string;
  name: string;
  kind: "financial_data" | "payments" | "documents" | "notifications";
  description: string;
  environments: Environment[];
}

export interface IntegrationConnectionRow extends Tenant, Timestamps {
  provider_id: string;
  status: "active" | "error" | "disconnected";
  external_reference: string | null;
  last_error: string | null;
  created_by: string | null;
}

/* ───────────────────────── MCP gateway ───────────────────────── */

export interface McpClientRow {
  id: string;
  /** Null for dynamically registered public clients; set for org-owned confidential clients. */
  organization_id: string | null;
  client_name: string;
  client_type: ClientType;
  redirect_uris: string[];
  token_endpoint_auth_method: "none" | "client_secret_post" | "client_secret_basic";
  client_secret_hash: string | null;
  registration_source: "dynamic" | "console" | "system";
  created_at: ISODateTime;
}

export type ConnectionStatus = "active" | "revoked" | "expired";

export interface McpConnectionRow extends Tenant, Timestamps {
  user_id: string;
  client_id: string;
  name: string;
  client_type: ClientType;
  auth_method: "oauth" | "token";
  status: ConnectionStatus;
  scopes: Scope[];
  max_execution_class: ExecutionClass;
  transaction_limit_cents: number | null;
  expires_at: ISODateTime | null;
  revoked_at: ISODateTime | null;
  revoked_by: string | null;
  last_connected_at: ISODateTime | null;
  last_activity_at: ISODateTime | null;
  is_demo: boolean;
}

export interface McpSessionRow extends Tenant {
  connection_id: string;
  kind: "oauth" | "token";
  token_prefix: string;
  access_expires_at: ISODateTime;
  refresh_expires_at: ISODateTime | null;
  revoked_at: ISODateTime | null;
  rotated_from: string | null;
  last_seen_at: ISODateTime | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: ISODateTime;
}

export interface McpCredentialRow {
  id: string;
  session_id: string;
  kind: "access" | "refresh";
  token_hash: string;
  expires_at: ISODateTime;
  used_at: ISODateTime | null;
  created_at: ISODateTime;
}

export interface OAuthAuthorizationCodeRow {
  id: string;
  code_hash: string;
  client_id: string;
  connection_id: string;
  redirect_uri: string;
  code_challenge: string;
  resource: string;
  expires_at: ISODateTime;
  consumed_at: ISODateTime | null;
  created_at: ISODateTime;
}

export interface ApprovalDetails {
  action: string;
  affected: { kind: string; reference: string; label: string }[];
  amount: { amount: number; currency: string; cadence: string | null } | null;
  provider: string | null;
  expected_result: string;
  risks: string[];
  permissions: { scope: Scope; description: string }[];
}

export interface McpApprovalRow extends Tenant, Timestamps {
  connection_id: string | null;
  user_id: string;
  client_name: string;
  tool_name: string;
  tool_version: number;
  execution_class: ExecutionClass;
  arguments: Record<string, unknown>;
  fingerprint: string;
  summary: string;
  details: ApprovalDetails;
  status: ApprovalStatus;
  expires_at: ISODateTime;
  decided_by: string | null;
  decided_at: ISODateTime | null;
  decision_note: string | null;
  consumed_at: ISODateTime | null;
  result: Record<string, unknown> | null;
}

export interface McpAuditLogRow {
  id: string;
  sequence: number;
  organization_id: string;
  environment: Environment;
  user_id: string | null;
  connection_id: string | null;
  client_name: string;
  client_type: ClientType | "console";
  session_id: string | null;
  request_id: string;
  source: "mcp" | "console";
  tool_name: string;
  tool_version: number | null;
  execution_class: ExecutionClass | null;
  arguments_hash: string | null;
  scopes_used: Scope[];
  /** Null when the call was rejected before policy evaluation (unknown tool, rate limit, invalid input). */
  policy_decision: PolicyDecision | null;
  policy_reasons: string[];
  approval_id: string | null;
  approval_status: ApprovalStatus | null;
  status: ResponseStatus;
  error_code: string | null;
  duration_ms: number;
  providers_touched: string[];
  state_changed: boolean;
  summary: string;
  ip_address: string | null;
  user_agent: string | null;
  prev_hash: string;
  record_hash: string;
  created_at: ISODateTime;
}

/** Per-connection tool restriction. Scopes grant capability; a deny entry removes one tool from a connection. */
export interface McpPermissionRow {
  id: string;
  organization_id: string;
  environment: Environment;
  connection_id: string;
  tool_name: string;
  effect: "deny";
  created_by: string | null;
  created_at: ISODateTime;
}

/** Protocol-level request log (every JSON-RPC message, including discovery and authentication failures). */
export interface McpRequestRow {
  id: string;
  organization_id: string | null;
  environment: Environment;
  session_id: string | null;
  connection_id: string | null;
  method: string;
  tool_name: string | null;
  http_status: number;
  rpc_error_code: number | null;
  duration_ms: number;
  ip_address: string | null;
  user_agent: string | null;
  created_at: ISODateTime;
}

/** Mirror of the code-defined tool registry, kept in mcp_tools for reporting and SQL-side joins. */
export interface McpToolRow {
  tool_id: string;
  name: string;
  display_name: string;
  description: string;
  category: string;
  execution_class: ExecutionClass;
  version: string;
  status: "active" | "deprecated" | "retired";
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  required_scopes: Scope[];
  approval_required: boolean;
  environments: Environment[];
  rate_limit_per_minute: number;
  timeout_ms: number;
  idempotency_required: boolean;
  owner: string;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

/** Ledger of PREPARE and EXECUTE handler runs: what was actually carried out. */
export interface McpExecutionRow {
  id: string;
  organization_id: string;
  environment: Environment;
  audit_id: string;
  approval_id: string | null;
  connection_id: string | null;
  user_id: string;
  tool_name: string;
  tool_version: number;
  execution_class: ExecutionClass;
  status: ResponseStatus;
  state_changed: boolean;
  providers_touched: string[];
  duration_ms: number;
  summary: string;
  created_at: ISODateTime;
}

export interface IdempotencyRecordRow {
  id: string;
  organization_id: string;
  environment: Environment;
  idempotency_key: string;
  tool_name: string;
  requester: string;
  fingerprint: string;
  response: Record<string, unknown>;
  created_at: ISODateTime;
  expires_at: ISODateTime;
}

/* ───────────────────────── Webhooks ───────────────────────── */

export const WEBHOOK_EVENT_TYPES = [
  "transaction.updated",
  "closing.blocker_detected",
  "document.required",
  "document.received",
  "approval.requested",
  "approval.completed",
  "autopilot.action_required",
  "autopilot.payment_due",
  "autopilot.failure",
  "ownership.created",
] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export interface WebhookEndpointRow extends Tenant, Timestamps {
  url: string;
  description: string | null;
  events: WebhookEventType[];
  status: "enabled" | "disabled";
  secret_prefix: string;
  secret_rotated_at: ISODateTime | null;
  created_by: string | null;
}

export interface WebhookEventRow extends Tenant {
  type: WebhookEventType;
  payload: Record<string, unknown>;
  created_at: ISODateTime;
}

export interface WebhookDeliveryRow extends Tenant {
  endpoint_id: string;
  event_id: string;
  event_type: WebhookEventType;
  attempt: number;
  status: "pending" | "succeeded" | "failed" | "retrying";
  response_status: number | null;
  duration_ms: number | null;
  error: string | null;
  next_attempt_at: ISODateTime | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

import type {
  AccountRow,
  AccountTransactionRow,
  AutopilotPlanRow,
  AutopilotRuleRow,
  ClosingBlockerRow,
  ClosingChecklistRow,
  ClosingMilestoneRow,
  DocumentRequestRow,
  DocumentRow,
  FinancialConnectionRow,
  HomebookEntryRow,
  IdempotencyRecordRow,
  IntegrationConnectionRow,
  LoanRow,
  McpApprovalRow,
  McpAuditLogRow,
  McpClientRow,
  McpConnectionRow,
  McpCredentialRow,
  McpExecutionRow,
  McpPermissionRow,
  McpRequestRow,
  McpSessionRow,
  OAuthAuthorizationCodeRow,
  ObligationRow,
  OrganizationMemberRow,
  OrganizationRow,
  OrganizationSettingsRow,
  OwnershipRecordRow,
  PropertyRow,
  PropertyStatus,
  TransactionRow,
  UserRow,
  WebhookDeliveryRow,
  WebhookEndpointRow,
  WebhookEventRow,
  WebhookEventType,
} from "@/domain/entities";
import type { Environment } from "@/domain/environments";
import type { ExecutionClass } from "@/domain/execution-classes";
import type { ApprovalStatus, ResponseStatus } from "@/domain/statuses";

/**
 * Tenant scope. Always derived server-side from an authenticated identity
 * (token → connection → organization, or console session → membership).
 * Never accepted from request bodies.
 */
export interface TenantScope {
  organizationId: string;
  environment: Environment;
}

export type Patch<T> = Partial<Omit<T, "id" | "organization_id" | "environment" | "created_at">>;

/* ───────────────────────── Domain ───────────────────────── */

export interface PropertyFilter {
  query?: string;
  statuses?: PropertyStatus[];
  city?: string;
  region?: string;
}

export interface DomainStore {
  listProperties(scope: TenantScope, filter?: PropertyFilter): Promise<PropertyRow[]>;
  getProperty(scope: TenantScope, id: string): Promise<PropertyRow | null>;
  getPropertyByReference(scope: TenantScope, reference: string): Promise<PropertyRow | null>;

  listTransactions(scope: TenantScope, filter?: { propertyId?: string; status?: TransactionRow["status"] }): Promise<TransactionRow[]>;
  getTransaction(scope: TenantScope, id: string): Promise<TransactionRow | null>;
  getTransactionByReference(scope: TenantScope, reference: string): Promise<TransactionRow | null>;

  listLoans(scope: TenantScope, filter: { propertyId?: string; transactionId?: string }): Promise<LoanRow[]>;
  listMilestones(scope: TenantScope, transactionId: string): Promise<ClosingMilestoneRow[]>;
  listBlockers(scope: TenantScope, transactionId: string): Promise<ClosingBlockerRow[]>;

  listDocuments(scope: TenantScope, filter: { propertyId?: string; transactionId?: string }): Promise<DocumentRow[]>;
  getDocument(scope: TenantScope, id: string): Promise<DocumentRow | null>;

  insertDocumentRequest(row: DocumentRequestRow): Promise<DocumentRequestRow>;
  getDocumentRequest(scope: TenantScope, id: string): Promise<DocumentRequestRow | null>;
  updateDocumentRequest(scope: TenantScope, id: string, patch: Patch<DocumentRequestRow>): Promise<DocumentRequestRow | null>;
  listDocumentRequests(scope: TenantScope, filter: { transactionId?: string; status?: DocumentRequestRow["status"] }): Promise<DocumentRequestRow[]>;

  insertChecklist(row: ClosingChecklistRow): Promise<ClosingChecklistRow>;
  supersedeChecklists(scope: TenantScope, transactionId: string, exceptId: string): Promise<void>;

  listObligations(scope: TenantScope, filter?: { propertyId?: string }): Promise<ObligationRow[]>;

  insertAutopilotPlan(row: AutopilotPlanRow): Promise<AutopilotPlanRow>;
  getAutopilotPlan(scope: TenantScope, id: string): Promise<AutopilotPlanRow | null>;
  updateAutopilotPlan(scope: TenantScope, id: string, patch: Patch<AutopilotPlanRow>): Promise<AutopilotPlanRow | null>;
  listAutopilotPlans(scope: TenantScope, filter: { propertyId?: string }): Promise<AutopilotPlanRow[]>;
  listAutopilotRules(scope: TenantScope, filter: { propertyId?: string }): Promise<AutopilotRuleRow[]>;
  insertAutopilotRules(rows: AutopilotRuleRow[]): Promise<AutopilotRuleRow[]>;
  updateAutopilotRule(scope: TenantScope, id: string, patch: Patch<AutopilotRuleRow>): Promise<AutopilotRuleRow | null>;

  getOwnershipRecord(scope: TenantScope, propertyId: string): Promise<OwnershipRecordRow | null>;
  listHomebookEntries(scope: TenantScope, propertyId: string): Promise<HomebookEntryRow[]>;

  listFinancialConnections(scope: TenantScope): Promise<FinancialConnectionRow[]>;
  listAccounts(scope: TenantScope): Promise<AccountRow[]>;
  listAccountTransactions(scope: TenantScope, filter: { accountIds?: string[]; since?: string }): Promise<AccountTransactionRow[]>;
  listIntegrationConnections(scope: TenantScope): Promise<IntegrationConnectionRow[]>;
  insertIntegrationConnection(row: IntegrationConnectionRow): Promise<IntegrationConnectionRow>;
  insertFinancialConnection(row: FinancialConnectionRow): Promise<FinancialConnectionRow>;
  /** Encrypted provider credentials (server-only). */
  getIntegrationCredential(integrationConnectionId: string): Promise<string | null>;
  putIntegrationCredential(integrationConnectionId: string, encrypted: string): Promise<void>;
}

/* ───────────────────────── Organizations ───────────────────────── */

export interface OrganizationStore {
  getOrganization(id: string): Promise<OrganizationRow | null>;
  getOrganizationSettings(organizationId: string): Promise<OrganizationSettingsRow>;
  updateOrganizationSettings(organizationId: string, patch: Partial<Omit<OrganizationSettingsRow, "organization_id">>): Promise<OrganizationSettingsRow>;
  getMembership(organizationId: string, userId: string): Promise<OrganizationMemberRow | null>;
  listMembershipsForUser(userId: string): Promise<(OrganizationMemberRow & { organization: OrganizationRow })[]>;
  listMembers(organizationId: string): Promise<(OrganizationMemberRow & { user: UserRow | null })[]>;
  getUser(id: string): Promise<UserRow | null>;
}

/* ───────────────────────── Gateway ───────────────────────── */

export interface AuditFilter {
  environment?: Environment;
  connectionId?: string;
  clientType?: string;
  toolName?: string;
  executionClass?: ExecutionClass;
  outcome?: "success" | "failure";
  approvalStatus?: ApprovalStatus;
  from?: string;
  to?: string;
  limit?: number;
  /** Return records with sequence lower than this cursor. */
  beforeSequence?: number;
}

export interface ActivityStats {
  total: number;
  succeeded: number;
  failed: number;
  denied: number;
  approvalsRequested: number;
  rateLimited: number;
  stateChanging: number;
  latencyP50: number | null;
  latencyP95: number | null;
  byTool: { tool: string; count: number; failures: number }[];
  byStatus: Partial<Record<ResponseStatus, number>>;
}

export interface GatewayStore {
  getClient(id: string): Promise<McpClientRow | null>;
  insertClient(row: McpClientRow): Promise<McpClientRow>;
  listClientsForOrganization(organizationId: string): Promise<McpClientRow[]>;

  listToolPermissions(connectionId: string): Promise<McpPermissionRow[]>;
  /** Add (effect "deny") or remove (effect null) a per-tool restriction on a connection. */
  setToolPermission(input: { connection: McpConnectionRow; toolName: string; effect: "deny" | null; createdBy: string | null; now: string; id: string }): Promise<void>;

  insertRequestLog(row: McpRequestRow): Promise<void>;
  listRequestLogs(organizationId: string, filter?: { environment?: Environment; limit?: number }): Promise<McpRequestRow[]>;
  insertExecution(row: McpExecutionRow): Promise<void>;
  listExecutions(organizationId: string, filter?: { environment?: Environment; limit?: number }): Promise<McpExecutionRow[]>;

  insertConnection(row: McpConnectionRow): Promise<McpConnectionRow>;
  getConnection(id: string): Promise<McpConnectionRow | null>;
  listConnections(organizationId: string, filter?: { environment?: Environment; status?: McpConnectionRow["status"] }): Promise<McpConnectionRow[]>;
  updateConnection(id: string, patch: Patch<McpConnectionRow>): Promise<McpConnectionRow | null>;

  insertSession(row: McpSessionRow): Promise<McpSessionRow>;
  getSession(id: string): Promise<McpSessionRow | null>;
  listSessions(connectionId: string): Promise<McpSessionRow[]>;
  updateSession(id: string, patch: Patch<McpSessionRow>): Promise<McpSessionRow | null>;
  revokeSessionsForConnection(connectionId: string, at: string): Promise<void>;

  insertCredential(row: McpCredentialRow): Promise<void>;
  findCredentialByHash(hash: string): Promise<McpCredentialRow | null>;
  /** Atomically mark a refresh credential used. Returns false if it was already used (reuse). */
  markCredentialUsed(id: string, at: string): Promise<boolean>;

  insertAuthorizationCode(row: OAuthAuthorizationCodeRow): Promise<void>;
  findAuthorizationCode(hash: string): Promise<OAuthAuthorizationCodeRow | null>;
  /** Atomically consume a code. Returns false if it was already consumed. */
  consumeAuthorizationCode(id: string, at: string): Promise<boolean>;

  insertApproval(row: McpApprovalRow): Promise<McpApprovalRow>;
  getApproval(organizationId: string, id: string): Promise<McpApprovalRow | null>;
  listApprovals(organizationId: string, filter?: { environment?: Environment; status?: ApprovalStatus[]; limit?: number }): Promise<McpApprovalRow[]>;
  /** Compare-and-set update: applies only when the current status is one of `expected`. */
  transitionApproval(
    organizationId: string,
    id: string,
    expected: ApprovalStatus[],
    patch: Patch<McpApprovalRow>,
  ): Promise<McpApprovalRow | null>;

  appendAudit(row: Omit<McpAuditLogRow, "sequence" | "prev_hash" | "record_hash">): Promise<McpAuditLogRow>;
  listAudit(organizationId: string, filter?: AuditFilter): Promise<McpAuditLogRow[]>;
  getAudit(organizationId: string, id: string): Promise<McpAuditLogRow | null>;
  activityStats(organizationId: string, environment: Environment, since: string): Promise<ActivityStats>;
  /** Recompute the organization's audit hash chain. Returns the first broken sequence, or null if intact. */
  verifyAuditChain(organizationId: string): Promise<{ records: number; brokenAt: number | null }>;

  getIdempotencyRecord(scope: TenantScope, key: string, requester: string): Promise<IdempotencyRecordRow | null>;
  /** Insert unless a record with the same key/requester exists; returns the stored record. */
  putIdempotencyRecord(row: IdempotencyRecordRow): Promise<IdempotencyRecordRow>;

  /** Maintenance: remove expired idempotency records, rate counters, authorization codes and old request logs. */
  purgeExpired(now: string): Promise<void>;

  /** Atomically increment fixed-window counters. Returns the counts after increment, in key order. */
  incrementRateCounters(keys: string[], windowStart: string, windowSeconds: number): Promise<number[]>;
}

/* ───────────────────────── Webhooks ───────────────────────── */

export interface WebhookSecretRecord {
  endpoint_id: string;
  encrypted_secret: string;
  previous_encrypted_secret: string | null;
  previous_expires_at: string | null;
}

export interface WebhookStore {
  listWebhookEndpoints(scope: TenantScope): Promise<WebhookEndpointRow[]>;
  getWebhookEndpoint(organizationId: string, id: string): Promise<WebhookEndpointRow | null>;
  insertWebhookEndpoint(row: WebhookEndpointRow, secret: WebhookSecretRecord): Promise<WebhookEndpointRow>;
  updateWebhookEndpoint(organizationId: string, id: string, patch: Patch<WebhookEndpointRow>): Promise<WebhookEndpointRow | null>;
  getWebhookSecret(endpointId: string): Promise<WebhookSecretRecord | null>;
  setWebhookSecret(secret: WebhookSecretRecord): Promise<void>;
  listSubscribedEndpoints(scope: TenantScope, type: WebhookEventType): Promise<WebhookEndpointRow[]>;

  insertWebhookEvent(row: WebhookEventRow): Promise<WebhookEventRow>;
  getWebhookEvent(id: string): Promise<WebhookEventRow | null>;
  insertDelivery(row: WebhookDeliveryRow): Promise<WebhookDeliveryRow>;
  updateDelivery(id: string, patch: Patch<WebhookDeliveryRow>): Promise<WebhookDeliveryRow | null>;
  getDelivery(organizationId: string, id: string): Promise<WebhookDeliveryRow | null>;
  listDeliveries(organizationId: string, filter: { environment?: Environment; endpointId?: string; limit?: number }): Promise<WebhookDeliveryRow[]>;
  listDueDeliveries(now: string, limit: number): Promise<WebhookDeliveryRow[]>;
}

/* ───────────────────────── Sandbox ───────────────────────── */

export interface SandboxDataset {
  properties: PropertyRow[];
  transactions: TransactionRow[];
  loans: LoanRow[];
  milestones: ClosingMilestoneRow[];
  blockers: ClosingBlockerRow[];
  documents: DocumentRow[];
  obligations: ObligationRow[];
  autopilotRules: AutopilotRuleRow[];
  ownershipRecords: OwnershipRecordRow[];
  homebookEntries: HomebookEntryRow[];
  financialConnections: FinancialConnectionRow[];
  accounts: AccountRow[];
  accountTransactions: AccountTransactionRow[];
  integrationConnections: IntegrationConnectionRow[];
}

export interface SandboxStore {
  hasSandboxData(organizationId: string): Promise<boolean>;
  /** Replace all sandbox business data for an organization. Never touches production rows. */
  replaceSandboxData(organizationId: string, dataset: SandboxDataset): Promise<void>;
}

export interface Store extends DomainStore, OrganizationStore, GatewayStore, WebhookStore, SandboxStore {
  readonly kind: "memory" | "supabase";
}

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
  McpSessionRow,
  OAuthAuthorizationCodeRow,
  ObligationRow,
  OrganizationMemberRow,
  OrganizationRow,
  OrganizationSettingsRow,
  OwnershipRecordRow,
  PropertyRow,
  TransactionRow,
  UserRow,
  WebhookDeliveryRow,
  WebhookEndpointRow,
  WebhookEventRow,
} from "@/domain/entities";
import type { Environment } from "@/domain/environments";
import { isFailureStatus } from "@/domain/statuses";
import { canonicalJson, sha256Hex } from "@/server/crypto/hash";
import type { ActivityStats, AuditFilter, Patch, PropertyFilter, SandboxDataset, Store, TenantScope, WebhookSecretRecord } from "./types";

type Scoped = { organization_id: string; environment: Environment };

const clone = <T>(value: T): T => structuredClone(value);
const inScope = (scope: TenantScope) => (row: Scoped) => row.organization_id === scope.organizationId && row.environment === scope.environment;

export const DEFAULT_SETTINGS: Omit<OrganizationSettingsRow, "organization_id" | "updated_at"> = {
  production_execute_enabled: false,
  approval_ttl_minutes: 60,
  session_ttl_minutes: 60,
  rate_limit_per_minute: 120,
  loop_threshold: 5,
  max_transaction_amount_cents: null,
};

export const AUDIT_GENESIS_HASH = "0".repeat(64);

/** Canonical content hashed into the audit chain. */
export function auditHashInput(row: Omit<McpAuditLogRow, "record_hash">): string {
  return canonicalJson({
    prev: row.prev_hash,
    seq: row.sequence,
    id: row.id,
    org: row.organization_id,
    env: row.environment,
    at: row.created_at,
    tool: row.tool_name,
    status: row.status,
    args: row.arguments_hash,
    decision: row.policy_decision,
    approval: row.approval_id,
    changed: row.state_changed,
  });
}

class Table<T extends { id: string }> {
  readonly rows = new Map<string, T>();
  insert(row: T): T {
    if (this.rows.has(row.id)) throw new Error(`Duplicate id ${row.id}`);
    this.rows.set(row.id, clone(row));
    return clone(row);
  }
  get(id: string): T | null {
    const row = this.rows.get(id);
    return row ? clone(row) : null;
  }
  find(predicate: (row: T) => boolean): T[] {
    return [...this.rows.values()].filter(predicate).map(clone);
  }
  update(id: string, patch: Partial<T>, guard: (row: T) => boolean = () => true): T | null {
    const row = this.rows.get(id);
    if (!row || !guard(row)) return null;
    const next = { ...row, ...clone(patch) };
    this.rows.set(id, next);
    return clone(next);
  }
  delete(predicate: (row: T) => boolean): void {
    for (const [id, row] of this.rows) if (predicate(row)) this.rows.delete(id);
  }
}

/**
 * In-process store. Used by the test-suite and by demo mode (no database
 * configured). Implements the same tenant-scoping contract as the Supabase
 * store: every read is filtered by organization and environment.
 */
export class MemoryStore implements Store {
  readonly kind = "memory" as const;

  readonly organizations = new Table<OrganizationRow>();
  readonly users = new Table<UserRow>();
  readonly members = new Table<OrganizationMemberRow>();
  readonly settings = new Map<string, OrganizationSettingsRow>();

  readonly properties = new Table<PropertyRow>();
  readonly transactions = new Table<TransactionRow>();
  readonly loans = new Table<LoanRow>();
  readonly milestones = new Table<ClosingMilestoneRow>();
  readonly blockers = new Table<ClosingBlockerRow>();
  readonly documents = new Table<DocumentRow>();
  readonly documentRequests = new Table<DocumentRequestRow>();
  readonly checklists = new Table<ClosingChecklistRow>();
  readonly obligations = new Table<ObligationRow>();
  readonly plans = new Table<AutopilotPlanRow>();
  readonly rules = new Table<AutopilotRuleRow>();
  readonly ownership = new Table<OwnershipRecordRow>();
  readonly homebook = new Table<HomebookEntryRow>();
  readonly financialConnections = new Table<FinancialConnectionRow>();
  readonly accounts = new Table<AccountRow>();
  readonly accountTransactions = new Table<AccountTransactionRow>();
  readonly integrationConnections = new Table<IntegrationConnectionRow>();

  readonly clients = new Table<McpClientRow>();
  readonly connections = new Table<McpConnectionRow>();
  readonly sessions = new Table<McpSessionRow>();
  readonly credentials = new Table<McpCredentialRow>();
  readonly authCodes = new Table<OAuthAuthorizationCodeRow>();
  readonly approvals = new Table<McpApprovalRow>();
  readonly audit: McpAuditLogRow[] = [];
  readonly idempotency = new Table<IdempotencyRecordRow>();
  readonly counters = new Map<string, { count: number; expiresAt: number }>();

  readonly webhookEndpoints = new Table<WebhookEndpointRow>();
  readonly webhookSecrets = new Map<string, WebhookSecretRecord>();
  readonly webhookEvents = new Table<WebhookEventRow>();
  readonly webhookDeliveries = new Table<WebhookDeliveryRow>();

  /* ───────────── Organizations ───────────── */

  async getOrganization(id: string) {
    return this.organizations.get(id);
  }
  async getOrganizationSettings(organizationId: string): Promise<OrganizationSettingsRow> {
    const existing = this.settings.get(organizationId);
    return clone(existing ?? { organization_id: organizationId, ...DEFAULT_SETTINGS, updated_at: new Date(0).toISOString() });
  }
  async updateOrganizationSettings(organizationId: string, patch: Partial<Omit<OrganizationSettingsRow, "organization_id">>) {
    const next = { ...(await this.getOrganizationSettings(organizationId)), ...patch, updated_at: new Date().toISOString() };
    this.settings.set(organizationId, clone(next));
    return clone(next);
  }
  async getMembership(organizationId: string, userId: string) {
    return this.members.find((m) => m.organization_id === organizationId && m.user_id === userId)[0] ?? null;
  }
  async listMembershipsForUser(userId: string) {
    return this.members
      .find((m) => m.user_id === userId)
      .flatMap((m) => {
        const organization = this.organizations.get(m.organization_id);
        return organization ? [{ ...m, organization }] : [];
      });
  }
  async listMembers(organizationId: string) {
    return this.members.find((m) => m.organization_id === organizationId).map((m) => ({ ...m, user: this.users.get(m.user_id) }));
  }
  async getUser(id: string) {
    return this.users.get(id);
  }

  /* ───────────── Domain ───────────── */

  async listProperties(scope: TenantScope, filter: PropertyFilter = {}) {
    const q = filter.query?.toLowerCase().trim();
    return this.properties
      .find(inScope(scope))
      .filter((p) => !filter.statuses || filter.statuses.includes(p.status))
      .filter((p) => !filter.city || p.city.toLowerCase() === filter.city.toLowerCase())
      .filter((p) => !filter.region || p.region.toLowerCase() === filter.region.toLowerCase())
      .filter((p) => !q || [p.reference, p.address_line1, p.city, p.region, p.postal_code].some((f) => f.toLowerCase().includes(q)))
      .sort((a, b) => a.reference.localeCompare(b.reference));
  }
  async getProperty(scope: TenantScope, id: string) {
    const row = this.properties.get(id);
    return row && inScope(scope)(row) ? row : null;
  }
  async getPropertyByReference(scope: TenantScope, reference: string) {
    return this.properties.find((p) => inScope(scope)(p) && p.reference === reference)[0] ?? null;
  }
  async listTransactions(scope: TenantScope, filter: { propertyId?: string; status?: TransactionRow["status"] } = {}) {
    return this.transactions
      .find((t) => inScope(scope)(t) && (!filter.propertyId || t.property_id === filter.propertyId) && (!filter.status || t.status === filter.status))
      .sort((a, b) => (b.closing_date ?? "").localeCompare(a.closing_date ?? ""));
  }
  async getTransaction(scope: TenantScope, id: string) {
    const row = this.transactions.get(id);
    return row && inScope(scope)(row) ? row : null;
  }
  async getTransactionByReference(scope: TenantScope, reference: string) {
    return this.transactions.find((t) => inScope(scope)(t) && t.reference === reference)[0] ?? null;
  }
  async listLoans(scope: TenantScope, filter: { propertyId?: string; transactionId?: string }) {
    return this.loans.find(
      (l) => inScope(scope)(l) && (!filter.propertyId || l.property_id === filter.propertyId) && (!filter.transactionId || l.transaction_id === filter.transactionId),
    );
  }
  async listMilestones(scope: TenantScope, transactionId: string) {
    return this.milestones.find((m) => inScope(scope)(m) && m.transaction_id === transactionId).sort((a, b) => a.position - b.position);
  }
  async listBlockers(scope: TenantScope, transactionId: string) {
    return this.blockers.find((b) => inScope(scope)(b) && b.transaction_id === transactionId);
  }
  async listDocuments(scope: TenantScope, filter: { propertyId?: string; transactionId?: string }) {
    return this.documents.find(
      (d) => inScope(scope)(d) && (!filter.propertyId || d.property_id === filter.propertyId) && (!filter.transactionId || d.transaction_id === filter.transactionId),
    );
  }
  async getDocument(scope: TenantScope, id: string) {
    const row = this.documents.get(id);
    return row && inScope(scope)(row) ? row : null;
  }
  async insertDocumentRequest(row: DocumentRequestRow) {
    return this.documentRequests.insert(row);
  }
  async getDocumentRequest(scope: TenantScope, id: string) {
    const row = this.documentRequests.get(id);
    return row && inScope(scope)(row) ? row : null;
  }
  async updateDocumentRequest(scope: TenantScope, id: string, patch: Patch<DocumentRequestRow>) {
    return this.documentRequests.update(id, patch, inScope(scope));
  }
  async insertChecklist(row: ClosingChecklistRow) {
    return this.checklists.insert(row);
  }
  async supersedeChecklists(scope: TenantScope, transactionId: string, exceptId: string) {
    for (const c of this.checklists.find((c) => inScope(scope)(c) && c.transaction_id === transactionId && c.id !== exceptId && c.status === "draft")) {
      this.checklists.update(c.id, { status: "superseded" });
    }
  }
  async listObligations(scope: TenantScope, filter: { propertyId?: string } = {}) {
    return this.obligations.find((o) => inScope(scope)(o) && (!filter.propertyId || o.property_id === filter.propertyId));
  }
  async insertAutopilotPlan(row: AutopilotPlanRow) {
    return this.plans.insert(row);
  }
  async getAutopilotPlan(scope: TenantScope, id: string) {
    const row = this.plans.get(id);
    return row && inScope(scope)(row) ? row : null;
  }
  async updateAutopilotPlan(scope: TenantScope, id: string, patch: Patch<AutopilotPlanRow>) {
    return this.plans.update(id, patch, inScope(scope));
  }
  async listAutopilotPlans(scope: TenantScope, filter: { propertyId?: string }) {
    return this.plans.find((p) => inScope(scope)(p) && (!filter.propertyId || p.property_id === filter.propertyId)).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  async listAutopilotRules(scope: TenantScope, filter: { propertyId?: string }) {
    return this.rules.find((r) => inScope(scope)(r) && (!filter.propertyId || r.property_id === filter.propertyId));
  }
  async insertAutopilotRules(rows: AutopilotRuleRow[]) {
    return rows.map((r) => this.rules.insert(r));
  }
  async updateAutopilotRule(scope: TenantScope, id: string, patch: Patch<AutopilotRuleRow>) {
    return this.rules.update(id, patch, inScope(scope));
  }
  async getOwnershipRecord(scope: TenantScope, propertyId: string) {
    return this.ownership.find((o) => inScope(scope)(o) && o.property_id === propertyId)[0] ?? null;
  }
  async listHomebookEntries(scope: TenantScope, propertyId: string) {
    return this.homebook.find((h) => inScope(scope)(h) && h.property_id === propertyId);
  }
  async listFinancialConnections(scope: TenantScope) {
    return this.financialConnections.find(inScope(scope));
  }
  async listAccounts(scope: TenantScope) {
    return this.accounts.find(inScope(scope));
  }
  async listAccountTransactions(scope: TenantScope, filter: { accountIds?: string[]; since?: string }) {
    return this.accountTransactions
      .find((t) => inScope(scope)(t) && (!filter.accountIds || filter.accountIds.includes(t.account_id)) && (!filter.since || t.posted_on >= filter.since))
      .sort((a, b) => a.posted_on.localeCompare(b.posted_on));
  }
  async listIntegrationConnections(scope: TenantScope) {
    return this.integrationConnections.find(inScope(scope));
  }

  /* ───────────── Gateway ───────────── */

  async getClient(id: string) {
    return this.clients.get(id);
  }
  async insertClient(row: McpClientRow) {
    return this.clients.insert(row);
  }
  async listClientsForOrganization(organizationId: string) {
    const ids = new Set(this.connections.find((c) => c.organization_id === organizationId).map((c) => c.client_id));
    return this.clients.find((c) => c.organization_id === organizationId || ids.has(c.id));
  }
  async insertConnection(row: McpConnectionRow) {
    return this.connections.insert(row);
  }
  async getConnection(id: string) {
    return this.connections.get(id);
  }
  async listConnections(organizationId: string, filter: { environment?: Environment; status?: McpConnectionRow["status"] } = {}) {
    return this.connections
      .find((c) => c.organization_id === organizationId && (!filter.environment || c.environment === filter.environment) && (!filter.status || c.status === filter.status))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  async updateConnection(id: string, patch: Patch<McpConnectionRow>) {
    return this.connections.update(id, patch);
  }
  async insertSession(row: McpSessionRow) {
    return this.sessions.insert(row);
  }
  async getSession(id: string) {
    return this.sessions.get(id);
  }
  async listSessions(connectionId: string) {
    return this.sessions.find((s) => s.connection_id === connectionId).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  async updateSession(id: string, patch: Patch<McpSessionRow>) {
    return this.sessions.update(id, patch);
  }
  async revokeSessionsForConnection(connectionId: string, at: string) {
    for (const s of this.sessions.find((s) => s.connection_id === connectionId && !s.revoked_at)) this.sessions.update(s.id, { revoked_at: at });
  }
  async insertCredential(row: McpCredentialRow) {
    this.credentials.insert(row);
  }
  async findCredentialByHash(hash: string) {
    return this.credentials.find((c) => c.token_hash === hash)[0] ?? null;
  }
  async markCredentialUsed(id: string, at: string) {
    return this.credentials.update(id, { used_at: at }, (c) => c.used_at === null) !== null;
  }
  async insertAuthorizationCode(row: OAuthAuthorizationCodeRow) {
    this.authCodes.insert(row);
  }
  async findAuthorizationCode(hash: string) {
    return this.authCodes.find((c) => c.code_hash === hash)[0] ?? null;
  }
  async consumeAuthorizationCode(id: string, at: string) {
    return this.authCodes.update(id, { consumed_at: at }, (c) => c.consumed_at === null) !== null;
  }
  async insertApproval(row: McpApprovalRow) {
    return this.approvals.insert(row);
  }
  async getApproval(organizationId: string, id: string) {
    const row = this.approvals.get(id);
    return row && row.organization_id === organizationId ? row : null;
  }
  async listApprovals(organizationId: string, filter: { environment?: Environment; status?: McpApprovalRow["status"][]; limit?: number } = {}) {
    return this.approvals
      .find((a) => a.organization_id === organizationId && (!filter.environment || a.environment === filter.environment) && (!filter.status || filter.status.includes(a.status)))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, filter.limit ?? 100);
  }
  async transitionApproval(organizationId: string, id: string, expected: McpApprovalRow["status"][], patch: Patch<McpApprovalRow>) {
    return this.approvals.update(id, patch, (a) => a.organization_id === organizationId && expected.includes(a.status));
  }

  async appendAudit(row: Omit<McpAuditLogRow, "sequence" | "prev_hash" | "record_hash">) {
    const previous = [...this.audit].reverse().find((a) => a.organization_id === row.organization_id);
    const withChain = { ...row, sequence: (previous?.sequence ?? 0) + 1, prev_hash: previous?.record_hash ?? AUDIT_GENESIS_HASH };
    const record: McpAuditLogRow = { ...withChain, record_hash: sha256Hex(auditHashInput(withChain)) };
    this.audit.push(Object.freeze(clone(record)));
    return clone(record);
  }
  async listAudit(organizationId: string, filter: AuditFilter = {}) {
    return this.audit
      .filter((a) => a.organization_id === organizationId)
      .filter((a) => !filter.environment || a.environment === filter.environment)
      .filter((a) => !filter.connectionId || a.connection_id === filter.connectionId)
      .filter((a) => !filter.clientType || a.client_type === filter.clientType)
      .filter((a) => !filter.toolName || a.tool_name === filter.toolName)
      .filter((a) => !filter.executionClass || a.execution_class === filter.executionClass)
      .filter((a) => !filter.approvalStatus || a.approval_status === filter.approvalStatus)
      .filter((a) => !filter.outcome || (filter.outcome === "failure" ? isFailureStatus(a.status) : !isFailureStatus(a.status)))
      .filter((a) => !filter.from || a.created_at >= filter.from)
      .filter((a) => !filter.to || a.created_at <= filter.to)
      .filter((a) => filter.beforeSequence === undefined || a.sequence < filter.beforeSequence)
      .sort((a, b) => b.sequence - a.sequence)
      .slice(0, filter.limit ?? 50)
      .map(clone);
  }
  async getAudit(organizationId: string, id: string) {
    const row = this.audit.find((a) => a.id === id && a.organization_id === organizationId);
    return row ? clone(row) : null;
  }
  async activityStats(organizationId: string, environment: Environment, since: string): Promise<ActivityStats> {
    const rows = this.audit.filter((a) => a.organization_id === organizationId && a.environment === environment && a.created_at >= since);
    return computeActivityStats(rows);
  }
  async getIdempotencyRecord(scope: TenantScope, key: string, requester: string) {
    return this.idempotency.find((r) => inScope(scope)(r) && r.idempotency_key === key && r.requester === requester)[0] ?? null;
  }
  async putIdempotencyRecord(row: IdempotencyRecordRow) {
    const existing = this.idempotency.find(
      (r) => r.organization_id === row.organization_id && r.environment === row.environment && r.idempotency_key === row.idempotency_key && r.requester === row.requester,
    )[0];
    if (existing && existing.expires_at > row.created_at) return existing;
    if (existing) this.idempotency.delete((r) => r.id === existing.id);
    return this.idempotency.insert(row);
  }
  async incrementRateCounters(keys: string[], _windowStart: string, windowSeconds: number) {
    const now = Date.now();
    if (this.counters.size > 10_000) for (const [k, v] of this.counters) if (v.expiresAt < now) this.counters.delete(k);
    return keys.map((key) => {
      const current = this.counters.get(key);
      const next = current && current.expiresAt > now ? current.count + 1 : 1;
      this.counters.set(key, { count: next, expiresAt: current && current.expiresAt > now ? current.expiresAt : now + windowSeconds * 1000 });
      return next;
    });
  }

  /* ───────────── Webhooks ───────────── */

  async listWebhookEndpoints(scope: TenantScope) {
    return this.webhookEndpoints.find(inScope(scope)).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  async getWebhookEndpoint(organizationId: string, id: string) {
    const row = this.webhookEndpoints.get(id);
    return row && row.organization_id === organizationId ? row : null;
  }
  async insertWebhookEndpoint(row: WebhookEndpointRow, secret: WebhookSecretRecord) {
    this.webhookSecrets.set(row.id, clone(secret));
    return this.webhookEndpoints.insert(row);
  }
  async updateWebhookEndpoint(organizationId: string, id: string, patch: Patch<WebhookEndpointRow>) {
    return this.webhookEndpoints.update(id, patch, (e) => e.organization_id === organizationId);
  }
  async getWebhookSecret(endpointId: string) {
    const s = this.webhookSecrets.get(endpointId);
    return s ? clone(s) : null;
  }
  async setWebhookSecret(secret: WebhookSecretRecord) {
    this.webhookSecrets.set(secret.endpoint_id, clone(secret));
  }
  async listSubscribedEndpoints(scope: TenantScope, type: WebhookEndpointRow["events"][number]) {
    return this.webhookEndpoints.find((e) => inScope(scope)(e) && e.status === "enabled" && e.events.includes(type));
  }
  async insertWebhookEvent(row: WebhookEventRow) {
    return this.webhookEvents.insert(row);
  }
  async getWebhookEvent(id: string) {
    return this.webhookEvents.get(id);
  }
  async insertDelivery(row: WebhookDeliveryRow) {
    return this.webhookDeliveries.insert(row);
  }
  async updateDelivery(id: string, patch: Patch<WebhookDeliveryRow>) {
    return this.webhookDeliveries.update(id, patch);
  }
  async getDelivery(organizationId: string, id: string) {
    const row = this.webhookDeliveries.get(id);
    return row && row.organization_id === organizationId ? row : null;
  }
  async listDeliveries(organizationId: string, filter: { environment?: Environment; endpointId?: string; limit?: number }) {
    return this.webhookDeliveries
      .find((d) => d.organization_id === organizationId && (!filter.environment || d.environment === filter.environment) && (!filter.endpointId || d.endpoint_id === filter.endpointId))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, filter.limit ?? 50);
  }
  async listDueDeliveries(now: string, limit: number) {
    return this.webhookDeliveries
      .find((d) => (d.status === "pending" || d.status === "retrying") && (!d.next_attempt_at || d.next_attempt_at <= now))
      .slice(0, limit);
  }

  /* ───────────── Sandbox ───────────── */

  async hasSandboxData(organizationId: string) {
    return this.properties.find((p) => p.organization_id === organizationId && p.environment === "sandbox").length > 0;
  }
  async replaceSandboxData(organizationId: string, dataset: SandboxDataset) {
    const sandbox = (row: Scoped) => row.organization_id === organizationId && row.environment === "sandbox";
    for (const table of [
      this.accountTransactions, this.accounts, this.financialConnections, this.integrationConnections, this.homebook, this.ownership,
      this.rules, this.plans, this.obligations, this.checklists, this.documentRequests, this.documents, this.blockers, this.milestones,
      this.loans, this.transactions, this.properties,
    ] as Table<{ id: string } & Scoped>[]) {
      table.delete(sandbox);
    }
    for (const row of [...dataset.properties, ...dataset.transactions, ...dataset.loans, ...dataset.milestones, ...dataset.blockers, ...dataset.documents, ...dataset.obligations, ...dataset.autopilotRules, ...dataset.ownershipRecords, ...dataset.homebookEntries, ...dataset.financialConnections, ...dataset.accounts, ...dataset.accountTransactions, ...dataset.integrationConnections]) {
      if (row.organization_id !== organizationId || row.environment !== "sandbox") throw new Error("Sandbox dataset must be scoped to the sandbox environment of the organization");
    }
    dataset.properties.forEach((r) => this.properties.insert(r));
    dataset.transactions.forEach((r) => this.transactions.insert(r));
    dataset.loans.forEach((r) => this.loans.insert(r));
    dataset.milestones.forEach((r) => this.milestones.insert(r));
    dataset.blockers.forEach((r) => this.blockers.insert(r));
    dataset.documents.forEach((r) => this.documents.insert(r));
    dataset.obligations.forEach((r) => this.obligations.insert(r));
    dataset.autopilotRules.forEach((r) => this.rules.insert(r));
    dataset.ownershipRecords.forEach((r) => this.ownership.insert(r));
    dataset.homebookEntries.forEach((r) => this.homebook.insert(r));
    dataset.financialConnections.forEach((r) => this.financialConnections.insert(r));
    dataset.accounts.forEach((r) => this.accounts.insert(r));
    dataset.accountTransactions.forEach((r) => this.accountTransactions.insert(r));
    dataset.integrationConnections.forEach((r) => this.integrationConnections.insert(r));
  }
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)]!;
}

export function computeActivityStats(rows: Pick<McpAuditLogRow, "status" | "tool_name" | "duration_ms" | "error_code" | "state_changed">[]): ActivityStats {
  const byTool = new Map<string, { tool: string; count: number; failures: number }>();
  const byStatus: ActivityStats["byStatus"] = {};
  for (const r of rows) {
    const t = byTool.get(r.tool_name) ?? { tool: r.tool_name, count: 0, failures: 0 };
    t.count += 1;
    if (isFailureStatus(r.status)) t.failures += 1;
    byTool.set(r.tool_name, t);
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  }
  const latencies = rows.map((r) => r.duration_ms).sort((a, b) => a - b);
  return {
    total: rows.length,
    succeeded: rows.filter((r) => r.status === "success" || r.status === "partial").length,
    failed: rows.filter((r) => r.status === "failed" || r.status === "unavailable").length,
    denied: rows.filter((r) => r.status === "denied").length,
    approvalsRequested: rows.filter((r) => r.status === "approval_required").length,
    rateLimited: rows.filter((r) => r.error_code === "rate_limited" || r.error_code === "loop_detected").length,
    stateChanging: rows.filter((r) => r.state_changed).length,
    latencyP50: percentile(latencies, 50),
    latencyP95: percentile(latencies, 95),
    byTool: [...byTool.values()].sort((a, b) => b.count - a.count),
    byStatus,
  };
}

/** Demo/test helper: create an organization with one member. The Supabase path uses sgk_create_organization(). */
export function seedOrganization(
  store: MemoryStore,
  input: { organizationId: string; name: string; kind: OrganizationRow["kind"]; userId: string; email: string; fullName: string; role: OrganizationMemberRow["role"]; now: Date },
): void {
  const iso = input.now.toISOString();
  if (!store.organizations.get(input.organizationId)) {
    store.organizations.insert({ id: input.organizationId, name: input.name, kind: input.kind, created_at: iso, updated_at: iso });
    store.settings.set(input.organizationId, { organization_id: input.organizationId, ...DEFAULT_SETTINGS, updated_at: iso });
  }
  if (!store.users.get(input.userId)) store.users.insert({ id: input.userId, email: input.email, full_name: input.fullName, created_at: iso });
  store.members.insert({ id: crypto.randomUUID(), organization_id: input.organizationId, user_id: input.userId, role: input.role, created_at: iso });
}

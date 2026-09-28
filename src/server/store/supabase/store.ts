import "server-only";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type * as E from "@/domain/entities";
import type { Environment } from "@/domain/environments";
import { DEFAULT_SETTINGS } from "@/server/store/memory";
import type { ActivityStats, AuditFilter, Patch, PropertyFilter, SandboxDataset, Store, TenantScope, WebhookSecretRecord } from "@/server/store/types";
import type { Database, Json } from "./database.types";

type Client = SupabaseClient<Database>;

export class StoreError extends Error {
  constructor(readonly context: string, readonly code: string | undefined) {
    super(`Database operation failed: ${context}${code ? ` (${code})` : ""}`);
    this.name = "StoreError";
  }
}

function check(error: PostgrestError | null, context: string): void {
  if (error) throw new StoreError(context, error.code);
}

function rows<T>(res: { data: unknown; error: PostgrestError | null }, context: string): T[] {
  check(res.error, context);
  return (res.data ?? []) as T[];
}

function row<T>(res: { data: unknown; error: PostgrestError | null }, context: string): T | null {
  check(res.error, context);
  return (res.data ?? null) as T | null;
}

const json = (value: unknown) => value as Json;
/** Strip characters with meaning in PostgREST filter syntax from free-text search. */
const searchTerm = (q: string) => q.replace(/[,()%*\\:]/g, " ").trim().slice(0, 80);
const FAILURE_STATUSES = ["denied", "failed", "unavailable"];

/**
 * Supabase (PostgreSQL) store. Instantiated with the service-role client on
 * the server only. Every method filters by the tenant scope it is given, and
 * the database enforces isolation independently through composite foreign
 * keys and Row Level Security.
 */
export class SupabaseStore implements Store {
  readonly kind = "supabase" as const;
  constructor(private readonly db: Client) {}

  /* ───────────── Organizations ───────────── */

  async getOrganization(id: string) {
    return row<E.OrganizationRow>(await this.db.from("organizations").select("*").eq("id", id).maybeSingle(), "getOrganization");
  }
  async getOrganizationSettings(organizationId: string): Promise<E.OrganizationSettingsRow> {
    const found = row<E.OrganizationSettingsRow>(await this.db.from("organization_settings").select("*").eq("organization_id", organizationId).maybeSingle(), "getOrganizationSettings");
    return found ?? { organization_id: organizationId, ...DEFAULT_SETTINGS, updated_at: new Date(0).toISOString() };
  }
  async updateOrganizationSettings(organizationId: string, patch: Partial<Omit<E.OrganizationSettingsRow, "organization_id">>) {
    const res = await this.db
      .from("organization_settings")
      .upsert({ organization_id: organizationId, ...patch, updated_at: new Date().toISOString() })
      .select("*")
      .single();
    return row<E.OrganizationSettingsRow>(res, "updateOrganizationSettings")!;
  }
  async getMembership(organizationId: string, userId: string) {
    return row<E.OrganizationMemberRow>(
      await this.db.from("organization_members").select("*").eq("organization_id", organizationId).eq("user_id", userId).maybeSingle(),
      "getMembership",
    );
  }
  async listMembershipsForUser(userId: string) {
    const memberships = rows<E.OrganizationMemberRow>(await this.db.from("organization_members").select("*").eq("user_id", userId), "listMembershipsForUser");
    if (memberships.length === 0) return [];
    const orgs = rows<E.OrganizationRow>(await this.db.from("organizations").select("*").in("id", memberships.map((m) => m.organization_id)), "listMembershipsForUser.orgs");
    return memberships.flatMap((m) => {
      const organization = orgs.find((o) => o.id === m.organization_id);
      return organization ? [{ ...m, organization }] : [];
    });
  }
  async listMembers(organizationId: string) {
    const members = rows<E.OrganizationMemberRow>(await this.db.from("organization_members").select("*").eq("organization_id", organizationId), "listMembers");
    const users = members.length ? rows<E.UserRow>(await this.db.from("users").select("*").in("id", members.map((m) => m.user_id)), "listMembers.users") : [];
    return members.map((m) => ({ ...m, user: users.find((u) => u.id === m.user_id) ?? null }));
  }
  async getUser(id: string) {
    return row<E.UserRow>(await this.db.from("users").select("*").eq("id", id).maybeSingle(), "getUser");
  }

  /* ───────────── Domain ───────────── */

  async listProperties(scope: TenantScope, filter: PropertyFilter = {}) {
    let q = this.db.from("properties").select("*").eq("organization_id", scope.organizationId).eq("environment", scope.environment);
    if (filter.statuses?.length) q = q.in("status", filter.statuses);
    if (filter.city) q = q.ilike("city", searchTerm(filter.city));
    if (filter.region) q = q.ilike("region", searchTerm(filter.region));
    if (filter.query) {
      const t = searchTerm(filter.query);
      if (t) q = q.or(`reference.ilike.%${t}%,address_line1.ilike.%${t}%,city.ilike.%${t}%,region.ilike.%${t}%,postal_code.ilike.%${t}%`);
    }
    return rows<E.PropertyRow>(await q.order("reference"), "listProperties");
  }
  async getProperty(scope: TenantScope, id: string) {
    return row<E.PropertyRow>(await this.scoped("properties", scope).eq("id", id).maybeSingle(), "getProperty");
  }
  async getPropertyByReference(scope: TenantScope, reference: string) {
    return row<E.PropertyRow>(await this.scoped("properties", scope).eq("reference", reference).maybeSingle(), "getPropertyByReference");
  }
  async listTransactions(scope: TenantScope, filter: { propertyId?: string; status?: E.TransactionRow["status"] } = {}) {
    let q = this.scoped("transactions", scope);
    if (filter.propertyId) q = q.eq("property_id", filter.propertyId);
    if (filter.status) q = q.eq("status", filter.status);
    return rows<E.TransactionRow>(await q.order("closing_date", { ascending: false }), "listTransactions");
  }
  async getTransaction(scope: TenantScope, id: string) {
    return row<E.TransactionRow>(await this.scoped("transactions", scope).eq("id", id).maybeSingle(), "getTransaction");
  }
  async getTransactionByReference(scope: TenantScope, reference: string) {
    return row<E.TransactionRow>(await this.scoped("transactions", scope).eq("reference", reference).maybeSingle(), "getTransactionByReference");
  }
  async listLoans(scope: TenantScope, filter: { propertyId?: string; transactionId?: string }) {
    let q = this.scoped("loans", scope);
    if (filter.propertyId) q = q.eq("property_id", filter.propertyId);
    if (filter.transactionId) q = q.eq("transaction_id", filter.transactionId);
    return rows<E.LoanRow>(await q, "listLoans");
  }
  async listMilestones(scope: TenantScope, transactionId: string) {
    return rows<E.ClosingMilestoneRow>(await this.scoped("closing_milestones", scope).eq("transaction_id", transactionId).order("position"), "listMilestones");
  }
  async listBlockers(scope: TenantScope, transactionId: string) {
    return rows<E.ClosingBlockerRow>(await this.scoped("closing_blockers", scope).eq("transaction_id", transactionId), "listBlockers");
  }
  async listDocuments(scope: TenantScope, filter: { propertyId?: string; transactionId?: string }) {
    let q = this.scoped("documents", scope);
    if (filter.propertyId) q = q.eq("property_id", filter.propertyId);
    if (filter.transactionId) q = q.eq("transaction_id", filter.transactionId);
    return rows<E.DocumentRow>(await q, "listDocuments");
  }
  async getDocument(scope: TenantScope, id: string) {
    return row<E.DocumentRow>(await this.scoped("documents", scope).eq("id", id).maybeSingle(), "getDocument");
  }
  async insertDocumentRequest(r: E.DocumentRequestRow) {
    return row<E.DocumentRequestRow>(await this.db.from("document_requests").insert(r).select("*").single(), "insertDocumentRequest")!;
  }
  async getDocumentRequest(scope: TenantScope, id: string) {
    return row<E.DocumentRequestRow>(await this.scoped("document_requests", scope).eq("id", id).maybeSingle(), "getDocumentRequest");
  }
  async updateDocumentRequest(scope: TenantScope, id: string, patch: Patch<E.DocumentRequestRow>) {
    return row<E.DocumentRequestRow>(
      await this.db.from("document_requests").update(patch).eq("id", id).eq("organization_id", scope.organizationId).eq("environment", scope.environment).select("*").maybeSingle(),
      "updateDocumentRequest",
    );
  }
  async listDocumentRequests(scope: TenantScope, filter: { transactionId?: string; status?: E.DocumentRequestRow["status"] }) {
    let q = this.scoped("document_requests", scope);
    if (filter.transactionId) q = q.eq("transaction_id", filter.transactionId);
    if (filter.status) q = q.eq("status", filter.status);
    return rows<E.DocumentRequestRow>(await q.order("created_at", { ascending: false }), "listDocumentRequests");
  }
  async insertChecklist(r: E.ClosingChecklistRow) {
    return row<E.ClosingChecklistRow>(await this.db.from("closing_checklists").insert({ ...r, items: json(r.items) }).select("*").single(), "insertChecklist")!;
  }
  async supersedeChecklists(scope: TenantScope, transactionId: string, exceptId: string) {
    const res = await this.db
      .from("closing_checklists")
      .update({ status: "superseded", updated_at: new Date().toISOString() })
      .eq("organization_id", scope.organizationId)
      .eq("environment", scope.environment)
      .eq("transaction_id", transactionId)
      .eq("status", "draft")
      .neq("id", exceptId);
    check(res.error, "supersedeChecklists");
  }
  async listObligations(scope: TenantScope, filter: { propertyId?: string } = {}) {
    let q = this.scoped("obligations", scope);
    if (filter.propertyId) q = q.eq("property_id", filter.propertyId);
    return rows<E.ObligationRow>(await q, "listObligations");
  }
  async insertAutopilotPlan(r: E.AutopilotPlanRow) {
    return row<E.AutopilotPlanRow>(await this.db.from("autopilot_plans").insert({ ...r, items: json(r.items) }).select("*").single(), "insertAutopilotPlan")!;
  }
  async getAutopilotPlan(scope: TenantScope, id: string) {
    return row<E.AutopilotPlanRow>(await this.scoped("autopilot_plans", scope).eq("id", id).maybeSingle(), "getAutopilotPlan");
  }
  async updateAutopilotPlan(scope: TenantScope, id: string, patch: Patch<E.AutopilotPlanRow>) {
    const { items, ...rest } = patch;
    return row<E.AutopilotPlanRow>(
      await this.db
        .from("autopilot_plans")
        .update({ ...rest, ...(items ? { items: json(items) } : {}) })
        .eq("id", id)
        .eq("organization_id", scope.organizationId)
        .eq("environment", scope.environment)
        .select("*")
        .maybeSingle(),
      "updateAutopilotPlan",
    );
  }
  async listAutopilotPlans(scope: TenantScope, filter: { propertyId?: string }) {
    let q = this.scoped("autopilot_plans", scope);
    if (filter.propertyId) q = q.eq("property_id", filter.propertyId);
    return rows<E.AutopilotPlanRow>(await q.order("created_at", { ascending: false }), "listAutopilotPlans");
  }
  async listAutopilotRules(scope: TenantScope, filter: { propertyId?: string }) {
    let q = this.scoped("autopilot_rules", scope);
    if (filter.propertyId) q = q.eq("property_id", filter.propertyId);
    return rows<E.AutopilotRuleRow>(await q, "listAutopilotRules");
  }
  async insertAutopilotRules(rs: E.AutopilotRuleRow[]) {
    if (rs.length === 0) return [];
    return rows<E.AutopilotRuleRow>(await this.db.from("autopilot_rules").insert(rs).select("*"), "insertAutopilotRules");
  }
  async updateAutopilotRule(scope: TenantScope, id: string, patch: Patch<E.AutopilotRuleRow>) {
    return row<E.AutopilotRuleRow>(
      await this.db.from("autopilot_rules").update(patch).eq("id", id).eq("organization_id", scope.organizationId).eq("environment", scope.environment).select("*").maybeSingle(),
      "updateAutopilotRule",
    );
  }
  async getOwnershipRecord(scope: TenantScope, propertyId: string) {
    return row<E.OwnershipRecordRow>(await this.scoped("ownership_records", scope).eq("property_id", propertyId).maybeSingle(), "getOwnershipRecord");
  }
  async listHomebookEntries(scope: TenantScope, propertyId: string) {
    return rows<E.HomebookEntryRow>(await this.scoped("homebook_entries", scope).eq("property_id", propertyId), "listHomebookEntries");
  }
  async listFinancialConnections(scope: TenantScope) {
    return rows<E.FinancialConnectionRow>(await this.scoped("financial_connections", scope), "listFinancialConnections");
  }
  async listAccounts(scope: TenantScope) {
    return rows<E.AccountRow>(await this.scoped("accounts", scope), "listAccounts");
  }
  async listAccountTransactions(scope: TenantScope, filter: { accountIds?: string[]; since?: string }) {
    let q = this.scoped("account_transactions", scope);
    if (filter.accountIds) q = q.in("account_id", filter.accountIds);
    if (filter.since) q = q.gte("posted_on", filter.since);
    return rows<E.AccountTransactionRow>(await q.order("posted_on").limit(2000), "listAccountTransactions");
  }
  async listIntegrationConnections(scope: TenantScope) {
    return rows<E.IntegrationConnectionRow>(await this.scoped("integration_connections", scope), "listIntegrationConnections");
  }
  async insertIntegrationConnection(r: E.IntegrationConnectionRow) {
    return row<E.IntegrationConnectionRow>(await this.db.from("integration_connections").insert(r).select("*").single(), "insertIntegrationConnection")!;
  }
  async insertFinancialConnection(r: E.FinancialConnectionRow) {
    return row<E.FinancialConnectionRow>(await this.db.from("financial_connections").insert(r).select("*").single(), "insertFinancialConnection")!;
  }

  /* ───────────── Gateway ───────────── */

  async getClient(id: string) {
    return row<E.McpClientRow>(await this.db.from("mcp_clients").select("*").eq("id", id).maybeSingle(), "getClient");
  }
  async insertClient(r: E.McpClientRow) {
    return row<E.McpClientRow>(await this.db.from("mcp_clients").insert(r).select("*").single(), "insertClient")!;
  }
  async listClientsForOrganization(organizationId: string) {
    const connected = rows<{ client_id: string }>(await this.db.from("mcp_connections").select("client_id").eq("organization_id", organizationId), "listClients.connections");
    const ids = [...new Set(connected.map((c) => c.client_id))];
    const owned = rows<E.McpClientRow>(await this.db.from("mcp_clients").select("*").eq("organization_id", organizationId), "listClients.owned");
    const linked = ids.length ? rows<E.McpClientRow>(await this.db.from("mcp_clients").select("*").in("id", ids), "listClients.linked") : [];
    return [...new Map([...owned, ...linked].map((c) => [c.id, c])).values()];
  }
  async listToolPermissions(connectionId: string) {
    return rows<E.McpPermissionRow>(await this.db.from("mcp_permissions").select("*").eq("connection_id", connectionId), "listToolPermissions");
  }
  async setToolPermission(input: { connection: E.McpConnectionRow; toolName: string; effect: "deny" | null; createdBy: string | null; now: string; id: string }) {
    const del = await this.db.from("mcp_permissions").delete().eq("connection_id", input.connection.id).eq("tool_name", input.toolName);
    check(del.error, "setToolPermission.delete");
    if (!input.effect) return;
    const ins = await this.db.from("mcp_permissions").insert({
      id: input.id,
      organization_id: input.connection.organization_id,
      environment: input.connection.environment,
      connection_id: input.connection.id,
      tool_name: input.toolName,
      effect: input.effect,
      created_by: input.createdBy,
      created_at: input.now,
    });
    check(ins.error, "setToolPermission.insert");
  }
  async insertRequestLog(r: E.McpRequestRow) {
    check((await this.db.from("mcp_requests").insert(r)).error, "insertRequestLog");
  }
  async listRequestLogs(organizationId: string, filter: { environment?: Environment; limit?: number } = {}) {
    let q = this.db.from("mcp_requests").select("*").eq("organization_id", organizationId);
    if (filter.environment) q = q.eq("environment", filter.environment);
    return rows<E.McpRequestRow>(await q.order("created_at", { ascending: false }).limit(filter.limit ?? 50), "listRequestLogs");
  }
  async insertExecution(r: E.McpExecutionRow) {
    check((await this.db.from("mcp_executions").insert(r)).error, "insertExecution");
  }
  async listExecutions(organizationId: string, filter: { environment?: Environment; limit?: number } = {}) {
    let q = this.db.from("mcp_executions").select("*").eq("organization_id", organizationId);
    if (filter.environment) q = q.eq("environment", filter.environment);
    return rows<E.McpExecutionRow>(await q.order("created_at", { ascending: false }).limit(filter.limit ?? 50), "listExecutions");
  }
  async insertConnection(r: E.McpConnectionRow) {
    return row<E.McpConnectionRow>(await this.db.from("mcp_connections").insert(r).select("*").single(), "insertConnection")!;
  }
  async getConnection(id: string) {
    return row<E.McpConnectionRow>(await this.db.from("mcp_connections").select("*").eq("id", id).maybeSingle(), "getConnection");
  }
  async listConnections(organizationId: string, filter: { environment?: Environment; status?: E.McpConnectionRow["status"] } = {}) {
    let q = this.db.from("mcp_connections").select("*").eq("organization_id", organizationId);
    if (filter.environment) q = q.eq("environment", filter.environment);
    if (filter.status) q = q.eq("status", filter.status);
    return rows<E.McpConnectionRow>(await q.order("created_at", { ascending: false }), "listConnections");
  }
  async updateConnection(id: string, patch: Patch<E.McpConnectionRow>) {
    return row<E.McpConnectionRow>(await this.db.from("mcp_connections").update(patch).eq("id", id).select("*").maybeSingle(), "updateConnection");
  }
  async insertSession(r: E.McpSessionRow) {
    return row<E.McpSessionRow>(await this.db.from("mcp_sessions").insert(r).select("*").single(), "insertSession")!;
  }
  async getSession(id: string) {
    return row<E.McpSessionRow>(await this.db.from("mcp_sessions").select("*").eq("id", id).maybeSingle(), "getSession");
  }
  async listSessions(connectionId: string) {
    return rows<E.McpSessionRow>(await this.db.from("mcp_sessions").select("*").eq("connection_id", connectionId).order("created_at", { ascending: false }).limit(50), "listSessions");
  }
  async updateSession(id: string, patch: Patch<E.McpSessionRow>) {
    return row<E.McpSessionRow>(await this.db.from("mcp_sessions").update(patch).eq("id", id).select("*").maybeSingle(), "updateSession");
  }
  async revokeSessionsForConnection(connectionId: string, at: string) {
    check((await this.db.from("mcp_sessions").update({ revoked_at: at }).eq("connection_id", connectionId).is("revoked_at", null)).error, "revokeSessions");
  }
  async insertCredential(r: E.McpCredentialRow) {
    check((await this.db.from("mcp_credentials").insert(r)).error, "insertCredential");
  }
  async findCredentialByHash(hash: string) {
    return row<E.McpCredentialRow>(await this.db.from("mcp_credentials").select("*").eq("token_hash", hash).maybeSingle(), "findCredentialByHash");
  }
  async markCredentialUsed(id: string, at: string) {
    const res = await this.db.from("mcp_credentials").update({ used_at: at }).eq("id", id).is("used_at", null).select("id");
    return rows(res, "markCredentialUsed").length > 0;
  }
  async insertAuthorizationCode(r: E.OAuthAuthorizationCodeRow) {
    check((await this.db.from("oauth_authorization_codes").insert(r)).error, "insertAuthorizationCode");
  }
  async findAuthorizationCode(hash: string) {
    return row<E.OAuthAuthorizationCodeRow>(await this.db.from("oauth_authorization_codes").select("*").eq("code_hash", hash).maybeSingle(), "findAuthorizationCode");
  }
  async consumeAuthorizationCode(id: string, at: string) {
    const res = await this.db.from("oauth_authorization_codes").update({ consumed_at: at }).eq("id", id).is("consumed_at", null).select("id");
    return rows(res, "consumeAuthorizationCode").length > 0;
  }
  async insertApproval(r: E.McpApprovalRow) {
    const res = await this.db
      .from("mcp_approvals")
      .insert({ ...r, arguments: json(r.arguments), details: json(r.details), result: json(r.result) })
      .select("*")
      .single();
    return row<E.McpApprovalRow>(res, "insertApproval")!;
  }
  async getApproval(organizationId: string, id: string) {
    return row<E.McpApprovalRow>(await this.db.from("mcp_approvals").select("*").eq("organization_id", organizationId).eq("id", id).maybeSingle(), "getApproval");
  }
  async listApprovals(organizationId: string, filter: { environment?: Environment; status?: E.McpApprovalRow["status"][]; limit?: number } = {}) {
    let q = this.db.from("mcp_approvals").select("*").eq("organization_id", organizationId);
    if (filter.environment) q = q.eq("environment", filter.environment);
    if (filter.status?.length) q = q.in("status", filter.status);
    return rows<E.McpApprovalRow>(await q.order("created_at", { ascending: false }).limit(filter.limit ?? 100), "listApprovals");
  }
  async transitionApproval(organizationId: string, id: string, expected: E.McpApprovalRow["status"][], patch: Patch<E.McpApprovalRow>) {
    const { arguments: args, details, result, ...rest } = patch;
    const res = await this.db
      .from("mcp_approvals")
      .update({
        ...rest,
        ...(args !== undefined ? { arguments: json(args) } : {}),
        ...(details !== undefined ? { details: json(details) } : {}),
        ...(result !== undefined ? { result: json(result) } : {}),
      })
      .eq("organization_id", organizationId)
      .eq("id", id)
      .in("status", expected)
      .select("*")
      .maybeSingle();
    return row<E.McpApprovalRow>(res, "transitionApproval");
  }
  async appendAudit(r: Omit<E.McpAuditLogRow, "sequence" | "prev_hash" | "record_hash">) {
    // sequence, prev_hash and record_hash are assigned by the sgk_audit_chain trigger.
    const res = await this.db.from("mcp_audit_logs").insert({ ...r, sequence: 0, prev_hash: "", record_hash: "" }).select("*").single();
    return row<E.McpAuditLogRow>(res, "appendAudit")!;
  }
  async listAudit(organizationId: string, filter: AuditFilter = {}) {
    let q = this.db.from("mcp_audit_logs").select("*").eq("organization_id", organizationId);
    if (filter.environment) q = q.eq("environment", filter.environment);
    if (filter.connectionId) q = q.eq("connection_id", filter.connectionId);
    if (filter.clientType) q = q.eq("client_type", filter.clientType);
    if (filter.toolName) q = q.eq("tool_name", filter.toolName);
    if (filter.executionClass) q = q.eq("execution_class", filter.executionClass);
    if (filter.approvalStatus) q = q.eq("approval_status", filter.approvalStatus);
    if (filter.outcome === "failure") q = q.in("status", FAILURE_STATUSES);
    if (filter.outcome === "success") q = q.not("status", "in", `(${FAILURE_STATUSES.join(",")})`);
    if (filter.from) q = q.gte("created_at", filter.from);
    if (filter.to) q = q.lte("created_at", filter.to);
    if (filter.beforeSequence !== undefined) q = q.lt("sequence", filter.beforeSequence);
    return rows<E.McpAuditLogRow>(await q.order("sequence", { ascending: false }).limit(filter.limit ?? 50), "listAudit");
  }
  async getAudit(organizationId: string, id: string) {
    return row<E.McpAuditLogRow>(await this.db.from("mcp_audit_logs").select("*").eq("organization_id", organizationId).eq("id", id).maybeSingle(), "getAudit");
  }
  async verifyAuditChain(organizationId: string) {
    const count = await this.db.from("mcp_audit_logs").select("id", { count: "exact", head: true }).eq("organization_id", organizationId);
    check(count.error, "verifyAuditChain.count");
    const res = await this.db.rpc("sgk_verify_audit_chain", { p_org: organizationId });
    check(res.error, "verifyAuditChain");
    return { records: count.count ?? 0, brokenAt: (res.data as number | null) ?? null };
  }
  async activityStats(organizationId: string, environment: Environment, since: string): Promise<ActivityStats> {
    const res = await this.db.rpc("sgk_activity_stats", { p_org: organizationId, p_env: environment, p_since: since });
    check(res.error, "activityStats");
    return res.data as unknown as ActivityStats;
  }
  async getIdempotencyRecord(scope: TenantScope, key: string, requester: string) {
    return row<E.IdempotencyRecordRow>(
      await this.scoped("idempotency_records", scope).eq("idempotency_key", key).eq("requester", requester).maybeSingle(),
      "getIdempotencyRecord",
    );
  }
  async putIdempotencyRecord(r: E.IdempotencyRecordRow) {
    const insert = await this.db.from("idempotency_records").insert({ ...r, response: json(r.response) }).select("*").single();
    if (!insert.error) return insert.data as unknown as E.IdempotencyRecordRow;
    if (insert.error.code !== "23505") throw new StoreError("putIdempotencyRecord", insert.error.code);
    const scope = { organizationId: r.organization_id, environment: r.environment };
    const existing = await this.getIdempotencyRecord(scope, r.idempotency_key, r.requester);
    if (existing && existing.expires_at > r.created_at) return existing;
    const replaced = await this.db
      .from("idempotency_records")
      .update({ fingerprint: r.fingerprint, response: json(r.response), created_at: r.created_at, expires_at: r.expires_at, tool_name: r.tool_name })
      .eq("organization_id", r.organization_id)
      .eq("environment", r.environment)
      .eq("idempotency_key", r.idempotency_key)
      .eq("requester", r.requester)
      .select("*")
      .single();
    return row<E.IdempotencyRecordRow>(replaced, "putIdempotencyRecord.replace")!;
  }
  async purgeExpired(now: string) {
    const monthAgo = new Date(Date.parse(now) - 30 * 86_400_000).toISOString();
    check((await this.db.from("idempotency_records").delete().lte("expires_at", now)).error, "purge.idempotency");
    check((await this.db.from("rate_limit_counters").delete().lte("expires_at", now)).error, "purge.counters");
    check((await this.db.from("oauth_authorization_codes").delete().lte("expires_at", now)).error, "purge.codes");
    check((await this.db.from("mcp_requests").delete().lte("created_at", monthAgo)).error, "purge.requests");
  }
  async incrementRateCounters(keys: string[], _windowStart: string, windowSeconds: number) {
    const res = await this.db.rpc("sgk_increment_rate_counters", { p_keys: keys, p_window_seconds: windowSeconds });
    check(res.error, "incrementRateCounters");
    return (res.data ?? []) as number[];
  }

  /* ───────────── Webhooks ───────────── */

  async listWebhookEndpoints(scope: TenantScope) {
    return rows<E.WebhookEndpointRow>(await this.scoped("webhook_endpoints", scope).order("created_at", { ascending: false }), "listWebhookEndpoints");
  }
  async getWebhookEndpoint(organizationId: string, id: string) {
    return row<E.WebhookEndpointRow>(await this.db.from("webhook_endpoints").select("*").eq("organization_id", organizationId).eq("id", id).maybeSingle(), "getWebhookEndpoint");
  }
  async insertWebhookEndpoint(r: E.WebhookEndpointRow, secret: WebhookSecretRecord) {
    const endpoint = row<E.WebhookEndpointRow>(await this.db.from("webhook_endpoints").insert(r).select("*").single(), "insertWebhookEndpoint")!;
    await this.setWebhookSecret(secret);
    return endpoint;
  }
  async updateWebhookEndpoint(organizationId: string, id: string, patch: Patch<E.WebhookEndpointRow>) {
    return row<E.WebhookEndpointRow>(
      await this.db.from("webhook_endpoints").update(patch).eq("organization_id", organizationId).eq("id", id).select("*").maybeSingle(),
      "updateWebhookEndpoint",
    );
  }
  async getWebhookSecret(endpointId: string) {
    return row<WebhookSecretRecord>(await this.db.from("webhook_endpoint_secrets").select("*").eq("endpoint_id", endpointId).maybeSingle(), "getWebhookSecret");
  }
  async setWebhookSecret(secret: WebhookSecretRecord) {
    check((await this.db.from("webhook_endpoint_secrets").upsert(secret)).error, "setWebhookSecret");
  }
  async listSubscribedEndpoints(scope: TenantScope, type: E.WebhookEventType) {
    return rows<E.WebhookEndpointRow>(await this.scoped("webhook_endpoints", scope).eq("status", "enabled").contains("events", [type]), "listSubscribedEndpoints");
  }
  async insertWebhookEvent(r: E.WebhookEventRow) {
    return row<E.WebhookEventRow>(await this.db.from("webhook_events").insert({ ...r, payload: json(r.payload) }).select("*").single(), "insertWebhookEvent")!;
  }
  async getWebhookEvent(id: string) {
    return row<E.WebhookEventRow>(await this.db.from("webhook_events").select("*").eq("id", id).maybeSingle(), "getWebhookEvent");
  }
  async insertDelivery(r: E.WebhookDeliveryRow) {
    return row<E.WebhookDeliveryRow>(await this.db.from("webhook_deliveries").insert(r).select("*").single(), "insertDelivery")!;
  }
  async updateDelivery(id: string, patch: Patch<E.WebhookDeliveryRow>) {
    return row<E.WebhookDeliveryRow>(await this.db.from("webhook_deliveries").update(patch).eq("id", id).select("*").maybeSingle(), "updateDelivery");
  }
  async getDelivery(organizationId: string, id: string) {
    return row<E.WebhookDeliveryRow>(await this.db.from("webhook_deliveries").select("*").eq("organization_id", organizationId).eq("id", id).maybeSingle(), "getDelivery");
  }
  async listDeliveries(organizationId: string, filter: { environment?: Environment; endpointId?: string; limit?: number }) {
    let q = this.db.from("webhook_deliveries").select("*").eq("organization_id", organizationId);
    if (filter.environment) q = q.eq("environment", filter.environment);
    if (filter.endpointId) q = q.eq("endpoint_id", filter.endpointId);
    return rows<E.WebhookDeliveryRow>(await q.order("created_at", { ascending: false }).limit(filter.limit ?? 50), "listDeliveries");
  }
  async listDueDeliveries(now: string, limit: number) {
    const res = await this.db
      .from("webhook_deliveries")
      .select("*")
      .in("status", ["pending", "retrying"])
      .or(`next_attempt_at.is.null,next_attempt_at.lte.${now}`)
      .order("created_at")
      .limit(limit);
    return rows<E.WebhookDeliveryRow>(res, "listDueDeliveries");
  }

  /* ───────────── Sandbox ───────────── */

  async hasSandboxData(organizationId: string) {
    const res = await this.db.from("properties").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("environment", "sandbox");
    check(res.error, "hasSandboxData");
    return (res.count ?? 0) > 0;
  }
  async replaceSandboxData(organizationId: string, dataset: SandboxDataset) {
    check((await this.db.rpc("sgk_replace_sandbox", { p_org: organizationId, p_dataset: json(dataset) })).error, "replaceSandboxData");
  }

  /* ───────────── Integration credentials (server-only table) ───────────── */

  async getIntegrationCredential(integrationConnectionId: string): Promise<string | null> {
    const found = row<{ encrypted_credentials: string }>(
      await this.db.from("integration_credentials").select("encrypted_credentials").eq("integration_connection_id", integrationConnectionId).maybeSingle(),
      "getIntegrationCredential",
    );
    return found?.encrypted_credentials ?? null;
  }

  async putIntegrationCredential(integrationConnectionId: string, encrypted: string): Promise<void> {
    const res = await this.db.from("integration_credentials").upsert({ integration_connection_id: integrationConnectionId, encrypted_credentials: encrypted, updated_at: new Date().toISOString() });
    check(res.error, "putIntegrationCredential");
  }

  /* ───────────── helpers ───────────── */

  private scoped<T extends keyof Database["public"]["Tables"]>(table: T, scope: TenantScope) {
    // The generic builder types are loose here; every scoped table has organization_id and environment.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.db.from(table) as any).select("*").eq("organization_id", scope.organizationId).eq("environment", scope.environment);
  }
}

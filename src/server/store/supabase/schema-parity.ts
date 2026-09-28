/**
 * Compile-time guarantee that every persisted entity type has exactly the
 * columns of its table. A drift between TypeScript and SQL fails `tsc`,
 * naming the offending keys.
 */
import type * as E from "@/domain/entities";
import type { WebhookSecretRecord } from "@/server/store/types";
import type { Database } from "./database.types";

type Tables = Database["public"]["Tables"];
type Keys<T> = Extract<keyof T, string>;
type Parity<Entity, Table extends keyof Tables> = [Exclude<Keys<Entity>, Keys<Tables[Table]["Row"]>>, Exclude<Keys<Tables[Table]["Row"]>, Keys<Entity>>] extends [never, never]
  ? true
  : { table: Table; onlyInTypeScript: Exclude<Keys<Entity>, Keys<Tables[Table]["Row"]>>; onlyInDatabase: Exclude<Keys<Tables[Table]["Row"]>, Keys<Entity>> };

export const SCHEMA_PARITY: [
  Parity<E.OrganizationRow, "organizations">,
  Parity<E.UserRow, "users">,
  Parity<E.OrganizationMemberRow, "organization_members">,
  Parity<E.OrganizationSettingsRow, "organization_settings">,
  Parity<E.PropertyRow, "properties">,
  Parity<E.TransactionRow, "transactions">,
  Parity<E.LoanRow, "loans">,
  Parity<E.ClosingMilestoneRow, "closing_milestones">,
  Parity<E.ClosingBlockerRow, "closing_blockers">,
  Parity<E.DocumentRow, "documents">,
  Parity<E.DocumentRequestRow, "document_requests">,
  Parity<E.ClosingChecklistRow, "closing_checklists">,
  Parity<E.ObligationRow, "obligations">,
  Parity<E.AutopilotPlanRow, "autopilot_plans">,
  Parity<E.AutopilotRuleRow, "autopilot_rules">,
  Parity<E.OwnershipRecordRow, "ownership_records">,
  Parity<E.HomebookEntryRow, "homebook_entries">,
  Parity<E.FinancialConnectionRow, "financial_connections">,
  Parity<E.AccountRow, "accounts">,
  Parity<E.AccountTransactionRow, "account_transactions">,
  Parity<E.IntegrationProviderRow, "integration_providers">,
  Parity<E.IntegrationConnectionRow, "integration_connections">,
  Parity<E.McpClientRow, "mcp_clients">,
  Parity<E.McpConnectionRow, "mcp_connections">,
  Parity<E.McpPermissionRow, "mcp_permissions">,
  Parity<E.McpSessionRow, "mcp_sessions">,
  Parity<E.McpCredentialRow, "mcp_credentials">,
  Parity<E.OAuthAuthorizationCodeRow, "oauth_authorization_codes">,
  Parity<E.McpApprovalRow, "mcp_approvals">,
  Parity<E.McpAuditLogRow, "mcp_audit_logs">,
  Parity<E.McpRequestRow, "mcp_requests">,
  Parity<E.McpExecutionRow, "mcp_executions">,
  Parity<E.IdempotencyRecordRow, "idempotency_records">,
  Parity<E.WebhookEndpointRow, "webhook_endpoints">,
  Parity<WebhookSecretRecord, "webhook_endpoint_secrets">,
  Parity<E.WebhookEventRow, "webhook_events">,
  Parity<E.WebhookDeliveryRow, "webhook_deliveries">,
] = [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true];

import type { z } from "zod";
import type { McpApprovalRow, OrganizationSettingsRow, WebhookEventType } from "@/domain/entities";
import type { Environment } from "@/domain/environments";
import { toISODate } from "@/domain/dates";
import { canonicalJson, fingerprint, sha256Hex } from "@/server/crypto/hash";
import { FinancialDataService } from "@/server/integrations/financial/service";
import { ProviderUnavailableError, type FinancialDataProvider } from "@/server/integrations/financial/types";
import type { PaymentInstructionProvider } from "@/server/integrations/payments/types";
import type { Logger } from "@/server/observability/logger";
import type { Store, TenantScope } from "@/server/store/types";
import { envelopeVersion, majorVersion } from "@/server/tools/describe";
import { listTools, resolveTool } from "@/server/tools/registry";
import { scopedData } from "@/server/tools/scoped-data";
import { isApprovalPlan, type EmittedEvent, type ToolContext, type ToolOutcome, type ToolWarning } from "@/server/tools/types";
import { approvalEnvelopePart, buildApprovalRow, findOpenApproval, isApprovalForCaller, refreshExpiry } from "./approvals";
import { requesterKey, type Caller } from "./caller";
import type { ToolEnvelope } from "./envelope";
import { evaluatePolicy, isToolAvailable, type PolicyResult } from "./policy";
import { checkRateLimits } from "./rate-limit";

export interface EventPublisher {
  publish(scope: TenantScope, type: WebhookEventType, payload: Record<string, unknown>): Promise<void>;
}

export interface GatewayDeps {
  store: Store;
  clock(): Date;
  newId(): string;
  financialProviders: ReadonlyMap<string, FinancialDataProvider>;
  paymentsFor(environment: Environment): PaymentInstructionProvider | null;
  events: EventPublisher;
  /** Run work after the response is sent (webhooks, activity timestamps). */
  defer(task: () => Promise<void>): void;
  publicUrl: string;
  logger: Logger;
}

export interface ToolCallRequest {
  name: string;
  arguments?: unknown;
  /** Pin a major version; defaults to the latest active major. */
  version?: number;
  requestId?: string;
}

export interface ToolCallResult {
  envelope: ToolEnvelope;
  policy: PolicyResult | null;
  unknownTool: boolean;
}

const IDEMPOTENCY_TTL_MS = 24 * 3600_000;
const CONTROL_FIELDS = new Set(["approval_id", "idempotency_key"]);

class TimeoutError extends Error {}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(`Timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function withoutControlFields(args: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(args).filter(([k]) => !CONTROL_FIELDS.has(k)));
}

function mapValidationError(error: z.ZodError): { missing: string[]; invalid: { field: string; message: string }[] } {
  const missing: string[] = [];
  const invalid: { field: string; message: string }[] = [];
  for (const issue of error.issues) {
    const field = issue.path.map(String).join(".") || "arguments";
    if (issue.code === "invalid_type" && /received undefined/.test(issue.message)) missing.push(field);
    else if (issue.code === "unrecognized_keys") invalid.push({ field, message: `Unknown field(s): ${issue.keys.join(", ")}. Remove them; they are not part of this tool's contract.` });
    else invalid.push({ field, message: issue.message });
  }
  return { missing, invalid };
}

function effectStatement(environment: Environment, stateChanged: boolean): string {
  if (environment === "sandbox") return stateChanged ? "Sandbox records changed. No production changes made." : "No production changes made.";
  return stateChanged ? "Production records changed." : "No records changed.";
}

/** Build the context a tool handler receives. Everything is bound to the caller's tenant scope. */
function buildToolContext(
  deps: GatewayDeps,
  caller: Caller,
  settings: OrganizationSettingsRow,
  approval: McpApprovalRow | null,
  providersTouched: Set<string>,
  requestId: string,
): ToolContext {
  const scope: TenantScope = { organizationId: caller.organizationId, environment: caller.environment };
  const now = deps.clock();
  const touch = (id: string) => providersTouched.add(id);
  return {
    environment: caller.environment,
    organizationId: caller.organizationId,
    now,
    today: toISODate(now),
    requestId,
    principal: { userId: caller.userId, role: caller.role },
    client: { name: caller.client.name, type: caller.client.type, connectionId: caller.client.connectionId },
    scopes: new Set(caller.scopes),
    data: scopedData(deps.store, scope),
    financial: new FinancialDataService(deps.store, deps.financialProviders, scope, touch),
    payments: deps.paymentsFor(caller.environment),
    approval,
    authorization: {
      organizationName: caller.organization.name,
      organizationKind: caller.organization.kind,
      maxExecutionClass: caller.maxExecutionClass,
      sessionExpiresAt: caller.sessionExpiresAt,
      productionExecuteEnabled: settings.production_execute_enabled,
      approvalTtlMinutes: settings.approval_ttl_minutes,
    },
    describeAccess: () => {
      const available: string[] = [];
      const unavailable: { name: string; missing_scopes: typeof caller.scopes }[] = [];
      for (const t of listTools({ environment: caller.environment })) {
        const res = isToolAvailable(t, caller, settings, now);
        if (res.ok) available.push(t.name);
        else unavailable.push({ name: t.name, missing_scopes: res.missingScopes });
      }
      return { available, unavailable };
    },
    approvals: {
      get: async (id) => {
        const a = await deps.store.getApproval(caller.organizationId, id);
        return a && isApprovalForCaller(a, caller) ? refreshExpiry(deps.store, a, now) : null;
      },
      listPending: () => deps.store.listApprovals(caller.organizationId, { environment: caller.environment, status: ["pending"], limit: 50 }),
    },
    touchProvider: touch,
    newId: deps.newId,
  };
}

/**
 * Execute one tool call through the full control path:
 * resolve → rate limit → validate → policy → idempotency → approval → execute
 * → output contract → audit → events. Every path writes exactly one audit record.
 */
export async function callTool(deps: GatewayDeps, caller: Caller, request: ToolCallRequest): Promise<ToolCallResult> {
  const t0 = performance.now();
  const requestId = request.requestId ?? deps.newId();
  const auditId = deps.newId();
  const providersTouched = new Set<string>();
  const settings = await deps.store.getOrganizationSettings(caller.organizationId);
  const rawArgs = request.arguments ?? {};
  const argsObject = rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs) ? (rawArgs as Record<string, unknown>) : null;
  const argumentsHash = sha256Hex(canonicalJson(rawArgs));
  const tool = resolveTool(request.name, request.version);
  const toolName = tool?.name ?? request.name.slice(0, 64);

  let policy: PolicyResult | null = null;
  let approval: McpApprovalRow | null = null;
  let stateChanged = false;
  let idempotencyKey: string | undefined;
  let events: EmittedEvent[] = [];
  let executed = false;

  type EnvelopeParts = Omit<ToolEnvelope, "tool" | "version" | "environment" | "request_id" | "audit_id" | "meta" | "warnings" | "requires_approval"> & {
    warnings?: ToolWarning[];
    requires_approval?: boolean;
  };

  const finish = async (partial: EnvelopeParts, errorCode: string | null = null): Promise<ToolCallResult> => {
    const durationMs = Math.round(performance.now() - t0);
    const { status, ...rest } = partial;
    const envelope: ToolEnvelope = {
      status,
      tool: toolName,
      version: tool ? envelopeVersion(tool) : null,
      environment: caller.environment,
      request_id: requestId,
      audit_id: auditId,
      ...rest,
      warnings: partial.warnings ?? [],
      requires_approval: partial.requires_approval ?? partial.status === "approval_required",
      meta: {
        execution_class: tool?.executionClass ?? null,
        state_changed: stateChanged,
        duration_ms: durationMs,
        ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
      },
    };
    const outcomeText =
      envelope.status === "success" || envelope.status === "partial"
        ? effectStatement(caller.environment, stateChanged)
        : envelope.status === "approval_required"
          ? "Awaiting human approval. Nothing was executed."
          : `${envelope.status.replace("_", " ")}${errorCode ? ` (${errorCode})` : ""}. ${effectStatement(caller.environment, false)}`;
    await deps.store.appendAudit({
      id: auditId,
      organization_id: caller.organizationId,
      environment: caller.environment,
      user_id: caller.userId,
      connection_id: caller.client.connectionId,
      client_name: caller.client.name,
      client_type: caller.client.type,
      session_id: caller.sessionId,
      request_id: requestId,
      source: caller.source,
      tool_name: toolName,
      tool_version: tool ? majorVersion(tool) : null,
      execution_class: tool?.executionClass ?? null,
      arguments_hash: argumentsHash,
      scopes_used: tool ? tool.requiredScopes.filter((s) => caller.scopes.includes(s)) : [],
      policy_decision: policy?.decision ?? null,
      policy_reasons: policy?.reasons.map((r) => `${r.rule}: ${r.message}`) ?? [],
      approval_id: approval?.id ?? envelope.approval?.approval_id ?? null,
      approval_status: envelope.approval?.status ?? approval?.status ?? null,
      status: envelope.status,
      error_code: errorCode,
      duration_ms: durationMs,
      providers_touched: [...providersTouched],
      state_changed: stateChanged,
      summary: `${caller.client.name} used ${toolName}. ${outcomeText}`,
      ip_address: caller.ip,
      user_agent: caller.userAgent,
      created_at: deps.clock().toISOString(),
    });
    if (tool && executed && (tool.executionClass === "prepare" || tool.executionClass === "execute")) {
      await deps.store.insertExecution({
        id: deps.newId(),
        organization_id: caller.organizationId,
        environment: caller.environment,
        audit_id: auditId,
        approval_id: approval?.id ?? null,
        connection_id: caller.client.connectionId,
        user_id: caller.userId,
        tool_name: tool.name,
        tool_version: majorVersion(tool),
        execution_class: tool.executionClass,
        status: envelope.status,
        state_changed: stateChanged,
        providers_touched: [...providersTouched],
        duration_ms: durationMs,
        summary: envelope.summary ?? envelope.message ?? "",
        created_at: deps.clock().toISOString(),
      });
    }
    const scope = { organizationId: caller.organizationId, environment: caller.environment };
    const pending = [...events];
    const connectionId = caller.client.connectionId;
    deps.defer(async () => {
      for (const e of pending) await deps.events.publish(scope, e.type, { ...e.payload, audit_id: auditId });
      if (connectionId) await deps.store.updateConnection(connectionId, { last_activity_at: deps.clock().toISOString() });
    });
    return { envelope, policy, unknownTool: !tool };
  };

  // 1. Unknown tools are audited as denied: repeated probing is visible to the organization.
  if (!tool) {
    return finish({ status: "denied", message: `Unknown tool "${toolName}".`, error: { code: "unknown_tool", message: "The requested tool does not exist.", retryable: false } }, "unknown_tool");
  }

  // 2. Rate limits and loop protection.
  const callFingerprint = fingerprint(tool.name, majorVersion(tool), argsObject ? withoutControlFields(argsObject) : rawArgs);
  const limit = await checkRateLimits(deps.store, caller, tool, tool.name, settings, callFingerprint, deps.clock());
  if (!limit.ok) {
    return finish(
      { status: "denied", message: limit.message, error: { code: limit.code, message: limit.message, retryable: true, retry_after_seconds: limit.retryAfterSeconds } },
      limit.code,
    );
  }

  // 3. Input validation against the tool's schema.
  const parsed = tool.input.safeParse(argsObject ?? rawArgs);
  if (!parsed.success) {
    const { missing, invalid } = mapValidationError(parsed.error);
    return finish(
      {
        status: "needs_input",
        message: missing.length ? `Missing required input: ${missing.join(", ")}.` : "Some inputs are invalid. Correct them and call again.",
        ...(missing.length ? { missing_fields: missing } : {}),
        ...(invalid.length ? { invalid_fields: invalid } : {}),
      },
      "invalid_input",
    );
  }
  const input = parsed.data as Record<string, unknown>;

  // 4. Policy: authentication is not authorization.
  policy = evaluatePolicy({ tool, caller, settings, now: deps.clock() });
  if (policy.decision === "denied") {
    const denial = policy.reasons.find((r) => r.effect === "deny");
    return finish(
      {
        status: "denied",
        message: denial?.message ?? "Denied by policy.",
        policy: { decision: "denied", ...(policy.missingScopes.length ? { missing_scopes: policy.missingScopes } : {}) },
        error: { code: policy.code ?? "denied", message: denial?.message ?? "Denied by policy.", retryable: false },
      },
      policy.code,
    );
  }

  // 5. Idempotency for tools that create records.
  const requester = requesterKey(caller);
  const scope = { organizationId: caller.organizationId, environment: caller.environment };
  const semanticArgs = withoutControlFields(input);
  const semanticFingerprint = fingerprint(tool.name, majorVersion(tool), semanticArgs, requester, caller.environment);
  if (tool.idempotency === "key") {
    const provided = typeof input.idempotency_key === "string" ? input.idempotency_key : undefined;
    idempotencyKey = provided ?? `auto:${semanticFingerprint.slice(0, 32)}`;
    const existing = await deps.store.getIdempotencyRecord(scope, idempotencyKey, requester);
    if (existing && existing.expires_at > deps.clock().toISOString()) {
      if (existing.fingerprint !== semanticFingerprint) {
        return finish(
          {
            status: "failed",
            message: "This idempotency_key was already used with different arguments.",
            error: { code: "idempotency_conflict", message: "Use a new idempotency_key for a different request.", retryable: false },
          },
          "idempotency_conflict",
        );
      }
      const original = existing.response as unknown as ToolEnvelope;
      return finish({ ...stripEnvelope(original), replayed: true, warnings: [...original.warnings, { code: "replayed", message: "Returned the original result for this idempotency key; nothing was created again." }] });
    }
  }

  // 6. Approval gate. Transaction limits are enforced when the approval is requested.
  if (policy.decision === "approval_required") {
    const approvalId = typeof input.approval_id === "string" ? input.approval_id : null;
    if (approvalId) {
      const found = await deps.store.getApproval(caller.organizationId, approvalId);
      if (!found || !isApprovalForCaller(found, caller) || found.tool_name !== tool.name) {
        return finish(
          { status: "denied", message: "That approval_id does not belong to this connection and tool.", error: { code: "approval_not_found", message: "Unknown approval for this caller.", retryable: false } },
          "approval_not_found",
        );
      }
      approval = await refreshExpiry(deps.store, found, deps.clock());
      if (approval.fingerprint !== semanticFingerprint) {
        return finish(
          {
            status: "denied",
            message: "The approval covers different arguments. Call again with exactly the approved arguments, or request a new approval.",
            error: { code: "approval_mismatch", message: "Arguments do not match the approved request.", retryable: false },
          },
          "approval_mismatch",
        );
      }
      switch (approval.status) {
        case "pending":
          return finish({ status: "approval_required", message: "Approval is still pending. Wait for the user to decide in Sagolik.", approval: approvalEnvelopePart(approval, deps.publicUrl) });
        case "denied":
          return finish({ status: "denied", message: "The user denied this request.", approval: approvalEnvelopePart(approval, deps.publicUrl), error: { code: "approval_denied", message: "Denied by the user.", retryable: false } }, "approval_denied");
        case "expired":
          return finish({ status: "denied", message: "The approval expired before it was used.", approval: approvalEnvelopePart(approval, deps.publicUrl), error: { code: "approval_expired", message: "Request a new approval.", retryable: false } }, "approval_expired");
        case "failed":
          return finish({ status: "failed", message: "This approved request already failed. A new approval is required.", approval: approvalEnvelopePart(approval, deps.publicUrl), error: { code: "approval_failed", message: "Previously failed.", retryable: false } }, "approval_failed");
        case "completed": {
          const original = approval.result as unknown as ToolEnvelope | null;
          if (!original) {
            return finish({ status: "failed", message: "This approval is being executed by another request.", error: { code: "approval_in_use", message: "Retry shortly.", retryable: true } }, "approval_in_use");
          }
          return finish({ ...stripEnvelope(original), replayed: true, warnings: [...original.warnings, { code: "replayed", message: "This approval was already executed; the original result is returned." }] });
        }
        case "approved": {
          // Claim the approval before executing: single use, even under concurrent calls.
          const claimed = await deps.store.transitionApproval(caller.organizationId, approval.id, ["approved"], {
            status: "completed",
            consumed_at: deps.clock().toISOString(),
            updated_at: deps.clock().toISOString(),
          });
          if (!claimed) {
            return finish({ status: "failed", message: "This approval was consumed by another request.", error: { code: "approval_in_use", message: "Retry to receive the original result.", retryable: true } }, "approval_in_use");
          }
          approval = claimed;
          break;
        }
      }
    } else {
      if (!tool.describeApproval) throw new Error(`${tool.name} requires approval but cannot describe it`);
      const ctx = buildToolContext(deps, caller, settings, null, providersTouched, requestId);
      const planOrOutcome = await withTimeout(tool.describeApproval(ctx, input), tool.timeoutMs);
      if (!isApprovalPlan(planOrOutcome)) return finish(outcomeToPartial(planOrOutcome), outcomeCode(planOrOutcome));
      const limited = evaluatePolicy({ tool, caller, settings, now: deps.clock(), amountCents: planOrOutcome.amountCents });
      if (limited.decision === "denied") {
        policy = limited;
        const denial = limited.reasons.find((r) => r.effect === "deny");
        return finish({ status: "denied", message: denial?.message ?? "Denied by policy.", policy: { decision: "denied" }, error: { code: limited.code ?? "denied", message: denial?.message ?? "Denied.", retryable: false } }, limited.code);
      }
      const open = await findOpenApproval(deps.store, caller, tool, semanticFingerprint, deps.clock());
      const row =
        open ??
        (await deps.store.insertApproval(
          buildApprovalRow({ id: deps.newId(), caller, tool, toolArguments: semanticArgs, fingerprint: semanticFingerprint, plan: planOrOutcome, settings, now: deps.clock() }),
        ));
      if (!open) {
        events = [{ type: "approval.requested", payload: { approval_id: row.id, tool: tool.name, summary: row.summary, expires_at: row.expires_at } }];
      }
      approval = row;
      return finish({
        status: "approval_required",
        message: row.summary,
        approval: approvalEnvelopePart(row, deps.publicUrl),
        warnings: open ? [{ code: "existing_approval", message: "An identical request is already awaiting approval; no new request was created." }] : [],
      });
    }
  }

  // 7. Execute.
  const ctx = buildToolContext(deps, caller, settings, approval, providersTouched, requestId);
  let outcome: ToolOutcome<unknown>;
  executed = true;
  try {
    outcome = await withTimeout(tool.handler(ctx, input), tool.timeoutMs);
  } catch (error) {
    const code = error instanceof TimeoutError ? "timeout" : error instanceof ProviderUnavailableError ? "provider_unavailable" : "internal_error";
    deps.logger.error("tool execution failed", { requestId, tool: tool.name, code, error });
    approval = await settleApproval(deps, caller, approval, "failed", null);
    if (code === "provider_unavailable") {
      return finish({ status: "unavailable", message: "An external provider is temporarily unavailable.", error: { code, message: "Provider unavailable.", retryable: true } }, code);
    }
    return finish(
      {
        status: "failed",
        message: code === "timeout" ? "The tool did not complete in time." : "The tool failed unexpectedly. The failure has been recorded.",
        error: { code, message: code === "timeout" ? `Exceeded ${tool.timeoutMs}ms.` : `Reference ${requestId} when contacting Sagolik.`, retryable: code === "timeout" },
      },
      code,
    );
  }

  // 8. Output contract.
  if (outcome.status === "success" || outcome.status === "partial") {
    const checked = tool.output.safeParse(outcome.data);
    if (!checked.success) {
      deps.logger.error("tool output violated its schema", { requestId, tool: tool.name, issues: checked.error.issues.slice(0, 5) });
      stateChanged = outcome.stateChanged ?? false;
      approval = await settleApproval(deps, caller, approval, "failed", null);
      return finish(
        { status: "failed", message: "The tool produced an invalid response. The failure has been recorded.", error: { code: "output_contract_violation", message: `Reference ${requestId}.`, retryable: false } },
        "output_contract_violation",
      );
    }
    stateChanged = outcome.stateChanged ?? false;
    events = [...events, ...(outcome.events ?? [])];
    // Return the parsed value so the payload conforms exactly to the published output schema.
    outcome = { ...outcome, data: checked.data };
  }

  const succeeded = outcome.status === "success" || outcome.status === "partial";
  if (approval) approval = { ...approval, status: succeeded ? "completed" : "failed" };
  const result = await finish(outcomeToPartial(outcome), outcomeCode(outcome));

  // 9. Persist results for replay: idempotency records and approvals.
  if (approval) {
    await settleApproval(deps, caller, approval, succeeded ? "completed" : "failed", result.envelope);
    deps.defer(() => deps.events.publish(scope, "approval.completed", { approval_id: approval!.id, tool: tool.name, status: succeeded ? "completed" : "failed", audit_id: auditId }));
  }
  if (tool.idempotency === "key" && idempotencyKey && succeeded) {
    await deps.store.putIdempotencyRecord({
      id: deps.newId(),
      organization_id: caller.organizationId,
      environment: caller.environment,
      idempotency_key: idempotencyKey,
      tool_name: tool.name,
      requester,
      fingerprint: semanticFingerprint,
      response: result.envelope as unknown as Record<string, unknown>,
      created_at: deps.clock().toISOString(),
      expires_at: new Date(deps.clock().getTime() + IDEMPOTENCY_TTL_MS).toISOString(),
    });
  }
  return result;
}

async function settleApproval(
  deps: GatewayDeps,
  caller: Caller,
  approval: McpApprovalRow | null,
  status: "completed" | "failed",
  envelope: ToolEnvelope | null,
): Promise<McpApprovalRow | null> {
  if (!approval) return null;
  const updated = await deps.store.transitionApproval(caller.organizationId, approval.id, ["completed", "approved"], {
    status,
    result: envelope as unknown as Record<string, unknown> | null,
    updated_at: deps.clock().toISOString(),
  });
  return updated ?? { ...approval, status };
}

/** Remove per-call identifiers so a stored envelope can be replayed under a new request and audit id. */
function stripEnvelope(envelope: ToolEnvelope) {
  const { tool: _t, version: _v, environment: _e, request_id: _r, audit_id: _a, meta: _m, requires_approval, ...rest } = envelope;
  return { ...rest, requires_approval };
}

function outcomeToPartial(outcome: ToolOutcome<unknown>) {
  switch (outcome.status) {
    case "success":
    case "partial":
      return { status: outcome.status, summary: outcome.summary, data: outcome.data, warnings: outcome.warnings ?? [] };
    case "denied":
      return {
        status: "denied" as const,
        message: outcome.message,
        policy: { decision: "denied" as const, missing_scopes: outcome.missing_scopes },
        error: { code: "insufficient_scope", message: outcome.message, retryable: false },
      };
    case "needs_input":
      return { status: "needs_input" as const, message: outcome.message, missing_fields: outcome.missing_fields, ...(outcome.options ? { clarification: { options: outcome.options } } : {}) };
    case "needs_clarification":
      return { status: "needs_clarification" as const, message: outcome.message, clarification: { ...(outcome.field ? { field: outcome.field } : {}), ...(outcome.options ? { options: outcome.options } : {}) } };
    case "unavailable":
      return { status: "unavailable" as const, message: outcome.message, error: { code: outcome.reason, message: outcome.message, retryable: true } };
  }
}

function outcomeCode(outcome: ToolOutcome<unknown>): string | null {
  switch (outcome.status) {
    case "denied":
      return "insufficient_scope";
    case "unavailable":
      return outcome.reason;
    case "needs_input":
      return "needs_input";
    case "needs_clarification":
      return "needs_clarification";
    default:
      return null;
  }
}

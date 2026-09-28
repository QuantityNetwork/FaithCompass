import { isErrorEnvelope, type ToolEnvelope } from "@/server/gateway/envelope";
import { callTool, type GatewayDeps } from "@/server/gateway/gateway";
import type { Caller } from "@/server/gateway/caller";
import { isToolAvailable } from "@/server/gateway/policy";
import { composeToolDescription, inputJsonSchema, majorVersion, outputJsonSchema } from "@/server/tools/describe";
import { listTools } from "@/server/tools/registry";
import type { AnyTool } from "@/server/tools/types";

export const SUPPORTED_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"] as const;
export const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

export const SERVER_INFO = {
  name: "sagolik-mcp",
  title: "Sagolik MCP",
  version: "1.0.0",
  websiteUrl: "https://mcp.sagolik.com",
};

export const SERVER_INSTRUCTIONS = [
  "Sagolik MCP is the agent interface to Sagolik: property, financing, closing, ownership and Autopilot.",
  "Operating model: KNOW → ANALYZE → SIMULATE → PREPARE → APPROVE → EXECUTE → AUDIT.",
  "Every tool returns a structured envelope with a status. Act on it:",
  "- needs_input / needs_clarification: ask the user; never guess identifiers, amounts or accounts.",
  "- approval_required: show the user the approval summary and wait until they approve in Sagolik, then call the same tool again with approval_id.",
  "- denied: explain which permission is missing; do not retry.",
  "READ and SIMULATE tools never change records. PREPARE tools create drafts only. EXECUTE tools always require human approval.",
  "Call get_authorization_context to learn what this connection may do.",
].join("\n");

export const JSONRPC_ERRORS = {
  parse: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internal: -32603,
} as const;

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: string | number | null; result: unknown }
  | { jsonrpc: "2.0"; id: string | number | null; error: { code: number; message: string; data?: unknown } };

const rpcError = (id: JsonRpcResponse["id"], code: number, message: string, data?: unknown): JsonRpcResponse => ({
  jsonrpc: "2.0",
  id,
  error: { code, message, ...(data !== undefined ? { data } : {}) },
});

/** JSON Schema for the envelope returned as structuredContent, with `data` typed per tool. */
export function envelopeOutputSchema(tool: AnyTool): Record<string, unknown> {
  const str = { type: "string" };
  const nullableStr = { type: ["string", "null"] };
  return {
    type: "object",
    properties: {
      status: { type: "string", enum: ["success", "partial", "needs_input", "needs_clarification", "approval_required", "denied", "failed", "unavailable"] },
      tool: str,
      version: nullableStr,
      environment: { type: "string", enum: ["sandbox", "production"] },
      request_id: str,
      audit_id: str,
      summary: str,
      message: str,
      data: outputJsonSchema(tool),
      warnings: { type: "array", items: { type: "object", properties: { code: str, message: str }, required: ["code", "message"] } },
      requires_approval: { type: "boolean" },
      approval: {
        type: "object",
        properties: { approval_id: str, status: str, summary: str, expires_at: str, review_url: str, next_step: str },
        required: ["approval_id", "status", "summary", "expires_at", "review_url", "next_step"],
      },
      missing_fields: { type: "array", items: str },
      invalid_fields: { type: "array", items: { type: "object", properties: { field: str, message: str } } },
      clarification: { type: "object" },
      policy: { type: "object" },
      error: { type: "object", properties: { code: str, message: str, retryable: { type: "boolean" } }, required: ["code", "message", "retryable"] },
      replayed: { type: "boolean" },
      meta: { type: "object" },
    },
    required: ["status", "tool", "environment", "request_id", "audit_id", "warnings", "requires_approval", "meta"],
  };
}

export function mcpToolDefinition(tool: AnyTool) {
  const cls = tool.executionClass;
  const external = tool.providers.length > 0;
  return {
    name: tool.name,
    title: tool.title,
    description: composeToolDescription(tool),
    inputSchema: inputJsonSchema(tool),
    outputSchema: envelopeOutputSchema(tool),
    annotations: {
      title: tool.title,
      readOnlyHint: cls === "read" || cls === "simulate",
      destructiveHint: cls === "execute",
      idempotentHint: cls !== "execute" || tool.idempotency === "approval",
      openWorldHint: cls === "execute" || external,
    },
    _meta: {
      "sagolik/execution_class": cls,
      "sagolik/version": tool.version,
      "sagolik/required_scopes": tool.requiredScopes,
      "sagolik/approval_required": tool.approvalRequired,
      "sagolik/status": tool.status,
    },
  };
}

function negotiateVersion(requested: unknown): string {
  return typeof requested === "string" && (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested) ? requested : LATEST_PROTOCOL_VERSION;
}

export function toolCallResult(envelope: ToolEnvelope) {
  return {
    content: [{ type: "text", text: JSON.stringify(envelope) }],
    structuredContent: envelope,
    isError: isErrorEnvelope(envelope),
  };
}

/**
 * Handle one JSON-RPC message for an authenticated caller. Returns null for
 * notifications. Tool visibility is filtered by the caller's grant so agents
 * only discover what they may actually invoke.
 */
export async function handleMessage(deps: GatewayDeps, caller: Caller, message: unknown): Promise<JsonRpcResponse | null> {
  if (!message || typeof message !== "object" || Array.isArray(message)) return rpcError(null, JSONRPC_ERRORS.invalidRequest, "Invalid request");
  const req = message as Partial<JsonRpcRequest>;
  const id = req.id ?? null;
  const isNotification = !("id" in req) || req.id === undefined;
  if (req.jsonrpc !== "2.0" || typeof req.method !== "string") return isNotification ? null : rpcError(id, JSONRPC_ERRORS.invalidRequest, "Invalid request");
  if (isNotification) return null;
  const params = (req.params && typeof req.params === "object" ? req.params : {}) as Record<string, unknown>;

  switch (req.method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: negotiateVersion(params.protocolVersion),
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: SERVER_INSTRUCTIONS,
        },
      };
    case "ping":
      return { jsonrpc: "2.0", id, result: {} };
    case "tools/list": {
      const settings = await deps.store.getOrganizationSettings(caller.organizationId);
      const now = deps.clock();
      const tools = listTools({ environment: caller.environment })
        .filter((t) => isToolAvailable(t, caller, settings, now).ok)
        .map(mcpToolDefinition);
      return { jsonrpc: "2.0", id, result: { tools } };
    }
    case "tools/call": {
      const name = params.name;
      if (typeof name !== "string" || !name) return rpcError(id, JSONRPC_ERRORS.invalidParams, "params.name is required");
      const meta = (params._meta && typeof params._meta === "object" ? params._meta : {}) as Record<string, unknown>;
      const pinned = typeof meta["sagolik/tool_version"] === "number" ? (meta["sagolik/tool_version"] as number) : undefined;
      const result = await callTool(deps, caller, { name, arguments: params.arguments, version: pinned });
      if (result.unknownTool) return rpcError(id, JSONRPC_ERRORS.invalidParams, `Unknown tool: ${name}`, { audit_id: result.envelope.audit_id });
      return { jsonrpc: "2.0", id, result: toolCallResult(result.envelope) };
    }
    default:
      return rpcError(id, JSONRPC_ERRORS.methodNotFound, `Method not found: ${req.method}`);
  }
}

export function toolVersionLabel(tool: AnyTool): string {
  return `${tool.name}@${majorVersion(tool)}`;
}

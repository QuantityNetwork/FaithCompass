import type { Environment } from "@/domain/environments";
import { authenticateBearer } from "@/server/auth/bearer";
import type { GatewayDeps } from "@/server/gateway/gateway";
import { handleMessage, JSONRPC_ERRORS, SUPPORTED_PROTOCOL_VERSIONS, type JsonRpcResponse } from "./protocol";

const MAX_BODY_BYTES = 1_000_000;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS_HEADERS, ...headers },
  });
}

export function protectedResourceMetadataUrl(publicUrl: string, environment: Environment): string {
  return `${publicUrl}/.well-known/oauth-protected-resource${environment === "sandbox" ? "/sandbox/mcp" : "/mcp"}`;
}

function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded ? (forwarded.split(",")[0]?.trim() ?? null) : request.headers.get("x-real-ip");
}

/**
 * Streamable HTTP transport for the MCP endpoint (stateless JSON mode).
 * POST carries JSON-RPC; GET is not offered (no server-initiated streams).
 * Every request must carry a bearer token bound to this endpoint's environment.
 */
export async function handleMcpHttp(request: Request, environment: Environment, deps: GatewayDeps): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (request.method !== "POST") {
    return json(
      { jsonrpc: "2.0", id: null, error: { code: JSONRPC_ERRORS.invalidRequest, message: "Use POST. This server does not offer a server-initiated event stream." } },
      405,
      { Allow: "POST, OPTIONS" },
    );
  }

  const version = request.headers.get("mcp-protocol-version");
  if (version && !(SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(version)) {
    return json({ jsonrpc: "2.0", id: null, error: { code: JSONRPC_ERRORS.invalidRequest, message: `Unsupported MCP-Protocol-Version: ${version}` } }, 400);
  }
  if (!(request.headers.get("content-type") ?? "").includes("application/json")) {
    return json({ jsonrpc: "2.0", id: null, error: { code: JSONRPC_ERRORS.invalidRequest, message: "Content-Type must be application/json" } }, 415);
  }

  const auth = await authenticateBearer(deps.store, request.headers.get("authorization"), environment, deps.clock(), {
    ip: clientIp(request),
    userAgent: request.headers.get("user-agent"),
  });
  if (!auth.ok) {
    const challenge = `Bearer resource_metadata="${protectedResourceMetadataUrl(deps.publicUrl, environment)}"${auth.error === "invalid_token" ? `, error="invalid_token", error_description="${auth.description.replace(/"/g, "'")}"` : ""}`;
    return json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: auth.description } }, 401, { "WWW-Authenticate": challenge });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json({ jsonrpc: "2.0", id: null, error: { code: JSONRPC_ERRORS.invalidRequest, message: "Request body too large" } }, 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: JSONRPC_ERRORS.parse, message: "Parse error" } }, 400);
  }

  const sessionId = auth.caller.sessionId;
  if (sessionId) deps.defer(async () => void (await deps.store.updateSession(sessionId, { last_seen_at: deps.clock().toISOString(), ip_address: auth.caller.ip, user_agent: auth.caller.userAgent })));

  const messages = Array.isArray(body) ? body : [body];
  if (messages.length === 0 || messages.length > 20) {
    return json({ jsonrpc: "2.0", id: null, error: { code: JSONRPC_ERRORS.invalidRequest, message: "Batch must contain 1–20 messages" } }, 400);
  }
  const responses: JsonRpcResponse[] = [];
  for (const message of messages) {
    try {
      const response = await handleMessage(deps, auth.caller, message);
      if (response) responses.push(response);
    } catch (error) {
      deps.logger.error("mcp message failed", { error });
      const id = message && typeof message === "object" && "id" in message ? ((message as { id: string | number | null }).id ?? null) : null;
      responses.push({ jsonrpc: "2.0", id, error: { code: JSONRPC_ERRORS.internal, message: "Internal error" } });
    }
  }
  if (responses.length === 0) return new Response(null, { status: 202, headers: CORS_HEADERS });
  return json(Array.isArray(body) ? responses : responses[0], 200, { "Mcp-Protocol-Version": version ?? SUPPORTED_PROTOCOL_VERSIONS[0] });
}

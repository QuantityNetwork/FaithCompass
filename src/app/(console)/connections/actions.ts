"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { CLIENT_TYPES } from "@/domain/clients";
import { ENVIRONMENTS, ENVIRONMENT_META } from "@/domain/environments";
import { SCOPES } from "@/domain/scopes";
import { canAdminister, requireConsoleSession, scopesForRole } from "@/server/auth/console";
import { createConnection, issueConnectionToken, revokeConnection } from "@/server/auth/connections";
import { handleMcpHttp } from "@/server/mcp/http";
import { resolveTool } from "@/server/tools/registry";
import { getRuntime, publicUrlFrom } from "@/server/runtime";

const EXPIRY_DAYS = { "1": 1, "7": 7, "30": 30, "90": 90 } as const;

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  environment: z.enum(ENVIRONMENTS),
  clientType: z.enum(CLIENT_TYPES),
  scopes: z.array(z.enum(SCOPES)).min(1),
  expiresInDays: z.enum(["1", "7", "30", "90"]),
  transactionLimit: z.number().positive().max(10_000_000).nullable(),
});

export type CreateConnectionResult =
  | { ok: true; connectionId: string; token: string; tokenPrefix: string; endpoint: string; expiresAt: string | null }
  | { ok: false; error: string };

/** Create a token-authenticated connection. The token is returned exactly once. */
export async function createConnectionAction(input: z.input<typeof createSchema>): Promise<CreateConnectionResult> {
  const session = await requireConsoleSession();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the connection details and try again." };
  const data = parsed.data;
  const runtime = getRuntime();
  if (data.environment === "production" && runtime.mode === "demo") return { ok: false, error: "Production is unavailable in demo mode." };
  if (data.environment === "production" && !canAdminister(session.role)) return { ok: false, error: "Only owners and administrators can create production connections." };
  const allowed = new Set(scopesForRole(session.role));
  const denied = data.scopes.filter((s) => !allowed.has(s));
  if (denied.length) return { ok: false, error: `Your role cannot grant: ${denied.join(", ")}.` };

  const expiresAt = new Date(Date.now() + EXPIRY_DAYS[data.expiresInDays] * 86_400_000).toISOString();
  const connection = await createConnection(runtime.store, runtime.clock, {
    organizationId: session.organization.id,
    environment: data.environment,
    userId: session.user.id,
    name: data.name,
    clientType: data.clientType,
    authMethod: "token",
    scopes: data.scopes,
    transactionLimitCents: data.transactionLimit ? Math.round(data.transactionLimit * 100) : null,
    expiresAt,
  });
  const { token, session: tokenSession } = await issueConnectionToken(runtime.store, runtime.clock, connection);
  const origin = publicUrlFrom({ headers: await headers() });
  return { ok: true, connectionId: connection.id, token, tokenPrefix: tokenSession.token_prefix, endpoint: `${origin}${ENVIRONMENT_META[data.environment].mcpPath}`, expiresAt };
}

export type TestResult =
  | { ok: true; protocolVersion: string; serverName: string; tools: number; envelope?: unknown; latencyMs: number }
  | { ok: false; error: string };

/**
 * Test a freshly issued token exactly as an agent would: through the MCP
 * HTTP handler, with bearer authentication, policy evaluation and audit.
 */
export async function testConnectionAction(input: { token: string; environment: string; runTool?: boolean }): Promise<TestResult> {
  await requireConsoleSession();
  const environment = z.enum(ENVIRONMENTS).safeParse(input.environment);
  if (!environment.success || typeof input.token !== "string") return { ok: false, error: "Invalid test request." };
  const runtime = getRuntime();
  const origin = publicUrlFrom({ headers: await headers() });
  const deps = runtime.gateway(origin);
  const endpoint = `${origin}${ENVIRONMENT_META[environment.data].mcpPath}`;
  const post = async (body: unknown) => {
    const res = await handleMcpHttp(
      new Request(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: `Bearer ${input.token}`, "User-Agent": "Sagolik Console (connection test)" },
        body: JSON.stringify(body),
      }),
      environment.data,
      deps,
    );
    return { status: res.status, body: (await res.json().catch(() => null)) as Record<string, any> | null }; // eslint-disable-line @typescript-eslint/no-explicit-any
  };
  const started = performance.now();
  const init = await post({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "sagolik-console-test", version: "1.0" } } });
  if (init.status !== 200) return { ok: false, error: init.body?.error?.message ?? `Endpoint responded with HTTP ${init.status}.` };
  const list = await post({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  const tools = (list.body?.result?.tools ?? []) as { name: string }[];
  let envelope: unknown;
  if (input.runTool) {
    // A harmless READ. If Sagolik asks which property, follow up the way an agent would.
    const first = await post({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "get_closing_status", arguments: {} } });
    envelope = first.body?.result?.structuredContent ?? first.body?.error;
    const options = (envelope as { status?: string; clarification?: { options?: { value: string }[] } } | undefined)?.clarification?.options;
    if ((envelope as { status?: string })?.status === "needs_input" && options?.length === 1) {
      const second = await post({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "get_closing_status", arguments: { property_id: options[0]!.value } } });
      envelope = second.body?.result?.structuredContent ?? second.body?.error;
    }
  }
  return {
    ok: true,
    protocolVersion: init.body?.result?.protocolVersion,
    serverName: init.body?.result?.serverInfo?.title ?? "Sagolik MCP",
    tools: tools.length,
    envelope,
    latencyMs: Math.round(performance.now() - started),
  };
}

export async function revokeConnectionAction(connectionId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await requireConsoleSession();
  const runtime = getRuntime();
  const connection = await runtime.store.getConnection(connectionId);
  if (!connection || connection.organization_id !== session.organization.id) return { ok: false, error: "Connection not found." };
  if (connection.user_id !== session.user.id && !canAdminister(session.role)) return { ok: false, error: "Only the owner of this connection or an administrator can revoke it." };
  await revokeConnection(runtime.store, runtime.clock, connection.id, session.user.id);
  refresh();
  return { ok: true };
}

export async function setToolEnabledAction(connectionId: string, toolName: string, enabled: boolean): Promise<{ ok: boolean; error?: string }> {
  const session = await requireConsoleSession();
  const runtime = getRuntime();
  const connection = await runtime.store.getConnection(connectionId);
  if (!connection || connection.organization_id !== session.organization.id) return { ok: false, error: "Connection not found." };
  if (connection.user_id !== session.user.id && !canAdminister(session.role)) return { ok: false, error: "Not permitted." };
  if (!resolveTool(toolName)) return { ok: false, error: "Unknown tool." };
  await runtime.store.setToolPermission({ connection, toolName, effect: enabled ? null : "deny", createdBy: session.user.id, now: new Date().toISOString(), id: crypto.randomUUID() });
  refresh();
  return { ok: true };
}

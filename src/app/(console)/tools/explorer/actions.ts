"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { ENVIRONMENTS } from "@/domain/environments";
import { consoleCaller, requireConsoleSession } from "@/server/auth/console";
import { callerForConnection } from "@/server/auth/bearer";
import type { ToolEnvelope } from "@/server/gateway/envelope";
import { callTool } from "@/server/gateway/gateway";
import type { PolicyReason } from "@/server/gateway/policy";
import { getRuntime, publicUrlFrom } from "@/server/runtime";

const schema = z.object({
  tool: z.string().min(1).max(64),
  arguments: z.record(z.string(), z.unknown()),
  environment: z.enum(ENVIRONMENTS),
  connectionId: z.string().uuid().nullable(),
});

export interface ExplorerRun {
  envelope: ToolEnvelope;
  request: unknown;
  latencyMs: number;
  policy: { decision: string | null; reasons: PolicyReason[]; missingScopes: string[] };
  caller: { name: string; scopes: string[]; maxExecutionClass: string };
}

/**
 * Run a tool from the console through the same gateway agents use: identical
 * validation, policy, approvals, idempotency and audit. "Run as" a connection
 * evaluates that connection's grant; the audit records that it came from the
 * console.
 */
export async function runToolAction(input: z.input<typeof schema>): Promise<{ ok: true; run: ExplorerRun } | { ok: false; error: string }> {
  const session = await requireConsoleSession();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { tool, arguments: args, environment, connectionId } = parsed.data;
  const runtime = getRuntime();
  if (environment === "production" && runtime.mode === "demo") return { ok: false, error: "Production is unavailable in demo mode." };

  let caller = consoleCaller(session, environment);
  if (connectionId) {
    const connection = await runtime.store.getConnection(connectionId);
    if (!connection || connection.organization_id !== session.organization.id || connection.status !== "active") return { ok: false, error: "Connection not found or inactive." };
    if (connection.environment !== environment) return { ok: false, error: `${connection.name} is a ${connection.environment} connection.` };
    const asConnection = await callerForConnection(runtime.store, connection, { sessionId: null, sessionExpiresAt: connection.expires_at, ip: null, userAgent: "Sagolik Console (Tool Explorer)" });
    if (!asConnection) return { ok: false, error: "The connection's user is no longer a member." };
    caller = { ...asConnection, source: "console", client: { ...asConnection.client, name: `${connection.name} via Tool Explorer` } };
  }

  const deps = runtime.gateway(publicUrlFrom({ headers: await headers() }));
  const started = performance.now();
  const result = await callTool(deps, caller, { name: tool, arguments: args });
  return {
    ok: true,
    run: {
      envelope: result.envelope,
      request: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: tool, arguments: args } },
      latencyMs: Math.round(performance.now() - started),
      policy: {
        decision: result.policy?.decision ?? null,
        reasons: result.policy?.reasons ?? [],
        missingScopes: result.policy?.missingScopes ?? [],
      },
      caller: { name: caller.client.name, scopes: caller.scopes, maxExecutionClass: caller.maxExecutionClass },
    },
  };
}

import type { McpConnectionRow } from "@/domain/entities";
import type { Environment } from "@/domain/environments";
import type { Caller } from "@/server/gateway/caller";
import type { Store } from "@/server/store/types";
import { hashToken, parseToken } from "./tokens";

export type BearerFailure = { ok: false; error: "invalid_request" | "invalid_token"; description: string };
export type BearerResult = { ok: true; caller: Caller } | BearerFailure;

const fail = (error: BearerFailure["error"], description: string): BearerFailure => ({ ok: false, error, description });

/**
 * Resolve a bearer token into a caller. Checks, in order: format, environment
 * binding (sandbox tokens never reach production and vice versa), credential,
 * session, connection status and expiry, and current organization membership.
 */
export async function authenticateBearer(
  store: Store,
  authorization: string | null,
  endpointEnvironment: Environment,
  now: Date,
  meta: { ip: string | null; userAgent: string | null },
): Promise<BearerResult> {
  if (!authorization) return fail("invalid_request", "Missing bearer token.");
  const match = /^Bearer\s+(\S+)$/i.exec(authorization.trim());
  if (!match) return fail("invalid_request", "Authorization header must use the Bearer scheme.");
  const token = match[1]!;
  const parsed = parseToken(token);
  if (!parsed || parsed.kind === "rt") return fail("invalid_token", "Malformed or unsupported token.");
  if (parsed.environment !== endpointEnvironment) {
    return fail("invalid_token", `This token belongs to ${parsed.environment} and cannot be used with the ${endpointEnvironment} endpoint.`);
  }
  const iso = now.toISOString();
  const credential = await store.findCredentialByHash(hashToken(token));
  if (!credential || credential.kind !== "access") return fail("invalid_token", "Unknown token.");
  if (credential.expires_at <= iso) return fail("invalid_token", "The access token has expired.");
  const session = await store.getSession(credential.session_id);
  if (!session || session.revoked_at) return fail("invalid_token", "The session has been revoked.");
  if (session.environment !== endpointEnvironment) return fail("invalid_token", "Environment mismatch.");
  const connection = await store.getConnection(session.connection_id);
  if (!connection || connection.status !== "active" || connection.revoked_at) return fail("invalid_token", "The connection has been revoked.");
  if (connection.expires_at && connection.expires_at <= iso) return fail("invalid_token", "The connection has expired.");
  const expiries = [credential.expires_at, connection.expires_at].filter((v): v is string => !!v).sort();
  const caller = await callerForConnection(store, connection, { sessionId: session.id, sessionExpiresAt: expiries[0] ?? null, ...meta });
  return caller ? { ok: true, caller } : fail("invalid_token", "The granting user is no longer a member of the organization.");
}

/**
 * Build the caller for a connection. Role and organization are re-read on
 * every request, so removing a member or downgrading a role takes effect
 * immediately for their agents.
 */
export async function callerForConnection(
  store: Store,
  connection: McpConnectionRow,
  meta: { sessionId: string | null; sessionExpiresAt: string | null; ip: string | null; userAgent: string | null },
): Promise<Caller | null> {
  const [membership, organization, permissions] = await Promise.all([
    store.getMembership(connection.organization_id, connection.user_id),
    store.getOrganization(connection.organization_id),
    store.listToolPermissions(connection.id),
  ]);
  if (!membership || !organization) return null;
  return {
    source: "mcp",
    organizationId: organization.id,
    organization: { name: organization.name, kind: organization.kind },
    environment: connection.environment,
    userId: connection.user_id,
    role: membership.role,
    client: { name: connection.name, type: connection.client_type, connectionId: connection.id, clientId: connection.client_id },
    sessionId: meta.sessionId,
    scopes: connection.scopes,
    deniedTools: permissions.filter((p) => p.effect === "deny").map((p) => p.tool_name),
    maxExecutionClass: connection.max_execution_class,
    transactionLimitCents: connection.transaction_limit_cents,
    sessionExpiresAt: meta.sessionExpiresAt,
    ip: meta.ip,
    userAgent: meta.userAgent?.slice(0, 256) ?? null,
  };
}

import type { ClientType } from "@/domain/clients";
import { CLIENT_META } from "@/domain/clients";
import type { McpConnectionRow, McpSessionRow } from "@/domain/entities";
import type { Environment } from "@/domain/environments";
import { classRank, type ExecutionClass } from "@/domain/execution-classes";
import { SCOPE_DEFINITIONS, sortScopes, type Scope } from "@/domain/scopes";
import type { GatewayStore } from "@/server/store/types";
import { mintToken } from "./tokens";

export interface Clock {
  now(): Date;
  newId(): string;
}

/** The highest execution class implied by a set of scopes. */
export function ceilingForScopes(scopes: Scope[]): ExecutionClass {
  return scopes.reduce<ExecutionClass>((acc, s) => {
    const cls = SCOPE_DEFINITIONS[s].executionClass;
    return classRank(cls) > classRank(acc) ? cls : acc;
  }, "read");
}

export interface NewConnection {
  organizationId: string;
  environment: Environment;
  userId: string;
  name: string;
  clientType: ClientType;
  authMethod: "oauth" | "token";
  scopes: Scope[];
  clientId?: string;
  transactionLimitCents?: number | null;
  expiresAt: string | null;
  isDemo?: boolean;
}

/**
 * Create a connection: the grant that binds one client to one user, one
 * organization and one environment with an explicit scope set. Wildcards do
 * not exist; the execution-class ceiling is derived from the granted scopes.
 */
export async function createConnection(store: GatewayStore, clock: Clock, input: NewConnection): Promise<McpConnectionRow> {
  const scopes = sortScopes(input.scopes);
  if (scopes.length === 0) throw new Error("A connection requires at least one scope");
  const now = clock.now().toISOString();
  let clientId = input.clientId;
  if (!clientId) {
    const client = await store.insertClient({
      id: clock.newId(),
      organization_id: input.organizationId,
      client_name: input.name,
      client_type: input.clientType,
      redirect_uris: [],
      token_endpoint_auth_method: "none",
      client_secret_hash: null,
      registration_source: "console",
      created_at: now,
    });
    clientId = client.id;
  }
  return store.insertConnection({
    id: clock.newId(),
    organization_id: input.organizationId,
    environment: input.environment,
    user_id: input.userId,
    client_id: clientId,
    name: input.name.trim().slice(0, 80) || CLIENT_META[input.clientType].label,
    client_type: input.clientType,
    auth_method: input.authMethod,
    status: "active",
    scopes,
    max_execution_class: ceilingForScopes(scopes),
    transaction_limit_cents: input.transactionLimitCents ?? null,
    expires_at: input.expiresAt,
    revoked_at: null,
    revoked_by: null,
    last_connected_at: null,
    last_activity_at: null,
    is_demo: input.isDemo ?? false,
    created_at: now,
    updated_at: now,
  });
}

/** Issue a long-lived connection token for header-authenticated clients. Returned once; only its hash is stored. */
export async function issueConnectionToken(store: GatewayStore, clock: Clock, connection: McpConnectionRow): Promise<{ token: string; session: McpSessionRow }> {
  const minted = mintToken("ct", connection.environment);
  const now = clock.now().toISOString();
  const expires = connection.expires_at ?? new Date(clock.now().getTime() + 90 * 86_400_000).toISOString();
  const session = await store.insertSession({
    id: clock.newId(),
    organization_id: connection.organization_id,
    environment: connection.environment,
    connection_id: connection.id,
    kind: "token",
    token_prefix: minted.prefix,
    access_expires_at: expires,
    refresh_expires_at: null,
    revoked_at: null,
    rotated_from: null,
    last_seen_at: null,
    ip_address: null,
    user_agent: null,
    created_at: now,
  });
  await store.insertCredential({ id: clock.newId(), session_id: session.id, kind: "access", token_hash: minted.hash, expires_at: expires, used_at: null, created_at: now });
  return { token: minted.token, session };
}

/** Revoke a connection and every session under it. Takes effect on the next request. */
export async function revokeConnection(store: GatewayStore, clock: Clock, connectionId: string, revokedBy: string): Promise<McpConnectionRow | null> {
  const at = clock.now().toISOString();
  await store.revokeSessionsForConnection(connectionId, at);
  return store.updateConnection(connectionId, { status: "revoked", revoked_at: at, revoked_by: revokedBy, updated_at: at });
}

import { inferClientType } from "@/domain/clients";
import type { McpClientRow, McpConnectionRow } from "@/domain/entities";
import type { Environment } from "@/domain/environments";
import { isScope, parseScopeString, sortScopes, type Scope } from "@/domain/scopes";
import { createHash } from "node:crypto";
import { randomBase62, safeEqual, sha256Hex } from "@/server/crypto/hash";
import type { Store } from "@/server/store/types";
import { createConnection, revokeConnection, type Clock } from "./connections";
import { hashToken, mintToken, parseToken } from "./tokens";

export const AUTH_CODE_TTL_SECONDS = 300;
export const REFRESH_TTL_DAYS = 30;

export class OAuthError extends Error {
  constructor(
    readonly error: "invalid_request" | "invalid_client" | "invalid_grant" | "unauthorized_client" | "unsupported_grant_type" | "invalid_scope" | "invalid_redirect_uri" | "invalid_client_metadata" | "access_denied",
    readonly description: string,
    readonly status = 400,
  ) {
    super(description);
  }
  toJSON() {
    return { error: this.error, error_description: this.description };
  }
}

/* ───────────── Resource indicators (RFC 8707) ───────────── */

export function resourceUrl(publicUrl: string, environment: Environment): string {
  return `${publicUrl}${environment === "sandbox" ? "/sandbox/mcp" : "/mcp"}`;
}

export function environmentForResource(publicUrl: string, resource: string | null): Environment | null {
  if (!resource) return null;
  const normalized = resource.replace(/\/$/, "");
  if (normalized === resourceUrl(publicUrl, "sandbox")) return "sandbox";
  if (normalized === resourceUrl(publicUrl, "production")) return "production";
  return null;
}

/* ───────────── Dynamic client registration (RFC 7591) ───────────── */

function validRedirectUri(uri: string): boolean {
  try {
    const u = new URL(uri);
    if (u.hash) return false;
    if (u.protocol === "https:") return true;
    return u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]");
  } catch {
    return false;
  }
}

export interface RegistrationRequest {
  client_name?: unknown;
  redirect_uris?: unknown;
  token_endpoint_auth_method?: unknown;
  grant_types?: unknown;
  response_types?: unknown;
}

export async function registerClient(store: Store, clock: Clock, body: RegistrationRequest, organizationId: string | null = null) {
  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((u): u is string => typeof u === "string") : [];
  if (redirectUris.length === 0 || redirectUris.length > 10 || !redirectUris.every(validRedirectUri)) {
    throw new OAuthError("invalid_redirect_uri", "redirect_uris must contain 1–10 https URLs (or http loopback URLs).");
  }
  const name = typeof body.client_name === "string" && body.client_name.trim() ? body.client_name.trim().slice(0, 100) : "MCP client";
  const method = body.token_endpoint_auth_method ?? "none";
  if (method !== "none" && method !== "client_secret_post" && method !== "client_secret_basic") {
    throw new OAuthError("invalid_client_metadata", "Unsupported token_endpoint_auth_method.");
  }
  const grants = Array.isArray(body.grant_types) ? body.grant_types : ["authorization_code", "refresh_token"];
  if (!grants.every((g) => g === "authorization_code" || g === "refresh_token")) {
    throw new OAuthError("invalid_client_metadata", "Only authorization_code and refresh_token grants are supported.");
  }
  const secret = method === "none" ? null : `sgk_cs_${randomBase62(40)}`;
  const client: McpClientRow = {
    id: `sgk_client_${randomBase62(24)}`,
    organization_id: organizationId,
    client_name: name,
    client_type: inferClientType(name, redirectUris),
    redirect_uris: redirectUris,
    token_endpoint_auth_method: method,
    client_secret_hash: secret ? sha256Hex(secret) : null,
    registration_source: organizationId ? "console" : "dynamic",
    created_at: clock.now().toISOString(),
  };
  await store.insertClient(client);
  return {
    client_id: client.id,
    ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
    client_id_issued_at: Math.floor(clock.now().getTime() / 1000),
    client_name: client.client_name,
    redirect_uris: client.redirect_uris,
    token_endpoint_auth_method: client.token_endpoint_auth_method,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
  };
}

/* ───────────── Authorization request ───────────── */

export interface AuthorizationRequest {
  client: McpClientRow;
  redirectUri: string;
  state: string | null;
  codeChallenge: string;
  requestedScopes: Scope[];
  resource: string | null;
  environment: Environment | null;
}

/**
 * Validate an authorization request. Errors about the client or redirect URI
 * must never redirect (open-redirect protection); callers render them instead.
 */
export async function validateAuthorizationRequest(store: Store, publicUrl: string, params: URLSearchParams): Promise<AuthorizationRequest> {
  const clientId = params.get("client_id");
  const client = clientId ? await store.getClient(clientId) : null;
  if (!client) throw new OAuthError("invalid_client", "Unknown client_id.");
  const redirectUri = params.get("redirect_uri") ?? (client.redirect_uris.length === 1 ? client.redirect_uris[0]! : null);
  if (!redirectUri || !client.redirect_uris.includes(redirectUri)) throw new OAuthError("invalid_redirect_uri", "redirect_uri is not registered for this client.");
  if (params.get("response_type") !== "code") throw new OAuthError("invalid_request", "response_type must be code.");
  const challenge = params.get("code_challenge");
  if (!challenge || params.get("code_challenge_method") !== "S256" || !/^[A-Za-z0-9_-]{43,128}$/.test(challenge)) {
    throw new OAuthError("invalid_request", "PKCE with code_challenge_method=S256 is required.");
  }
  const resource = params.get("resource");
  const environment = environmentForResource(publicUrl, resource);
  if (resource && !environment) throw new OAuthError("invalid_request", "resource must be a Sagolik MCP endpoint.");
  const rawScope = params.get("scope");
  if (rawScope && rawScope.split(/\s+/).some((s) => s && !isScope(s))) throw new OAuthError("invalid_scope", "One or more requested scopes are unknown.");
  return { client, redirectUri, state: params.get("state"), codeChallenge: challenge, requestedScopes: parseScopeString(rawScope), resource, environment };
}

/** Called after the user consents. Creates the connection and a short-lived, single-use code. */
export async function approveAuthorization(
  store: Store,
  clock: Clock,
  request: AuthorizationRequest,
  grant: { organizationId: string; userId: string; environment: Environment; scopes: Scope[]; expiresAt: string | null; transactionLimitCents: number | null },
  issuer: string,
): Promise<{ redirectTo: string; connection: McpConnectionRow }> {
  if (grant.scopes.length === 0) throw new OAuthError("invalid_scope", "At least one permission must be granted.");
  const connection = await createConnection(store, clock, {
    organizationId: grant.organizationId,
    environment: grant.environment,
    userId: grant.userId,
    name: request.client.client_name,
    clientType: request.client.client_type,
    authMethod: "oauth",
    scopes: grant.scopes,
    clientId: request.client.id,
    transactionLimitCents: grant.transactionLimitCents,
    expiresAt: grant.expiresAt,
  });
  const code = `sgk_code_${randomBase62(40)}`;
  const now = clock.now();
  await store.insertAuthorizationCode({
    id: clock.newId(),
    code_hash: sha256Hex(code),
    client_id: request.client.id,
    connection_id: connection.id,
    redirect_uri: request.redirectUri,
    code_challenge: request.codeChallenge,
    resource: request.resource ?? "",
    expires_at: new Date(now.getTime() + AUTH_CODE_TTL_SECONDS * 1000).toISOString(),
    consumed_at: null,
    created_at: now.toISOString(),
  });
  const url = new URL(request.redirectUri);
  url.searchParams.set("code", code);
  if (request.state) url.searchParams.set("state", request.state);
  // RFC 9207: identify the issuer so clients can detect mix-up attacks.
  url.searchParams.set("iss", issuer);
  return { redirectTo: url.toString(), connection };
}

export function denyAuthorizationRedirect(request: AuthorizationRequest): string {
  const url = new URL(request.redirectUri);
  url.searchParams.set("error", "access_denied");
  url.searchParams.set("error_description", "The user declined the authorization request.");
  if (request.state) url.searchParams.set("state", request.state);
  return url.toString();
}

/* ───────────── Token endpoint ───────────── */

function verifyPkce(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  const computed = createHash("sha256").update(verifier).digest("base64url");
  return safeEqual(computed, challenge);
}

async function authenticateClient(store: Store, params: URLSearchParams, basic: { id: string; secret: string } | null): Promise<McpClientRow> {
  const clientId = basic?.id ?? params.get("client_id");
  const client = clientId ? await store.getClient(clientId) : null;
  if (!client) throw new OAuthError("invalid_client", "Unknown client.", 401);
  if (client.token_endpoint_auth_method !== "none") {
    const secret = basic?.secret ?? params.get("client_secret");
    if (!secret || !client.client_secret_hash || !safeEqual(sha256Hex(secret), client.client_secret_hash)) {
      throw new OAuthError("invalid_client", "Client authentication failed.", 401);
    }
  }
  return client;
}

export interface TokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
}

async function issueOAuthSession(store: Store, clock: Clock, connection: McpConnectionRow, accessTtlMinutes: number, rotatedFrom: string | null): Promise<TokenResponse> {
  const now = clock.now();
  const cap = connection.expires_at ? new Date(connection.expires_at).getTime() : Number.POSITIVE_INFINITY;
  const accessExpires = new Date(Math.min(now.getTime() + accessTtlMinutes * 60_000, cap));
  const refreshExpires = new Date(Math.min(now.getTime() + REFRESH_TTL_DAYS * 86_400_000, cap));
  const access = mintToken("at", connection.environment);
  const refresh = mintToken("rt", connection.environment);
  const session = await store.insertSession({
    id: clock.newId(),
    organization_id: connection.organization_id,
    environment: connection.environment,
    connection_id: connection.id,
    kind: "oauth",
    token_prefix: access.prefix,
    access_expires_at: accessExpires.toISOString(),
    refresh_expires_at: refreshExpires.toISOString(),
    revoked_at: null,
    rotated_from: rotatedFrom,
    last_seen_at: null,
    ip_address: null,
    user_agent: null,
    created_at: now.toISOString(),
  });
  await store.insertCredential({ id: clock.newId(), session_id: session.id, kind: "access", token_hash: access.hash, expires_at: accessExpires.toISOString(), used_at: null, created_at: now.toISOString() });
  await store.insertCredential({ id: clock.newId(), session_id: session.id, kind: "refresh", token_hash: refresh.hash, expires_at: refreshExpires.toISOString(), used_at: null, created_at: now.toISOString() });
  await store.updateConnection(connection.id, { last_connected_at: now.toISOString(), updated_at: now.toISOString() });
  return {
    access_token: access.token,
    token_type: "Bearer",
    expires_in: Math.max(1, Math.floor((accessExpires.getTime() - now.getTime()) / 1000)),
    refresh_token: refresh.token,
    scope: connection.scopes.join(" "),
  };
}

export async function exchangeToken(
  store: Store,
  clock: Clock,
  params: URLSearchParams,
  basic: { id: string; secret: string } | null,
): Promise<TokenResponse> {
  const grantType = params.get("grant_type");
  const client = await authenticateClient(store, params, basic);

  if (grantType === "authorization_code") {
    const code = params.get("code");
    const verifier = params.get("code_verifier");
    if (!code || !verifier) throw new OAuthError("invalid_request", "code and code_verifier are required.");
    const record = await store.findAuthorizationCode(sha256Hex(code));
    if (!record || record.client_id !== client.id) throw new OAuthError("invalid_grant", "Invalid authorization code.");
    if (record.expires_at <= clock.now().toISOString()) throw new OAuthError("invalid_grant", "Authorization code expired.");
    const redirectUri = params.get("redirect_uri");
    if (redirectUri && redirectUri !== record.redirect_uri) throw new OAuthError("invalid_grant", "redirect_uri mismatch.");
    const resource = params.get("resource");
    if (resource && record.resource && resource.replace(/\/$/, "") !== record.resource.replace(/\/$/, "")) throw new OAuthError("invalid_grant", "resource mismatch.");
    if (!verifyPkce(verifier, record.code_challenge)) throw new OAuthError("invalid_grant", "PKCE verification failed.");
    if (!(await store.consumeAuthorizationCode(record.id, clock.now().toISOString()))) {
      // Code replay: revoke everything issued from it.
      await revokeConnection(store, clock, record.connection_id, "system:code_replay");
      throw new OAuthError("invalid_grant", "Authorization code already used.");
    }
    const connection = await store.getConnection(record.connection_id);
    if (!connection || connection.status !== "active") throw new OAuthError("invalid_grant", "The authorization is no longer active.");
    const settings = await store.getOrganizationSettings(connection.organization_id);
    return issueOAuthSession(store, clock, connection, settings.session_ttl_minutes, null);
  }

  if (grantType === "refresh_token") {
    const token = params.get("refresh_token");
    const parsed = token ? parseToken(token) : null;
    if (!token || parsed?.kind !== "rt") throw new OAuthError("invalid_grant", "Invalid refresh token.");
    const credential = await store.findCredentialByHash(hashToken(token));
    if (!credential || credential.kind !== "refresh") throw new OAuthError("invalid_grant", "Invalid refresh token.");
    const session = await store.getSession(credential.session_id);
    const connection = session ? await store.getConnection(session.connection_id) : null;
    if (!session || !connection || connection.client_id !== client.id) throw new OAuthError("invalid_grant", "Invalid refresh token.");
    if (!(await store.markCredentialUsed(credential.id, clock.now().toISOString()))) {
      // Refresh-token reuse indicates theft: revoke the whole connection.
      await revokeConnection(store, clock, connection.id, "system:refresh_reuse");
      throw new OAuthError("invalid_grant", "Refresh token reuse detected; the connection has been revoked.");
    }
    if (session.revoked_at || credential.expires_at <= clock.now().toISOString()) throw new OAuthError("invalid_grant", "Refresh token expired or revoked.");
    if (connection.status !== "active") throw new OAuthError("invalid_grant", "The connection has been revoked.");
    const requested = params.get("scope");
    if (requested) {
      const narrowed = parseScopeString(requested);
      if (narrowed.some((s) => !connection.scopes.includes(s))) throw new OAuthError("invalid_scope", "Refresh cannot widen the granted scopes.");
    }
    await store.updateSession(session.id, { revoked_at: clock.now().toISOString() });
    const settings = await store.getOrganizationSettings(connection.organization_id);
    return issueOAuthSession(store, clock, connection, settings.session_ttl_minutes, session.id);
  }

  throw new OAuthError("unsupported_grant_type", "Supported grants: authorization_code, refresh_token.");
}

/** RFC 7009 revocation. Always succeeds from the client's perspective. */
export async function revokeToken(store: Store, clock: Clock, token: string | null): Promise<void> {
  if (!token) return;
  const credential = await store.findCredentialByHash(hashToken(token));
  if (!credential) return;
  await store.updateSession(credential.session_id, { revoked_at: clock.now().toISOString() });
}

export function sanitizeScopes(scopes: string[]): Scope[] {
  return sortScopes(scopes.filter(isScope));
}

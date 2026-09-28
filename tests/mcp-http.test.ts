import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { approveAuthorization, exchangeToken, OAuthError, registerClient, revokeToken, validateAuthorizationRequest } from "@/server/auth/oauth";
import { revokeConnection } from "@/server/auth/connections";
import { handleMcpHttp } from "@/server/mcp/http";
import { createHarness, ORG_A, USER_A } from "./support/harness";

type Data = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function rpc(token: string | null, body: unknown, path = "/sandbox/mcp") {
  return new Request(`https://mcp.test${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("MCP Streamable HTTP endpoint", () => {
  it("challenges unauthenticated requests with protected-resource metadata", async () => {
    const h = createHarness();
    const res = await handleMcpHttp(rpc(null, { jsonrpc: "2.0", id: 1, method: "initialize", params: {} }), "sandbox", h.deps);
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain('resource_metadata="https://mcp.test/.well-known/oauth-protected-resource/sandbox/mcp"');
  });

  it("initializes, lists only authorized tools and calls a tool", async () => {
    const h = createHarness();
    const { token } = await h.connect({ scopes: ["property.read", "closing.read"] });

    const init = await handleMcpHttp(rpc(token, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "claude", version: "1" } } }), "sandbox", h.deps);
    const initBody = (await init.json()) as Data;
    expect(initBody.result.protocolVersion).toBe("2025-06-18");
    expect(initBody.result.capabilities.tools).toBeDefined();
    expect(initBody.result.serverInfo.name).toBe("sagolik-mcp");

    const notified = await handleMcpHttp(rpc(token, { jsonrpc: "2.0", method: "notifications/initialized" }), "sandbox", h.deps);
    expect(notified.status).toBe(202);

    const list = (await (await handleMcpHttp(rpc(token, { jsonrpc: "2.0", id: 2, method: "tools/list" }), "sandbox", h.deps)).json()) as Data;
    const names = list.result.tools.map((t: Data) => t.name);
    expect(names).toContain("get_closing_status");
    expect(names).not.toContain("activate_property_autopilot");
    expect(names).not.toContain("verify_funds_readiness");
    const closing = list.result.tools.find((t: Data) => t.name === "get_closing_status");
    expect(closing.annotations.readOnlyHint).toBe(true);
    expect(closing.outputSchema.properties.data.type).toBe("object");

    const call = (await (
      await handleMcpHttp(rpc(token, { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "get_closing_status", arguments: { property_id: "SGK-1042" } } }), "sandbox", h.deps)
    ).json()) as Data;
    expect(call.result.isError).toBe(false);
    expect(call.result.structuredContent.status).toBe("success");
    expect(call.result.structuredContent.environment).toBe("sandbox");
    expect(JSON.parse(call.result.content[0].text).audit_id).toBe(call.result.structuredContent.audit_id);
  });

  it("rejects sandbox tokens on the production endpoint", async () => {
    const h = createHarness();
    const { token } = await h.connect();
    const res = await handleMcpHttp(rpc(token, { jsonrpc: "2.0", id: 1, method: "ping" }, "/mcp"), "production", h.deps);
    expect(res.status).toBe(401);
    expect(((await res.json()) as Data).error.message).toMatch(/cannot be used with the production endpoint/);
  });

  it("stops accepting a token immediately after revocation", async () => {
    const h = createHarness();
    const { token, connection } = await h.connect();
    expect((await handleMcpHttp(rpc(token, { jsonrpc: "2.0", id: 1, method: "ping" }), "sandbox", h.deps)).status).toBe(200);
    await revokeConnection(h.store, h.clock, connection.id, USER_A);
    expect((await handleMcpHttp(rpc(token, { jsonrpc: "2.0", id: 1, method: "ping" }), "sandbox", h.deps)).status).toBe(401);
  });

  it("returns JSON-RPC errors for unknown tools and methods", async () => {
    const h = createHarness();
    const { token } = await h.connect();
    const tool = (await (await handleMcpHttp(rpc(token, { jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "raw_api_call", arguments: {} } }), "sandbox", h.deps)).json()) as Data;
    expect(tool.error.code).toBe(-32602);
    const method = (await (await handleMcpHttp(rpc(token, { jsonrpc: "2.0", id: 10, method: "resources/list" }), "sandbox", h.deps)).json()) as Data;
    expect(method.error.code).toBe(-32601);
    const parse = await handleMcpHttp(new Request("https://mcp.test/sandbox/mcp", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: "{not json" }), "sandbox", h.deps);
    expect(parse.status).toBe(400);
  });

  it("marks denied tool results as errors for the model", async () => {
    const h = createHarness();
    const { token } = await h.connect({ scopes: ["property.read"] });
    const body = (await (
      await handleMcpHttp(rpc(token, { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_closing_status", arguments: { property_id: "SGK-1042" } } }), "sandbox", h.deps)
    ).json()) as Data;
    expect(body.result.isError).toBe(true);
    expect(body.result.structuredContent.status).toBe("denied");
  });

  it("does not offer GET streams", async () => {
    const h = createHarness();
    const res = await handleMcpHttp(new Request("https://mcp.test/sandbox/mcp", { method: "GET" }), "sandbox", h.deps);
    expect(res.status).toBe(405);
  });
});

describe("OAuth 2.1 authorization for MCP clients", () => {
  const verifier = "a".repeat(20) + "B".repeat(20) + "c-._~1234";
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  async function authorize(h: ReturnType<typeof createHarness>) {
    const registration = await registerClient(h.store, h.clock, { client_name: "Claude", redirect_uris: ["https://claude.ai/api/mcp/auth_callback"] });
    const params = new URLSearchParams({
      client_id: registration.client_id,
      redirect_uri: "https://claude.ai/api/mcp/auth_callback",
      response_type: "code",
      code_challenge: challenge,
      code_challenge_method: "S256",
      state: "xyz",
      resource: "https://mcp.test/sandbox/mcp",
      scope: "property.read closing.read",
    });
    const request = await validateAuthorizationRequest(h.store, "https://mcp.test", params);
    expect(request.environment).toBe("sandbox");
    expect(request.client.client_type).toBe("claude");
    const { redirectTo, connection } = await approveAuthorization(h.store, h.clock, request, {
      organizationId: ORG_A,
      userId: USER_A,
      environment: "sandbox",
      scopes: ["property.read", "closing.read"],
      expiresAt: null,
      transactionLimitCents: null,
    }, "https://mcp.test");
    const code = new URL(redirectTo).searchParams.get("code")!;
    expect(new URL(redirectTo).searchParams.get("iss")).toBe("https://mcp.test");
    expect(new URL(redirectTo).searchParams.get("state")).toBe("xyz");
    return { registration, code, connection };
  }

  it("issues tokens only with a valid PKCE verifier and single-use code", async () => {
    const h = createHarness();
    await h.ready;
    const { registration, code } = await authorize(h);
    const base = { grant_type: "authorization_code", code, client_id: registration.client_id, redirect_uri: "https://claude.ai/api/mcp/auth_callback" };

    await expect(exchangeToken(h.store, h.clock, new URLSearchParams({ ...base, code_verifier: "wrong".repeat(10) }), null)).rejects.toBeInstanceOf(OAuthError);
    const tokens = await exchangeToken(h.store, h.clock, new URLSearchParams({ ...base, code_verifier: verifier }), null);
    expect(tokens.access_token).toMatch(/^sgk_test_at_/);
    expect(tokens.scope).toBe("property.read closing.read");

    const res = await handleMcpHttp(rpc(tokens.access_token, { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_closing_status", arguments: { property_id: "SGK-1042" } } }), "sandbox", h.deps);
    expect(((await res.json()) as Data).result.structuredContent.status).toBe("success");

    // Code replay revokes the connection.
    await expect(exchangeToken(h.store, h.clock, new URLSearchParams({ ...base, code_verifier: verifier }), null)).rejects.toThrow(/already used/);
    expect((await handleMcpHttp(rpc(tokens.access_token, { jsonrpc: "2.0", id: 2, method: "ping" }), "sandbox", h.deps)).status).toBe(401);
  });

  it("rotates refresh tokens and revokes the connection on reuse", async () => {
    const h = createHarness();
    await h.ready;
    const { registration, code, connection } = await authorize(h);
    const first = await exchangeToken(h.store, h.clock, new URLSearchParams({ grant_type: "authorization_code", code, client_id: registration.client_id, code_verifier: verifier }), null);
    const second = await exchangeToken(h.store, h.clock, new URLSearchParams({ grant_type: "refresh_token", refresh_token: first.refresh_token, client_id: registration.client_id }), null);
    expect(second.refresh_token).not.toBe(first.refresh_token);
    await expect(
      exchangeToken(h.store, h.clock, new URLSearchParams({ grant_type: "refresh_token", refresh_token: first.refresh_token, client_id: registration.client_id }), null),
    ).rejects.toThrow(/reuse detected/);
    expect((await h.store.getConnection(connection.id))?.status).toBe("revoked");
  });

  it("refuses to widen scopes on refresh and supports revocation", async () => {
    const h = createHarness();
    await h.ready;
    const { registration, code } = await authorize(h);
    const tokens = await exchangeToken(h.store, h.clock, new URLSearchParams({ grant_type: "authorization_code", code, client_id: registration.client_id, code_verifier: verifier }), null);
    await expect(
      exchangeToken(h.store, h.clock, new URLSearchParams({ grant_type: "refresh_token", refresh_token: tokens.refresh_token, client_id: registration.client_id, scope: "autopilot.execute" }), null),
    ).rejects.toThrow(/widen/);
    await revokeToken(h.store, h.clock, tokens.access_token);
    expect((await handleMcpHttp(rpc(tokens.access_token, { jsonrpc: "2.0", id: 1, method: "ping" }), "sandbox", h.deps)).status).toBe(401);
  });

  it("rejects unregistered redirect URIs and non-PKCE requests", async () => {
    const h = createHarness();
    const registration = await registerClient(h.store, h.clock, { client_name: "Custom", redirect_uris: ["https://agent.example.com/callback"] });
    const bad = new URLSearchParams({ client_id: registration.client_id, redirect_uri: "https://evil.example.com/cb", response_type: "code", code_challenge: challenge, code_challenge_method: "S256" });
    await expect(validateAuthorizationRequest(h.store, "https://mcp.test", bad)).rejects.toThrow(/not registered/);
    const plain = new URLSearchParams({ client_id: registration.client_id, redirect_uri: "https://agent.example.com/callback", response_type: "code", code_challenge: challenge, code_challenge_method: "plain" });
    await expect(validateAuthorizationRequest(h.store, "https://mcp.test", plain)).rejects.toThrow(/PKCE/);
    await expect(registerClient(h.store, h.clock, { redirect_uris: ["http://evil.example.com/cb"] })).rejects.toThrow(/redirect_uris/);
  });
});

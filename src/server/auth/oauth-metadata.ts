import { SCOPES } from "@/domain/scopes";
import type { Environment } from "@/domain/environments";
import { resourceUrl } from "./oauth";

/** RFC 9728 protected resource metadata for one MCP endpoint. */
export function protectedResourceMetadata(publicUrl: string, environment: Environment) {
  return {
    resource: resourceUrl(publicUrl, environment),
    authorization_servers: [publicUrl],
    scopes_supported: SCOPES,
    bearer_methods_supported: ["header"],
    resource_name: `Sagolik MCP (${environment === "sandbox" ? "Sandbox" : "Production"})`,
    resource_documentation: `${publicUrl}/docs`,
  };
}

/** RFC 8414 authorization server metadata. */
export function authorizationServerMetadata(publicUrl: string) {
  return {
    issuer: publicUrl,
    authorization_endpoint: `${publicUrl}/oauth/authorize`,
    token_endpoint: `${publicUrl}/oauth/token`,
    registration_endpoint: `${publicUrl}/oauth/register`,
    revocation_endpoint: `${publicUrl}/oauth/revoke`,
    scopes_supported: SCOPES,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    revocation_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    service_documentation: `${publicUrl}/docs/authentication`,
  };
}

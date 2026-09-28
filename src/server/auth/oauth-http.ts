import "server-only";
import { OAuthError } from "./oauth";

export const OAUTH_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export function oauthJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", Pragma: "no-cache", ...OAUTH_CORS },
  });
}

export function oauthError(error: unknown): Response {
  if (error instanceof OAuthError) return oauthJson(error.toJSON(), error.status);
  return oauthJson({ error: "server_error", error_description: "The request could not be completed." }, 500);
}

/** Parse `Authorization: Basic` client credentials (RFC 6749 §2.3.1). */
export function basicCredentials(request: Request): { id: string; secret: string } | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Basic ")) return null;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const idx = decoded.indexOf(":");
  if (idx < 0) return null;
  return { id: decodeURIComponent(decoded.slice(0, idx)), secret: decodeURIComponent(decoded.slice(idx + 1)) };
}

export async function formParams(request: Request): Promise<URLSearchParams> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/x-www-form-urlencoded")) return new URLSearchParams(await request.text());
  if (type.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return new URLSearchParams(Object.entries(body).filter(([, v]) => typeof v === "string") as [string, string][]);
  }
  throw new OAuthError("invalid_request", "Use application/x-www-form-urlencoded.");
}

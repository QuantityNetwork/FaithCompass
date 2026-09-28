import { authorizationServerMetadata } from "@/server/auth/oauth-metadata";
import { publicUrlFrom } from "@/server/runtime";

export const dynamic = "force-dynamic";

const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300" };

export async function GET(request: Request) {
  return new Response(JSON.stringify(authorizationServerMetadata(publicUrlFrom(request))), { headers });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...headers, "Access-Control-Allow-Methods": "GET, OPTIONS" } });
}

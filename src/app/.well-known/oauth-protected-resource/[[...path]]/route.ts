import { protectedResourceMetadata } from "@/server/auth/oauth-metadata";
import { publicUrlFrom } from "@/server/runtime";

export const dynamic = "force-dynamic";

const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300" };

export async function GET(request: Request, ctx: RouteContext<"/.well-known/oauth-protected-resource/[[...path]]">) {
  const { path = [] } = await ctx.params;
  const suffix = path.join("/");
  if (suffix !== "" && suffix !== "mcp" && suffix !== "sandbox/mcp") return new Response("Not found", { status: 404 });
  const environment = suffix === "sandbox/mcp" ? "sandbox" : "production";
  return new Response(JSON.stringify(protectedResourceMetadata(publicUrlFrom(request), environment)), { headers });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...headers, "Access-Control-Allow-Methods": "GET, OPTIONS" } });
}

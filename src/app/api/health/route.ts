export const dynamic = "force-dynamic";

/** Public liveness probe. Intentionally reveals nothing about tenants, data or configuration. */
export function GET() {
  return Response.json({ status: "ok", service: "sagolik-mcp", version: "1.0.0" }, { headers: { "Cache-Control": "no-store" } });
}

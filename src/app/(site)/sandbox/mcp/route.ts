import { mcpRouteHandlers } from "@/server/mcp/route-handler";

export const dynamic = "force-dynamic";

/** Sandbox MCP endpoint: https://mcp.sagolik.com/sandbox/mcp — synthetic data only. */
export const { GET, POST, DELETE, OPTIONS } = mcpRouteHandlers("sandbox");

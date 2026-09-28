import { mcpRouteHandlers } from "@/server/mcp/route-handler";

export const dynamic = "force-dynamic";

/** Production MCP endpoint: https://mcp.sagolik.com/mcp */
export const { GET, POST, DELETE, OPTIONS } = mcpRouteHandlers("production");

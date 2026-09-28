import "server-only";
import type { Environment } from "@/domain/environments";
import { getRuntime, publicUrlFrom } from "@/server/runtime";
import { handleMcpHttp } from "./http";

/** Shared Next.js route handler for the production and sandbox MCP endpoints. */
export function mcpRouteHandlers(environment: Environment) {
  const handle = async (request: Request) => {
    const runtime = getRuntime();
    await runtime.ready;
    return handleMcpHttp(request, environment, runtime.gateway(publicUrlFrom(request)));
  };
  return { GET: handle, POST: handle, DELETE: handle, OPTIONS: handle };
}

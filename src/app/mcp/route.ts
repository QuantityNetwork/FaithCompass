import { handleMcpDelete, handleMcpGet, handleMcpOptions, handleMcpPost } from '@/lib/mcp/server';

/**
 * The canonical MCP endpoint: Streamable HTTP, stateless JSON responses.
 * See src/lib/mcp/server.ts.
 */
export const dynamic = 'force-dynamic';

export const POST = (request: Request) => handleMcpPost(request);
export const GET = (request: Request) => handleMcpGet(request);
export const OPTIONS = () => handleMcpOptions();
export const DELETE = () => handleMcpDelete();

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetRateLimits } from '@/lib/api/http';
import { dispatchLegacy } from '@/lib/api/legacy';
import { LATEST_PROTOCOL_VERSION, handleMcpGet, handleMcpPost, handleMessage } from '@/lib/mcp/server';
import { TOOLS, TOOL_BY_NAME } from '@/lib/mcp/tools';

beforeEach(() => resetRateLimits());

const rpc = (method: string, params?: unknown, id: number | string = 1) => handleMessage({ jsonrpc: '2.0', id, method, params }) as {
  result?: Record<string, any>;
  error?: { code: number; message: string };
};

/** Arguments that exercise each tool against the real record. */
const SAMPLE_ARGS: Record<string, Record<string, unknown>> = {
  evidence_impact: { passage: 'span:DOC-03#total_debt' },
  search_record: { q: 'What changed concerning priesthood under the New Covenant?' },
  get_claim: { code: 'AM-CLAIM-000184' },
  list_claims: { topic: 'Torah', limit: 5 },
  get_provenance: { code: 'AM-CLAIM-000191' },
  get_dependencies: { code: 'AM-CLAIM-000191' },
  simulate_rejection: { reject_axioms: ['AM-AX-002'] },
  list_research_cases: {},
  get_research_case: { slug: 'restoration-priesthood-authority' },
  compare_traditions: { case: 'torah-permanence' },
  list_axioms: {},
  list_covenants: { family: 'islamic' },
  list_doctrine_connections: { node: 'abraham' },
  get_citation: { code: 'AM-CLAIM-000184', revision: 1 },
  get_record_history: { limit: 5 },
};

describe('MCP — JSON-RPC protocol', () => {
  it('negotiates the protocol version', () => {
    expect(rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } }).result!.protocolVersion).toBe('2025-06-18');
    expect(rpc('initialize', { protocolVersion: '1999-01-01', capabilities: {}, clientInfo: { name: 't', version: '1' } }).result!.protocolVersion).toBe(LATEST_PROTOCOL_VERSION);
    const init = rpc('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 't', version: '1' } }).result!;
    expect(init.capabilities.tools).toBeDefined();
    expect(init.serverInfo.name).toBe('abrahammoses');
    expect(init.instructions).toMatch(/never ranks religions/);
  });

  it('lists valid tool definitions, all read-only', () => {
    const tools = rpc('tools/list').result!.tools as Array<Record<string, any>>;
    expect(tools.map((t) => t.name).sort()).toEqual(Object.keys(SAMPLE_ARGS).sort());
    for (const t of tools) {
      expect(t.inputSchema.type, t.name).toBe('object');
      expect(t.outputSchema.type, t.name).toBe('object');
      expect(t.inputSchema.$schema).toBeUndefined();
      expect(t.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
      expect(t.description.length).toBeGreaterThan(60);
    }
  });

  it('calls every tool successfully, with results matching its output schema', () => {
    for (const tool of TOOLS) {
      const res = rpc('tools/call', { name: tool.name, arguments: SAMPLE_ARGS[tool.name] }).result!;
      expect(res.isError, tool.name).toBe(false);
      expect(JSON.parse(res.content[0].text)).toEqual(res.structuredContent);
      const parsed = TOOL_BY_NAME.get(tool.name)!.output.safeParse(res.structuredContent);
      expect(parsed.success, `${tool.name}: ${parsed.success ? '' : JSON.stringify(parsed.error.issues.slice(0, 2))}`).toBe(true);
    }
  });

  it('retrieves a published claim with its provenance', () => {
    const claim = rpc('tools/call', { name: 'get_claim', arguments: { code: 'AM-CLAIM-000184' } }).result!.structuredContent;
    expect(claim.statement).toBe('Hebrews identifies Jesus as High Priest according to the order of Melchizedek.');
    expect(claim.provenance).toHaveLength(8);
  });

  it('reports bad arguments and unknown records as tool errors the model can correct', () => {
    const missing = rpc('tools/call', { name: 'get_claim', arguments: { code: 'AM-CLAIM-999999' } }).result!;
    expect(missing.isError).toBe(true);
    expect(missing.content[0].text).toMatch(/No published claim/);
    const invalid = rpc('tools/call', { name: 'get_claim', arguments: {} }).result!;
    expect(invalid.isError).toBe(true);
    expect(invalid.content[0].text).toMatch(/Invalid arguments/);
  });

  it('uses JSON-RPC errors for protocol faults', () => {
    expect(rpc('tools/call', { name: 'no_such_tool', arguments: {} }).error!.code).toBe(-32602);
    expect(rpc('no/such/method').error!.code).toBe(-32601);
    expect(rpc('resources/read', { uri: 'abrahammoses://claims/AM-CLAIM-999999' }).error!.code).toBe(-32002);
    expect((handleMessage({ id: 1, method: 'ping' }) as { error: { code: number } }).error.code).toBe(-32600);
  });

  it('serves resources and prompts', () => {
    const list = rpc('resources/list').result!.resources as Array<{ uri: string }>;
    expect(list.map((r) => r.uri)).toContain('abrahammoses://cases/torah-permanence');
    const read = rpc('resources/read', { uri: 'abrahammoses://claims/AM-CLAIM-000184' }).result!.contents[0];
    expect(JSON.parse(read.text).code).toBe('AM-CLAIM-000184');
    expect(rpc('resources/templates/list').result!.resourceTemplates.length).toBeGreaterThan(0);
    const prompt = rpc('prompts/get', { name: 'challenge_assumption', arguments: { code: 'AM-AX-002' } }).result!;
    expect(prompt.messages[0].content.text).toMatch(/AM-AX-002/);
  });
});

describe('MCP — Streamable HTTP transport', () => {
  const post = (body: string, headers: Record<string, string> = {}) =>
    handleMcpPost(
      new Request('https://am.example.test/mcp', {
        method: 'POST',
        body,
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers },
      }),
    );

  it('answers a request with JSON and accepts notifications with 202', async () => {
    const res = await post(JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'ping' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    expect(await res.json()).toEqual({ jsonrpc: '2.0', id: 7, result: {} });
    const note = await post(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }));
    expect(note.status).toBe(202);
  });

  it('handles batches, parse errors and unsupported protocol versions', async () => {
    const batch = await post(JSON.stringify([{ jsonrpc: '2.0', id: 1, method: 'ping' }, { jsonrpc: '2.0', method: 'notifications/initialized' }, { jsonrpc: '2.0', id: 2, method: 'tools/list' }]));
    const replies = (await batch.json()) as Array<{ id: number }>;
    expect(replies.map((r) => r.id)).toEqual([1, 2]);
    const bad = await post('{nope');
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.code).toBe(-32700);
    const version = await post(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }), { 'mcp-protocol-version': '1999-01-01' });
    expect(version.status).toBe(400);
  });

  it('declines a GET stream, and sends browsers to the documentation', () => {
    expect(handleMcpGet(new Request('https://am.example.test/mcp', { headers: { accept: 'text/event-stream' } })).status).toBe(405);
    const html = handleMcpGet(new Request('https://am.example.test/mcp', { headers: { accept: 'text/html' } }));
    expect(html.status).toBe(307);
    expect(html.headers.get('location')).toMatch(/\/developers#mcp$/);
  });
});

/* ------------------------------------------------------------------ *
 * End to end with the official MCP client over real HTTP
 * ------------------------------------------------------------------ */

describe('MCP — end to end with the official TypeScript SDK client', () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    server = createServer(async (incoming, outgoing) => {
      const chunks: Buffer[] = [];
      for await (const chunk of incoming) chunks.push(chunk as Buffer);
      const url = `http://127.0.0.1${incoming.url}`;
      const request = new Request(url, {
        method: incoming.method,
        headers: incoming.headers as Record<string, string>,
        body: ['GET', 'HEAD'].includes(incoming.method!) ? undefined : Buffer.concat(chunks),
      });
      const path = new URL(url).pathname;
      const response =
        path === '/mcp'
          ? incoming.method === 'POST'
            ? await handleMcpPost(request)
            : handleMcpGet(request)
          : await dispatchLegacy(request, path.replace(/^\/api\/public\//, ''));
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  for (const endpoint of ['/mcp', '/api/public/mcp']) {
    it(`connects, lists tools and calls them at ${endpoint}`, async () => {
      const client = new Client({ name: 'abrahammoses-acceptance', version: '1.0.0' });
      await client.connect(new StreamableHTTPClientTransport(new URL(`${base}${endpoint}`)));

      expect(client.getServerVersion()?.name).toBe('abrahammoses');
      const { tools } = await client.listTools();
      expect(tools.length).toBe(TOOLS.length);

      // The SDK validates structuredContent against each tool's outputSchema.
      const claim = await client.callTool({ name: 'get_claim', arguments: { code: 'AM-CLAIM-000184' } });
      expect(claim.isError).toBe(false);
      expect((claim.structuredContent as { code: string }).code).toBe('AM-CLAIM-000184');

      const sim = await client.callTool({ name: 'simulate_rejection', arguments: { reject_axioms: ['AM-AX-002'] } });
      const affected = (sim.structuredContent as { affected: Array<{ code: string; status: string }> }).affected;
      expect(affected.find((a) => a.code === 'AM-CLAIM-000191')?.status).toBe('weakened');

      const resource = await client.readResource({ uri: 'abrahammoses://cases/ibrahim-heirs-and-revelation' });
      expect(JSON.parse((resource.contents[0] as { text: string }).text).field).toBe('islamic-studies');

      const prompts = await client.listPrompts();
      expect(prompts.prompts.length).toBeGreaterThan(0);
      await client.close();
    });
  }
});

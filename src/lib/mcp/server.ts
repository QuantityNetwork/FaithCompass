/**
 * AbrahamMoses MCP server — Streamable HTTP transport, stateless JSON mode.
 *
 * POST carries JSON-RPC 2.0 requests (single or batched) and is answered with
 * application/json. There is no session: no Mcp-Session-Id is issued and none
 * is required, which the specification permits. GET is answered with 405
 * because the server sends no unsolicited messages; a browser asking for HTML
 * is redirected to the developer documentation instead.
 *
 * Methods: initialize, ping, tools/list, tools/call, resources/list,
 * resources/templates/list, resources/read, prompts/list, prompts/get, and the
 * client notifications (accepted and ignored).
 */

import { logServerError } from '@/lib/security/audit-log';
import { z } from 'zod/v4';
import { ApiError, CORS_HEADERS, rateLimit, rateLimitPerMinute } from '@/lib/api/http';
import { caseView, axiomView } from '@/lib/api/views';
import { getClaim, getProvenance } from '@/lib/api/operations';
import { getRecord } from '@/lib/record/record';
import { MCP_SERVER_VERSION, SITE_NAME, absoluteUrl } from '@/lib/site/config';
import { TOOLS, TOOL_BY_NAME, toolListing } from './tools';

export const SUPPORTED_PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'] as const;
export const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

export const JSONRPC = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  RESOURCE_NOT_FOUND: -32002,
} as const;

export const SERVER_INSTRUCTIONS = `AbrahamMoses is a structured theological research record. It separates what a text says (textual reports) from how traditions read it (attributed interpretations) and from machine analysis, and it never ranks religions.

Use search_record to find what the record holds on a question or a reference, then get_claim to read a claim with its witnesses, editions, confidence axes and per-tradition acceptance. Use simulate_rejection to test how much a conclusion depends on a disputed reading principle; it is a simulation and changes nothing. Use compare_traditions to see each tradition's answer to a research case, including where a tradition asks a different question.

When you report a claim, attribute interpretations to the traditions that hold them, keep the confidence axes separate, and say when a record is provisional (not yet verified by an editor). Cite with get_citation.`;

type Id = string | number;

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: Id | null;
  method: string;
  params?: unknown;
}

class RpcError extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly data?: unknown,
  ) {
    super(message);
  }
}

/* ------------------------------------------------------------------ *
 * Resources and prompts
 * ------------------------------------------------------------------ */

function resources() {
  const record = getRecord();
  return [
    ...record.data.cases.map((rc) => ({
      uri: `abrahammoses://cases/${rc.slug}`,
      name: rc.slug,
      title: rc.title,
      description: rc.question,
      mimeType: 'application/json',
    })),
    {
      uri: 'abrahammoses://methodology/dependency-semantics',
      name: 'dependency-semantics',
      title: 'How rejection propagates',
      description: 'The AND/OR semantics of the Hermeneutical Dependency Model.',
      mimeType: 'text/markdown',
    },
  ];
}

const RESOURCE_TEMPLATES = [
  {
    uriTemplate: 'abrahammoses://claims/{code}',
    name: 'claim',
    title: 'Claim',
    description: 'A claim in the AbrahamMoses record, e.g. abrahammoses://claims/AM-CLAIM-000184',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'abrahammoses://claims/{code}/provenance',
    name: 'claim-provenance',
    title: 'Claim provenance',
    description: 'The provenance chain behind a claim.',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'abrahammoses://axioms/{code}',
    name: 'axiom',
    title: 'Reading principle',
    description: 'A tradition axiom with its stances, e.g. abrahammoses://axioms/AM-AX-002',
    mimeType: 'application/json',
  },
];

export const DEPENDENCY_SEMANTICS = `# How rejection propagates

- A claim may have several **derivations** — independent ways of arriving at it. It holds while **any** derivation holds (OR).
- Within a derivation, every **necessary** premise and every **required** axiom must hold (AND). **Supporting** premises and **strengthening** axioms never defeat a derivation; when they fail, the claim's **support is weakened**.
- Claims grounded in a witness (what a text says) keep their standing as **reports** when the argument behind them fails; the reading is then only **partially supported**. A derivation that needs only the report survives; one that needs the warrant fails.
- Evaluation is a least fixed point, so claims that support only each other in a circle are never established.
- Map connections stay grounded while **any** grounding claim holds.
- Counter-models are shown on both sides: **aligned** (consistent with what was set aside) when they also deny it, **undermined** (not established under the selected assumptions) when it removes something they need.
- Every outcome carries \`epistemic_status\`, the public vocabulary: supported ("Supported under selected assumptions"), partially_supported, support_weakened, not_established ("Not established under selected assumptions"), insufficient_evidence, disputed_interpretation. The legacy \`status\` values (stands, weakened, unwarranted, broken, rejected) are kept for compatibility. Report results in the epistemic wording: never describe a conclusion, position or tradition as "broken", and never present a simulation as a verdict on whether a faith is true.
- Simulation never changes the record.`;

function readResource(uri: string) {
  const record = getRecord();
  const json = (value: unknown) => [{ uri, mimeType: 'application/json', text: JSON.stringify(value, null, 2) }];
  let m: RegExpMatchArray | null;
  try {
    if ((m = uri.match(/^abrahammoses:\/\/cases\/([a-z0-9-]+)$/)) && record.researchCase(m[1])) return json(caseView(record, m[1]));
    if ((m = uri.match(/^abrahammoses:\/\/claims\/(AM-CLAIM-\d{6})\/provenance$/i))) return json(getProvenance(record, m[1]));
    if ((m = uri.match(/^abrahammoses:\/\/claims\/(AM-CLAIM-\d{6})$/i))) return json(getClaim(record, m[1]));
    if ((m = uri.match(/^abrahammoses:\/\/axioms\/(AM-AX-\d{3})$/i)) && record.axiom(m[1])) return json(axiomView(record, m[1]));
    if (uri === 'abrahammoses://methodology/dependency-semantics') {
      return [{ uri, mimeType: 'text/markdown', text: DEPENDENCY_SEMANTICS }];
    }
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
  }
  throw new RpcError(JSONRPC.RESOURCE_NOT_FOUND, 'Resource not found', { uri });
}

const PROMPTS = [
  {
    name: 'examine_question',
    title: 'Examine a contested question',
    description: 'Research a theological question in the record: sources, attributed positions, and what each rests on.',
    arguments: [{ name: 'question', description: 'The question to examine', required: true }],
  },
  {
    name: 'challenge_assumption',
    title: 'Challenge an assumption',
    description: 'Reject a reading principle or claim and report what follows, on both sides of the dispute.',
    arguments: [{ name: 'code', description: 'An axiom (AM-AX-…) or claim (AM-CLAIM-…) code', required: true }],
  },
];

function getPrompt(name: string, args: Record<string, string>) {
  if (name === 'examine_question') {
    if (!args.question) throw new RpcError(JSONRPC.INVALID_PARAMS, 'Missing required argument: question');
    return {
      description: PROMPTS[0].description,
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Using the AbrahamMoses tools, examine this question: “${args.question}”. Start with search_record. Separate what the texts state from how each tradition reads them, attribute every interpretation, keep the confidence axes separate, note provisional records, and cite claims with their codes.`,
          },
        },
      ],
    };
  }
  if (name === 'challenge_assumption') {
    if (!args.code) throw new RpcError(JSONRPC.INVALID_PARAMS, 'Missing required argument: code');
    return {
      description: PROMPTS[1].description,
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Using simulate_rejection, reject ${args.code} in the AbrahamMoses record. Report, in the epistemic wording (epistemic_status labels), which conclusions are not established under the selected assumptions, which have weakened or only partial support, which keep their standing as textual reports, which map connections lose their grounding, and which counter-models are consistent with the change or no longer established under it. Make clear that no source was changed and that the disagreement remains.`,
          },
        },
      ],
    };
  }
  throw new RpcError(JSONRPC.INVALID_PARAMS, `Unknown prompt: ${name}`);
}

/* ------------------------------------------------------------------ *
 * Dispatch
 * ------------------------------------------------------------------ */

const ObjectParams = z.record(z.string(), z.unknown()).optional().default({});

function negotiate(requested: unknown): string {
  return typeof requested === 'string' && (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
    ? requested
    : LATEST_PROTOCOL_VERSION;
}

function callTool(params: Record<string, unknown>) {
  const name = typeof params.name === 'string' ? params.name : '';
  const tool = TOOL_BY_NAME.get(name);
  if (!tool) throw new RpcError(JSONRPC.INVALID_PARAMS, `Unknown tool: ${name || '(missing name)'}`);
  const args = (params.arguments ?? {}) as Record<string, unknown>;
  try {
    const structured = tool.run(args);
    return {
      content: [{ type: 'text', text: JSON.stringify(structured, null, 2) }],
      structuredContent: structured,
      isError: false,
    };
  } catch (err) {
    // Input and lookup problems are reported to the model as tool errors so it
    // can correct its call; only an unknown tool is a protocol error.
    let message: string;
    if (err instanceof z.ZodError) {
      message = `Invalid arguments: ${err.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')}`;
    } else if (err instanceof ApiError) {
      message = err.details ? `${err.message} ${JSON.stringify(err.details)}` : err.message;
    } else {
      logServerError(`mcp.tool.${name}`, err);
      message = 'The tool failed unexpectedly. Nothing was changed.';
    }
    return { content: [{ type: 'text', text: message }], isError: true };
  }
}

export function dispatch(method: string, rawParams: unknown): unknown {
  const parsed = ObjectParams.safeParse(rawParams);
  if (!parsed.success) throw new RpcError(JSONRPC.INVALID_PARAMS, 'params must be an object');
  const params = parsed.data;

  switch (method) {
    case 'initialize':
      return {
        protocolVersion: negotiate(params.protocolVersion),
        capabilities: {
          tools: { listChanged: false },
          resources: { subscribe: false, listChanged: false },
          prompts: { listChanged: false },
        },
        serverInfo: {
          name: 'abrahammoses',
          title: SITE_NAME,
          version: MCP_SERVER_VERSION,
          websiteUrl: absoluteUrl('/developers'),
        },
        instructions: SERVER_INSTRUCTIONS,
      };
    case 'ping':
      return {};
    case 'tools/list':
      return { tools: TOOLS.map(toolListing) };
    case 'tools/call':
      return callTool(params);
    case 'resources/list':
      return { resources: resources() };
    case 'resources/templates/list':
      return { resourceTemplates: RESOURCE_TEMPLATES };
    case 'resources/read': {
      if (typeof params.uri !== 'string') throw new RpcError(JSONRPC.INVALID_PARAMS, 'Missing uri');
      return { contents: readResource(params.uri) };
    }
    case 'prompts/list':
      return { prompts: PROMPTS };
    case 'prompts/get': {
      if (typeof params.name !== 'string') throw new RpcError(JSONRPC.INVALID_PARAMS, 'Missing name');
      return getPrompt(params.name, (params.arguments ?? {}) as Record<string, string>);
    }
    default:
      throw new RpcError(JSONRPC.METHOD_NOT_FOUND, `Method not found: ${method}`);
  }
}

function isRequest(m: unknown): m is JsonRpcRequest {
  return typeof m === 'object' && m !== null && (m as JsonRpcRequest).jsonrpc === '2.0' && typeof (m as JsonRpcRequest).method === 'string';
}

function errorMessage(id: Id | null, code: number, message: string, data?: unknown) {
  return { jsonrpc: '2.0' as const, id, error: { code, message, ...(data === undefined ? {} : { data }) } };
}

/** Handle one JSON-RPC message. Returns null for notifications and client responses. */
export function handleMessage(message: unknown): object | null {
  if (!isRequest(message)) {
    // A response from the client (to a server request we never send) is ignored;
    // anything else is an invalid request.
    if (typeof message === 'object' && message !== null && 'jsonrpc' in message && ('result' in message || 'error' in message)) {
      return null;
    }
    const id = typeof message === 'object' && message !== null && 'id' in message ? ((message as { id: Id }).id ?? null) : null;
    return errorMessage(id, JSONRPC.INVALID_REQUEST, 'Invalid Request');
  }
  const isNotification = message.id === undefined;
  if (isNotification) return null;
  const id = message.id as Id;
  try {
    return { jsonrpc: '2.0', id, result: dispatch(message.method, message.params) };
  } catch (err) {
    if (err instanceof RpcError) return errorMessage(id, err.code, err.message, err.data);
    logServerError('mcp', err);
    return errorMessage(id, JSONRPC.INTERNAL_ERROR, 'Internal error');
  }
}

/* ------------------------------------------------------------------ *
 * HTTP
 * ------------------------------------------------------------------ */

function headers(extra: Record<string, string> = {}): Headers {
  const h = new Headers(CORS_HEADERS);
  h.set('Content-Type', 'application/json; charset=utf-8');
  h.set('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(extra)) h.set(k, v);
  return h;
}

function rpcResponse(body: unknown, status: number, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: headers(extra) });
}

export async function handleMcpPost(request: Request): Promise<Response> {
  const limit = rateLimit(request);
  if (!limit.ok) {
    return rpcResponse(errorMessage(null, JSONRPC.INTERNAL_ERROR, `Rate limit of ${rateLimitPerMinute()} requests per minute exceeded`), 429, limit.headers);
  }

  const accept = request.headers.get('accept');
  if (accept && !/application\/json|\*\/\*|application\/\*/.test(accept)) {
    return rpcResponse(errorMessage(null, JSONRPC.INVALID_REQUEST, 'Not Acceptable: the client must accept application/json'), 406, limit.headers);
  }

  const version = request.headers.get('mcp-protocol-version');
  if (version && !(SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(version)) {
    return rpcResponse(
      errorMessage(null, JSONRPC.INVALID_REQUEST, `Unsupported MCP-Protocol-Version: ${version}`, { supported: SUPPORTED_PROTOCOL_VERSIONS }),
      400,
      limit.headers,
    );
  }

  const text = await request.text();
  if (text.length > 262_144) {
    return rpcResponse(errorMessage(null, JSONRPC.INVALID_REQUEST, 'Request body too large'), 413, limit.headers);
  }
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return rpcResponse(errorMessage(null, JSONRPC.PARSE_ERROR, 'Parse error'), 400, limit.headers);
  }

  if (Array.isArray(payload)) {
    if (payload.length === 0) return rpcResponse(errorMessage(null, JSONRPC.INVALID_REQUEST, 'Invalid Request: empty batch'), 400, limit.headers);
    const replies = payload.map(handleMessage).filter((r): r is object => r !== null);
    if (replies.length === 0) return new Response(null, { status: 202, headers: headers(limit.headers) });
    return rpcResponse(replies, 200, limit.headers);
  }

  const reply = handleMessage(payload);
  if (reply === null) return new Response(null, { status: 202, headers: headers(limit.headers) });
  return rpcResponse(reply, 200, limit.headers);
}

export function handleMcpGet(request: Request): Response {
  const accept = request.headers.get('accept') ?? '';
  if (accept.includes('text/html')) {
    return Response.redirect(absoluteUrl('/developers#mcp'), 307);
  }
  return new Response(
    JSON.stringify({
      error: 'This MCP endpoint does not offer a server-sent event stream. Send JSON-RPC requests with POST.',
      docs: absoluteUrl('/developers#mcp'),
    }),
    { status: 405, headers: headers({ Allow: 'POST, OPTIONS' }) },
  );
}

export function handleMcpOptions(): Response {
  return new Response(null, { status: 204, headers: new Headers(CORS_HEADERS) });
}

export function handleMcpDelete(): Response {
  // No sessions are issued, so there is nothing to terminate.
  return new Response(null, { status: 405, headers: headers({ Allow: 'POST, OPTIONS' }) });
}

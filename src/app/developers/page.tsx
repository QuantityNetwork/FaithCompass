import type { Metadata } from 'next';
import Link from 'next/link';
import { PageIntro, Section } from '@/components/record/ui';
import { CopyButton } from '@/components/ui/copy-button';
import { ERROR_CODES, rateLimitPerMinute } from '@/lib/api/http';
import { ENDPOINTS_V1, SCHEMA_NAMES } from '@/lib/api/v1';
import { SUPPORTED_PROTOCOL_VERSIONS, handleMessage } from '@/lib/mcp/server';
import { TOOLS, toolListing } from '@/lib/mcp/tools';
import { getRecord } from '@/lib/record/record';
import { API_VERSION, absoluteUrl, legacyOrigins } from '@/lib/site/config';

export const metadata: Metadata = {
  title: 'Developers',
  description:
    'Machine access to the AbrahamMoses record: a REST API with published schemas and an MCP server for AI agents. One canonical host, public and read-only.',
  alternates: { canonical: '/developers' },
};

function Code({ children, label }: { children: string; label?: string }) {
  return (
    <>
      {label ? <div className="code-label">{label}</div> : null}
      <pre className="code" tabIndex={0} aria-label={label ?? 'Code example'}>
        {children}
      </pre>
    </>
  );
}

function truncate(json: unknown, max = 1600) {
  const text = JSON.stringify(json, null, 2);
  return text.length > max ? `${text.slice(0, max)}\n  …` : text;
}

export default function DevelopersPage() {
  const record = getRecord();
  const mcp = absoluteUrl('/mcp');
  const rest = absoluteUrl('/api/v1');

  // Real exchanges, produced by the handler as this page renders.
  const init = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'example', version: '1.0' } } };
  const call = { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get_claim', arguments: { code: 'AM-CLAIM-000184' } } };
  const sim = { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'simulate_rejection', arguments: { reject_axioms: ['AM-AX-002'] } } };
  const initReply = handleMessage(init) as { result: Record<string, unknown> };
  const callReply = handleMessage(call) as { result: { structuredContent: Record<string, unknown> } };
  const simReply = handleMessage(sim) as { result: { structuredContent: { epistemic_summary: unknown; affected: Array<{ code: string; status: string; epistemic_status: string }> } } };

  const claudeCode = `claude mcp add --transport http abrahammoses ${mcp}`;
  const desktopConfig = JSON.stringify({ mcpServers: { abrahammoses: { type: 'http', url: mcp } } }, null, 2);
  const curlInit = `curl -s ${mcp} \\
  -H 'Content-Type: application/json' \\
  -H 'Accept: application/json, text/event-stream' \\
  -d '${JSON.stringify(init)}'`;
  const curlCall = `curl -s ${mcp} \\
  -H 'Content-Type: application/json' \\
  -H 'Accept: application/json, text/event-stream' \\
  -H 'MCP-Protocol-Version: 2025-06-18' \\
  -d '${JSON.stringify(call)}'`;

  return (
    <main id="main" className="shell page">
      <PageIntro
        eyebrow="Machine access"
        title="Structured theology, retrievable by machine"
        lede="Two interfaces over the same record, documented and versioned separately: a REST API for applications and an MCP server for AI agents. Both are public and read-only, return published and provisional records only — never drafts — and carry provenance with every claim."
      />

      <div className="grid-2 section--tight">
        <div className="card">
          <div className="card__meta">Canonical host</div>
          <p className="mono" style={{ margin: '6px 0' }}>
            {absoluteUrl('')}
          </p>
          <p className="small muted" style={{ margin: 0 }}>
            Every URL in the documentation, the API and the MCP manifest is generated from one setting. The{' '}
            <Link className="link" href="/status">
              status page
            </Link>{' '}
            checks that it matches the host serving requests.
          </p>
        </div>
        <div className="card">
          <div className="card__meta">Versions</div>
          <p style={{ margin: '6px 0' }}>
            REST API {API_VERSION} · MCP {SUPPORTED_PROTOCOL_VERSIONS.join(', ')} · record <span className="mono">{record.version}</span>
          </p>
          <p className="small muted" style={{ margin: 0 }}>
            Additive changes keep v1; a breaking change would ship as /api/v2, with v1 kept through an announced deprecation
            period. Every response carries <code className="code-inline">X-Record-Version</code>.
          </p>
          <p className="small muted" style={{ margin: '6px 0 0' }}>
            1.1 (2026-10-20, additive): simulation and comparison outcomes carry{' '}
            <code className="code-inline">epistemic_status</code> (supported, partially_supported, support_weakened,
            not_established, insufficient_evidence, disputed_interpretation) beside the unchanged legacy{' '}
            <code className="code-inline">status</code>; display that, not the legacy value.{' '}
            <code className="code-inline">headline_confidence</code> is deprecated and will be removed in v2.
          </p>
        </div>
      </div>

      <Section id="mcp" title="MCP server" eyebrow="For AI agents">
        <div className="prose-block">
          <p>
            Streamable HTTP transport in stateless JSON mode at <code className="code-inline">{mcp}</code>. Send JSON-RPC 2.0
            with <code className="code-inline">POST</code>; responses are <code className="code-inline">application/json</code>.
            No account, key or session is needed — the server issues no <code className="code-inline">Mcp-Session-Id</code>, which
            the specification permits — but it implements the full exchange: <code className="code-inline">initialize</code>,{' '}
            <code className="code-inline">tools/list</code>, <code className="code-inline">tools/call</code>, resources and prompts.
            A <code className="code-inline">GET</code> is answered with 405, as the server sends no unsolicited messages.
          </p>
          <p>
            The previously published address <code className="code-inline">{absoluteUrl('/api/public/mcp')}</code> also accepts
            MCP over POST, so clients configured with it keep working; a GET there still returns the service manifest.
          </p>
          {legacyOrigins().length > 0 && (
            <p>
              The record moved to <code className="code-inline">{absoluteUrl('')}</code>. The previous{' '}
              {legacyOrigins().length === 1 ? 'host' : 'hosts'}{' '}
              {legacyOrigins().map((o, i) => (
                <span key={o}>
                  {i > 0 && ', '}
                  <code className="code-inline">{o}</code>
                </span>
              ))}{' '}
              still {legacyOrigins().length === 1 ? 'serves' : 'serve'} the MCP server and the REST API directly, without a
              redirect, so existing configurations keep working. Please update them to the address above.
            </p>
          )}
        </div>
        <Code label="Claude Code">{claudeCode}</Code>
        <CopyButton text={claudeCode} label="Copy command" />
        <Code label="Claude Desktop, Cursor, VS Code and other clients (mcp.json)">{desktopConfig}</Code>
        <p className="small muted">
          In claude.ai, add a custom connector with the URL above; no authentication is required.
        </p>
        <Code label="Initialize with curl">{curlInit}</Code>
        <Code label="Response (generated by the server as this page rendered)">{truncate({ jsonrpc: '2.0', id: 1, result: initReply.result }, 900)}</Code>
        <Code label="Call a tool">{curlCall}</Code>
        <Code label="Response: structuredContent (excerpt)">{truncate(callReply.result.structuredContent, 1400)}</Code>
        <Code label="simulate_rejection { reject_axioms: ['AM-AX-002'] } — epistemic summary">
          {truncate({ epistemic_summary: simReply.result.structuredContent.epistemic_summary, affected: simReply.result.structuredContent.affected.map((a) => `${a.code}: ${a.epistemic_status} (legacy status: ${a.status})`) }, 1200)}
        </Code>

        <h3 className="subheading section--tight">Tools</h3>
        <div className="stack">
          {TOOLS.map((t) => {
            const listing = toolListing(t);
            return (
              <details key={t.name} className="disclosure" id={`tool-${t.name}`}>
                <summary>
                  <code className="code-inline">{t.name}</code> — {t.title}
                </summary>
                <div className="disclosure__body">
                  <p className="small">{t.description}</p>
                  <Code label="Input schema">{JSON.stringify(listing.inputSchema, null, 2)}</Code>
                  <p className="small faint">
                    Output schema: published with the tool listing ({Object.keys((listing.outputSchema.properties as object) ?? {}).length}{' '}
                    top-level fields). Annotations: read-only, idempotent, closed world.
                  </p>
                </div>
              </details>
            );
          })}
        </div>
        <p className="small muted">
          Resources: <code className="code-inline">abrahammoses://cases/&#123;slug&#125;</code>,{' '}
          <code className="code-inline">abrahammoses://claims/&#123;code&#125;</code>,{' '}
          <code className="code-inline">abrahammoses://claims/&#123;code&#125;/provenance</code>,{' '}
          <code className="code-inline">abrahammoses://axioms/&#123;code&#125;</code>,{' '}
          <code className="code-inline">abrahammoses://methodology/dependency-semantics</code>. Prompts:{' '}
          <code className="code-inline">examine_question</code>, <code className="code-inline">challenge_assumption</code>.
        </p>
        <p className="small muted">
          Conformance is tested on every build with the official MCP TypeScript SDK client, connecting over HTTP to both
          endpoints, listing tools, calling them with output-schema validation, reading resources and listing prompts.
        </p>
      </Section>

      <Section id="rest" title="REST API v1" eyebrow="For applications">
        <div className="prose-block">
          <p>
            Base URL <code className="code-inline">{rest}</code>. JSON responses; no key. The{' '}
            <a className="link" href="/api/v1/openapi.json">
              OpenAPI 3.1 document
            </a>{' '}
            and the JSON Schemas below are generated from the same definitions the responses are tested against.
          </p>
        </div>
        <div className="table-wrap">
          <table className="table table--stack">
            <thead>
              <tr>
                <th scope="col">Method</th>
                <th scope="col">Path</th>
                <th scope="col">Description</th>
                <th scope="col">Try it</th>
              </tr>
            </thead>
            <tbody>
              {ENDPOINTS_V1.map((e) => (
                <tr key={`${e.method} ${e.path}`}>
                  <td data-label="Method" className="mono">
                    {e.method}
                  </td>
                  <td data-label="Path" className="mono">
                    /api/v1{e.path === '/' ? '' : e.path}
                  </td>
                  <td data-label="Description">
                    {e.summary}
                    {e.description ? <div className="faint">{e.description}</div> : null}
                  </td>
                  <td data-label="Try it">
                    {e.method === 'GET' ? (
                      <a className="link mono" href={`/api/v1${e.example === '/' ? '' : e.example}`}>
                        {e.example}
                      </a>
                    ) : (
                      <span className="mono faint">POST {e.example}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Code label="Examples">{`curl ${rest}/claims/AM-CLAIM-000184
curl "${rest}/claims?topic=Torah&limit=5"
curl "${rest}/search?q=Who%20are%20the%20heirs%20of%20Ibrahim"
curl "${rest}/simulate?reject_axioms=AM-AX-002"
curl -X POST ${rest}/simulate -H 'Content-Type: application/json' \\
     -d '{"reject_claims":["AM-CLAIM-000186"],"lens":"rabbinic-judaism"}'
curl ${rest}/claims/AM-CLAIM-000191/citation?rev=1
curl ${rest}/export > abrahammoses-record.json`}</Code>
        <Code label="From a browser (CORS is open)">{`const res = await fetch("${rest}/doctrine?node=abraham");
const { total, data } = await res.json();
// data[i]: code, source, source_label, target, target_label, relationship_type,
//          description, evidence[], classification, tradition_status, grounded_by[]`}</Code>

        <h3 className="subheading section--tight" id="schemas">
          Schema explorer
        </h3>
        <div className="node-index">
          {SCHEMA_NAMES.map((n) => (
            <a key={n} className="filter-link" href={`/api/v1/schema/${n}`}>
              {n}
            </a>
          ))}
        </div>
      </Section>

      <Section id="errors" title="Errors, limits and caching">
        <p className="small muted" style={{ marginTop: 0 }}>
          Every error has the same shape — <code className="code-inline">{'{ error: { code, message, status, details?, docs } }'}</code>{' '}
          — and clients should branch on <code className="code-inline">code</code>.
        </p>
        <div className="table-wrap">
          <table className="table table--stack">
            <thead>
              <tr>
                <th scope="col">Code</th>
                <th scope="col">HTTP</th>
                <th scope="col">Meaning</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(ERROR_CODES).map(([code, m]) => (
                <tr key={code} id={`error-${code}`}>
                  <td data-label="Code" className="mono">
                    {code}
                  </td>
                  <td data-label="HTTP">{m.status}</td>
                  <td data-label="Meaning">{m.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="prose-block small" style={{ fontSize: 15 }}>
          <li>
            <strong>Rate limits:</strong> {rateLimitPerMinute()} requests per minute per client address, per server instance.
            Every response carries <code className="code-inline">RateLimit-Limit</code>,{' '}
            <code className="code-inline">RateLimit-Remaining</code> and <code className="code-inline">RateLimit-Reset</code>; a 429
            carries <code className="code-inline">Retry-After</code>.
          </li>
          <li>
            <strong>Caching:</strong> responses carry an <code className="code-inline">ETag</code> and honour{' '}
            <code className="code-inline">If-None-Match</code>; shared caches may hold them for 60 seconds.
          </li>
          <li>
            <strong>CORS:</strong> any origin may call the API and the MCP server from a browser.
          </li>
          <li>
            <strong>Legacy endpoints:</strong> <code className="code-inline">/api/public/*</code> keeps the shapes existing clients
            depend on, with additive fields only. New integrations should use v1 or MCP.
          </li>
        </ul>
      </Section>
    </main>
  );
}

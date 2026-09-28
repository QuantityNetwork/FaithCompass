import Link from "next/link";
import type { ReactNode } from "react";
import { CATEGORY_META, TOOL_CATEGORIES } from "@/domain/categories";
import { WEBHOOK_EVENT_TYPES } from "@/domain/entities";
import { EXECUTION_CLASSES, EXECUTION_CLASS_META } from "@/domain/execution-classes";
import { SCOPES, SCOPE_DEFINITIONS } from "@/domain/scopes";
import { ExecutionClassBadge } from "@/components/mcp/badges";
import { CodeBlock } from "@/components/ui/code-block";
import { toolRecords } from "@/server/tools/registry";
import { SUPPORTED_PROTOCOL_VERSIONS } from "@/server/mcp/protocol";

const URL_BASE = process.env.SAGOLIK_PUBLIC_URL ?? "https://mcp.sagolik.com";

function Callout({ tone = "info", title, children }: { tone?: "info" | "warning" | "execute"; title?: string; children: ReactNode }) {
  const styles = { info: "border-info/20 bg-info-soft", warning: "border-warning/25 bg-warning-soft", execute: "border-execute/20 bg-execute-soft" }[tone];
  return (
    <div className={`my-5 rounded-md border px-4 py-3 text-[14px] leading-relaxed ${styles}`}>
      {title && <p className="mb-1 font-semibold text-fg">{title}</p>}
      <div className="text-body">{children}</div>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="my-5 overflow-x-auto rounded-lg border border-line">
      <table className="w-full text-left text-[13px]">
        <thead className="border-b border-line bg-surface text-[12px] text-muted">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-4 py-2.5 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className="px-4 py-2.5 align-top text-body">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const Code = ({ children }: { children: ReactNode }) => <code>{children}</code>;

/* ───────────────────────── Pages ───────────────────────── */

function Introduction() {
  return (
    <>
      <p>
        <strong>Sagolik MCP</strong> is the agent interface to Sagolik. It lets AI clients — Claude, ChatGPT, Cursor, Sagolik’s own agents and enterprise systems — understand, simulate, prepare and execute property and financial workflows through the{" "}
        <a href="https://modelcontextprotocol.io">Model Context Protocol</a>.
      </p>
      <p>It is a controlled gateway, not an open API. Every request passes the same path:</p>
      <CodeBlock
        code={`AI client
  → Sagolik MCP gateway (Streamable HTTP, JSON-RPC 2.0)
  → Authentication        environment-bound bearer token
  → Authorization         scopes · role ceiling · per-tool permissions
  → Policy engine         environment · limits · approval requirement
  → Tool registry         semantic business tools only
  → Execution layer       tenant-scoped data access, provider adapters
  → Audit                 append-only, hash-chained record`}
      />
      <h2>The operating model</h2>
      <p>
        Sagolik never confuses AI reasoning with authority to act. The platform enforces a fixed sequence:{" "}
        <strong>KNOW → ANALYZE → SIMULATE → PREPARE → APPROVE → EXECUTE → AUDIT</strong>. An agent may understand a user’s situation deeply while holding only the exact authority it was granted.
      </p>
      <Table
        head={["Class", "What the agent may do", "Effect"]}
        rows={EXECUTION_CLASSES.map((c) => [<ExecutionClassBadge key={c} value={c} />, EXECUTION_CLASS_META[c].summary, EXECUTION_CLASS_META[c].effect])}
      />
      <h2>What agents never get</h2>
      <ul>
        <li>Low-level operations such as <Code>insert_row</Code>, <Code>execute_sql</Code> or <Code>raw_api_call</Code>. Tools represent intent.</li>
        <li>Provider credentials, unmasked account numbers or document contents.</li>
        <li>Wildcard authority. Every connection holds an explicit, reviewable scope set.</li>
        <li>The ability to act on production data from the sandbox, or on another organization’s data.</li>
      </ul>
      <h2>Endpoints</h2>
      <Table
        head={["Environment", "MCP endpoint"]}
        rows={[
          ["Sandbox", <Code key="s">{URL_BASE}/sandbox/mcp</Code>],
          ["Production", <Code key="p">{URL_BASE}/mcp</Code>],
        ]}
      />
      <p>
        Continue with the <Link href="/docs/quick-start">Quick start</Link>.
      </p>
    </>
  );
}

function QuickStart() {
  return (
    <>
      <p>Connect an agent to the sandbox, confirm it can see Sagolik’s tools, and run a harmless READ call. About two minutes.</p>
      <h2>1. Create a connection</h2>
      <p>
        In the console, open <Link href="/connections/new">Connect an Agent</Link>. Name the connection — the name appears verbatim in approval requests — and keep the default environment, <strong>Sandbox</strong>.
      </p>
      <h2>2. Choose a client and permissions</h2>
      <p>
        Pick Claude, ChatGPT, Cursor or a custom MCP client. The default grant is read and simulate only. Add PREPARE or EXECUTE scopes only when the agent needs them; EXECUTE actions always stop for your approval regardless.
      </p>
      <h2>3. Configure the client</h2>
      <p>OAuth-capable clients (claude.ai, Claude Desktop, ChatGPT) need only the endpoint URL; permissions are confirmed on Sagolik’s authorization screen. Header-based clients (Claude Code, Cursor, custom agents) receive a scoped token, shown once.</p>
      <CodeBlock title="Claude Code" code={`claude mcp add --transport http sagolik-sandbox \\\n  ${URL_BASE}/sandbox/mcp \\\n  --header "Authorization: Bearer sgk_test_ct_…"`} />
      <h2>4. Test</h2>
      <CodeBlock
        title="Any HTTP client"
        code={`curl -s ${URL_BASE}/sandbox/mcp \\
  -H "Authorization: Bearer $SAGOLIK_SANDBOX_TOKEN" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_closing_status","arguments":{"property_id":"SGK-1042"}}}'`}
      />
      <p>
        The sandbox contains a synthetic purchase — <strong>245 Mercer Avenue, Austin, TX</strong> (SGK-1042), $875,000, 25% down, closing in four weeks — plus an owned townhouse (SGK-1017) and a prospective property (SGK-1063).
      </p>
      <h2>5. Ask your agent</h2>
      <Callout title="Try this prompt">“Use Sagolik to tell me what remains before this property can close.”</Callout>
      <p>
        The agent calls <Code>get_closing_status</Code> and <Code>identify_closing_blockers</Code>. Both are READ: no record changes, and each call appears in the <Link href="/audit">audit log</Link>.
      </p>
    </>
  );
}

function ConnectClaude() {
  return (
    <>
      <h2>claude.ai and Claude Desktop (custom connector)</h2>
      <ol>
        <li>In Claude, open Settings → Connectors and choose Add custom connector.</li>
        <li>
          Enter a name such as <strong>Sagolik (Sandbox)</strong> and the URL <Code>{URL_BASE}/sandbox/mcp</Code>.
        </li>
        <li>Select Connect. Claude registers itself with Sagolik (dynamic client registration) and opens Sagolik’s authorization screen.</li>
        <li>Sign in, review the requested permissions, deselect anything you do not want, and approve.</li>
      </ol>
      <p>Claude now lists only the tools your grant allows. Revoke access at any time from Connections.</p>
      <h2>Claude Code</h2>
      <p>Create a token connection in the console, then:</p>
      <CodeBlock code={`claude mcp add --transport http sagolik-sandbox ${URL_BASE}/sandbox/mcp \\\n  --header "Authorization: Bearer $SAGOLIK_SANDBOX_TOKEN"`} />
      <h2>Claude Desktop with a token</h2>
      <p>If you prefer a token over OAuth, bridge through <Code>mcp-remote</Code>:</p>
      <CodeBlock
        title="claude_desktop_config.json"
        code={JSON.stringify({ mcpServers: { "sagolik-sandbox": { command: "npx", args: ["-y", "mcp-remote", `${URL_BASE}/sandbox/mcp`, "--header", "Authorization: Bearer ${SAGOLIK_SANDBOX_TOKEN}"] } } }, null, 2)}
      />
      <Callout tone="warning">Treat tokens like passwords. Sagolik stores only their SHA-256 hash and cannot display them again.</Callout>
    </>
  );
}

function ConnectChatGPT() {
  return (
    <>
      <ol>
        <li>In ChatGPT, enable developer mode for connectors (Settings → Apps &amp; Connectors → Advanced).</li>
        <li>
          Create a connector with the MCP server URL <Code>{URL_BASE}/sandbox/mcp</Code> and OAuth authentication.
        </li>
        <li>Complete the Sagolik authorization screen, granting only the permissions you need.</li>
      </ol>
      <p>ChatGPT discovers Sagolik’s authorization server through the protected-resource metadata advertised in the 401 challenge:</p>
      <CodeBlock code={`WWW-Authenticate: Bearer resource_metadata="${URL_BASE}/.well-known/oauth-protected-resource/sandbox/mcp"`} />
    </>
  );
}

function ConnectCursor() {
  return (
    <>
      <p>Create a token connection in the console, then add Sagolik to Cursor’s MCP configuration.</p>
      <CodeBlock title="~/.cursor/mcp.json" code={JSON.stringify({ mcpServers: { "sagolik-sandbox": { url: `${URL_BASE}/sandbox/mcp`, headers: { Authorization: "Bearer ${env:SAGOLIK_SANDBOX_TOKEN}" } } } }, null, 2)} />
      <p>Keep the token in an environment variable rather than in the file. Cursor lists the tools your connection may call; tools outside your scopes are not advertised.</p>
    </>
  );
}

function Authentication() {
  return (
    <>
      <p>Sagolik MCP supports two ways to authenticate an agent. Both produce a session bound to exactly one connection, one organization and one environment.</p>
      <h2>OAuth 2.1 (recommended for interactive clients)</h2>
      <ul>
        <li>Authorization-code flow with PKCE. Only <Code>S256</Code> is accepted.</li>
        <li>Dynamic client registration (RFC 7591) at <Code>/oauth/register</Code>. A registered client has no access until a member consents.</li>
        <li>Resource indicators (RFC 8707): the <Code>resource</Code> parameter selects the sandbox or production endpoint and binds the resulting tokens to it.</li>
        <li>Access tokens live for the organization’s session lifetime (default 60 minutes). Refresh tokens rotate on every use; reuse of a spent refresh token revokes the whole connection.</li>
        <li>Authorization codes are single-use and expire after five minutes; replaying one revokes the connection.</li>
      </ul>
      <Table
        head={["Metadata", "URL"]}
        rows={[
          ["Authorization server (RFC 8414)", <Code key="a">/.well-known/oauth-authorization-server</Code>],
          ["Protected resource — production (RFC 9728)", <Code key="b">/.well-known/oauth-protected-resource/mcp</Code>],
          ["Protected resource — sandbox", <Code key="c">/.well-known/oauth-protected-resource/sandbox/mcp</Code>],
          ["Authorize · token · revoke", <Code key="d">/oauth/authorize · /oauth/token · /oauth/revoke</Code>],
        ]}
      />
      <h2>Connection tokens</h2>
      <p>
        For headless agents and developer tools, the console issues a connection token: <Code>sgk_test_ct_…</Code> for the sandbox, <Code>sgk_live_ct_…</Code> for production. Tokens expire (1–90 days), are shown once, and are stored only as SHA-256 hashes.
      </p>
      <h2>Environment binding</h2>
      <p>The token prefix encodes its environment. A sandbox token presented to the production endpoint — or the reverse — is rejected before any other processing.</p>
      <Callout title="Authentication is not authorization">A valid token only identifies the caller. Every call is then evaluated by the policy engine against the connection’s scopes, the member’s role, organization policy and the tool’s requirements.</Callout>
    </>
  );
}

function Permissions() {
  return (
    <>
      <h2>Scopes</h2>
      <p>Scopes are explicit. There are no wildcards, and the database rejects any connection without at least one known scope.</p>
      <Table
        head={["Scope", "Class", "Grants"]}
        rows={SCOPES.map((s) => [<Code key={s}>{s}</Code>, <ExecutionClassBadge key={`${s}-c`} value={SCOPE_DEFINITIONS[s].executionClass} />, SCOPE_DEFINITIONS[s].description])}
      />
      <h2>Layers of control</h2>
      <Table
        head={["Layer", "Rule"]}
        rows={[
          ["Tool scopes", "A tool is reachable only if every one of its required scopes is granted."],
          ["Connection ceiling", "A connection cannot exceed the highest execution class implied by its scopes."],
          ["Per-tool permissions", "Individual tools can be disabled for a connection even when its scopes allow them."],
          ["Role ceiling", "Viewers authorize up to SIMULATE, members up to PREPARE, administrators and owners up to EXECUTE."],
          ["Production guard", "EXECUTE in production is off until an owner enables it."],
          ["Transaction limits", "Per-connection and organization limits are checked against the action amount."],
          ["Approval", "EXECUTE always requires a human approval; approvals are single-use and argument-bound."],
          ["Rate limits", "Per connection, per tool and per organization, plus loop protection for identical calls."],
        ]}
      />
      <p>Tools the caller may not invoke are not listed in <Code>tools/list</Code>. The <Code>get_authorization_context</Code> tool tells an agent exactly what it can and cannot do, and why.</p>
      <h2>Dynamic scope checks and data minimization</h2>
      <p>
        Some tools return more when more scopes are granted. <Code>get_property</Code>, for example, returns restricted sections — <Code>{`{"restricted": true, "required_scope": "finance.read"}`}</Code> — instead of data the connection may not see. Funds tools return conclusions and totals by default; per-account balances only when explicitly requested and permitted.
      </p>
    </>
  );
}

function Environments() {
  return (
    <>
      <Table
        head={["", "Sandbox", "Production"]}
        rows={[
          ["Endpoint", <Code key="1">/sandbox/mcp</Code>, <Code key="2">/mcp</Code>],
          ["Token prefix", <Code key="3">sgk_test_</Code>, <Code key="4">sgk_live_</Code>],
          ["Data", "Synthetic properties, transactions, documents and accounts", "Live Sagolik records"],
          ["Financial data", "Sagolik Sandbox Bank (synthetic)", "Connected providers such as Plaid"],
          ["Payments", "Simulated scheduling — no funds move", "Connected regulated provider, otherwise reminders only"],
          ["EXECUTE", "Available with approval", "Disabled until an owner enables it; always with approval"],
        ]}
      />
      <h2>How isolation is enforced</h2>
      <ul>
        <li>Every tenant row carries <Code>(organization_id, environment)</Code>; foreign keys include both, so a sandbox row can never reference a production row.</li>
        <li>Sandbox providers are rejected for production data by database constraints.</li>
        <li>Tool handlers receive a data accessor bound to one organization and one environment; they cannot address anything else.</li>
        <li>Tokens are environment-bound, and the console’s environment switch only selects a view — it never grants anything.</li>
      </ul>
      <p>Organizations can reset their sandbox at any time from Settings. Production rows are never touched.</p>
    </>
  );
}

function Approvals() {
  return (
    <>
      <p>EXECUTE actions — activating Autopilot, sending a document request to a counterparty — always require an explicit human decision.</p>
      <h2>Flow</h2>
      <ol>
        <li>The agent calls the EXECUTE tool. Sagolik validates permissions and resolves exactly what would happen.</li>
        <li>
          Sagolik creates an approval request and returns <Code>approval_required</Code> with an <Code>approval_id</Code>. Nothing is executed.
        </li>
        <li>The user reviews the request in the console: requesting agent, action, affected property and account, amount, provider, expected result, risks, expiry and the permissions exercised.</li>
        <li>A member whose role allows the action approves or rejects.</li>
        <li>
          The agent calls the same tool again with identical arguments plus <Code>approval_id</Code>. Sagolik executes once and records the result.
        </li>
      </ol>
      <CodeBlock
        title="approval_required"
        code={JSON.stringify(
          {
            status: "approval_required",
            tool: "activate_property_autopilot",
            requires_approval: true,
            approval: {
              approval_id: "3f6c…",
              status: "pending",
              summary: "Claude is requesting permission to activate Sagolik Autopilot for Property #SGK-1042 (245 Mercer Avenue, Austin, TX): schedule 2 recurring payments …",
              expires_at: "…",
              review_url: `${URL_BASE}/approvals/3f6c…`,
              next_step: "Ask the user to review and approve this request in Sagolik …",
            },
          },
          null,
          2,
        )}
      />
      <h2>Guarantees</h2>
      <ul>
        <li>
          <strong>Specific.</strong> Summaries name the agent, the action and the asset — never “Claude wants access”.
        </li>
        <li>
          <strong>Bound.</strong> An approval covers one connection, one tool and a fingerprint of the exact arguments.
        </li>
        <li>
          <strong>Single-use.</strong> Execution consumes the approval atomically; repeated calls return the original result.
        </li>
        <li>
          <strong>Expiring.</strong> Pending approvals expire (default 60 minutes). States: pending, approved, denied, expired, completed, failed.
        </li>
        <li>
          <strong>Deduplicated.</strong> Repeating an identical request returns the open approval instead of creating another.
        </li>
      </ul>
    </>
  );
}

function Audit() {
  return (
    <>
      <p>Every MCP invocation — successful, denied, rate-limited or awaiting approval — produces exactly one immutable audit record.</p>
      <Table
        head={["Field", "Content"]}
        rows={[
          ["Who", "User, organization, AI client, connection, session, IP and user agent"],
          ["What", "Tool and version, execution class, SHA-256 hash of the arguments (arguments themselves are not stored)"],
          ["Why", "Policy decision with the reasoning of every rule, scopes exercised, approval id and state"],
          ["Outcome", "Status, error code, duration, providers touched and whether records changed"],
          ["Integrity", "Per-organization sequence number, previous hash and record hash"],
        ]}
      />
      <h2>Immutability</h2>
      <p>
        Records are append-only: database triggers reject <Code>UPDATE</Code>, <Code>DELETE</Code> and <Code>TRUNCATE</Code> for every application role, including the service role the gateway uses. Each record’s hash covers its content and the previous record’s hash, so any alteration is detectable with{" "}
        <Code>sgk_verify_audit_chain(organization_id)</Code>. The console shows chain status on the Audit page.
      </p>
      <p>
        A database administrator could still disable triggers and recompute the chain. To make that evident too, keep the latest <Code>record_hash</Code> outside Sagolik at regular intervals — a periodic CSV export is enough — and confirm later exports still contain it unchanged.
      </p>
      <h2>Verifying an export independently</h2>
      <p>
        The CSV export contains every hashed field, so an auditor can check the chain without access to Sagolik. Records are chained per organization in <Code>sequence</Code> order; the first record’s{" "}
        <Code>prev_hash</Code> is 64 zeros, and each later one equals the previous <Code>record_hash</Code>.
      </p>
      <CodeBlock
        title="record_hash"
        code={`record_hash = hex(sha256(utf8(join("|", [
  prev_hash, sequence, id, organization_id, environment,
  created_at,        // UTC, six fractional digits: 2026-09-28T15:00:00.123000Z
  tool_name, status,
  arguments_hash,    // "" when absent
  policy_decision,   // "" when absent
  approval_id,       // "" when absent
  state_changed      // "true" or "false"
]))))`}
      />
      <h2>Reading the log</h2>
      <p>Each entry reads plainly, for example:</p>
      <Callout>
        <strong>Claude</strong> used <Code>compare_financing_scenarios</Code> · Sandbox · No production changes made.
      </Callout>
      <p>Filter by client, tool, environment, date, execution class, outcome and approval state, and export CSV for review.</p>
    </>
  );
}

function ToolsReference() {
  const tools = toolRecords();
  return (
    <>
      <p>
        {tools.length} tools across {TOOL_CATEGORIES.length} categories. Each links to its full specification, including the model-facing description and JSON Schemas.
      </p>
      {TOOL_CATEGORIES.map((cat) => {
        const inCat = tools.filter((t) => t.category === cat);
        if (!inCat.length) return null;
        return (
          <section key={cat}>
            <h2>{CATEGORY_META[cat].label}</h2>
            <p className="text-muted">{CATEGORY_META[cat].description}</p>
            <Table
              head={["Tool", "Class", "Scopes", "Summary"]}
              rows={inCat.map((t) => [
                <Link key={t.name} href={`/tools/${t.name}`} className="whitespace-nowrap font-mono text-[12.5px]">
                  {t.name}
                </Link>,
                <ExecutionClassBadge key={`${t.name}-c`} value={t.execution_class} />,
                <span key={`${t.name}-s`} className="font-mono text-[11.5px] text-muted">
                  {t.required_scopes.join(", ") || "—"}
                </span>,
                t.structured_description.summary,
              ])}
            />
          </section>
        );
      })}
    </>
  );
}

function ToolSchemas() {
  const example = toolRecords().find((t) => t.name === "get_closing_status")!;
  return (
    <>
      <p>Every tool publishes a JSON Schema (draft 2020-12) for its input and for the <Code>data</Code> it returns. Inputs are strict: unknown fields are rejected rather than ignored.</p>
      <h2>The response envelope</h2>
      <p>
        Every call returns the same envelope, both as <Code>structuredContent</Code> and as JSON text for older clients. <Code>outputSchema</Code> in <Code>tools/list</Code> describes the envelope with <Code>data</Code> typed per tool.
      </p>
      <CodeBlock
        code={JSON.stringify(
          {
            status: "success",
            tool: "get_closing_status",
            version: "1.0",
            environment: "sandbox",
            request_id: "…",
            audit_id: "…",
            summary: "SGK-1042 closes 2026-10-26 (28 days). 4/11 stages complete …",
            data: {},
            warnings: [],
            requires_approval: false,
            meta: { execution_class: "read", state_changed: false, duration_ms: 3 },
          },
          null,
          2,
        )}
      />
      <Table
        head={["Field", "Meaning"]}
        rows={[
          [<Code key="1">status</Code>, "success · partial · needs_input · needs_clarification · approval_required · denied · failed · unavailable"],
          [<Code key="2">data</Code>, "Present for success and partial; conforms to the tool's output schema"],
          [<Code key="3">summary / message</Code>, "Human-readable text for success / every other status"],
          [<Code key="4">missing_fields · invalid_fields · clarification</Code>, "What the agent must ask the user for — never guess"],
          [<Code key="5">approval</Code>, "Approval id, status, summary, expiry, review URL and next step"],
          [<Code key="6">meta.state_changed</Code>, "Whether any record was created or changed"],
        ]}
      />
      <h2>Example: get_closing_status input</h2>
      <CodeBlock code={JSON.stringify(example.input_schema, null, 2)} />
      <p>
        MCP protocol versions supported: {SUPPORTED_PROTOCOL_VERSIONS.map((v) => <Code key={v}>{v} </Code>)}.
      </p>
    </>
  );
}

function Errors() {
  return (
    <>
      <p>Errors are structured. Sagolik never returns stack traces, secrets or database details; failures carry a request reference instead.</p>
      <CodeBlock code={JSON.stringify({ status: "needs_input", missing_fields: ["property_id"], message: "A property must be selected before this analysis can be performed." }, null, 2)} />
      <Table
        head={["Status", "Meaning", "What the agent should do"]}
        rows={[
          [<Code key="1">needs_input</Code>, "Required information is missing", "Ask the user for missing_fields; options may list valid choices"],
          [<Code key="2">needs_clarification</Code>, "The request is ambiguous or refers to something that does not exist", "Ask the user; never guess identifiers, amounts or accounts"],
          [<Code key="3">approval_required</Code>, "A human must approve", "Show the summary; call again with approval_id after approval"],
          [<Code key="4">denied</Code>, "Policy forbids the call", "Explain the missing permission; do not retry"],
          [<Code key="5">failed</Code>, "The call failed", "Retry only if error.retryable is true"],
          [<Code key="6">unavailable</Code>, "A provider or capability is unavailable", "Retry later or tell the user"],
        ]}
      />
      <h2>Error codes</h2>
      <Table
        head={["Code", "Cause"]}
        rows={[
          ["insufficient_scope", "The connection lacks a required scope"],
          ["execution_class_not_permitted · role_not_permitted", "Connection or member ceiling exceeded"],
          ["production_execute_disabled", "EXECUTE in production is disabled for the organization"],
          ["tool_disabled_for_connection", "The tool was disabled for this connection"],
          ["transaction_limit_exceeded", "The action amount exceeds a configured limit"],
          ["rate_limited · loop_detected", "Too many calls, or identical calls repeated; see retry_after_seconds"],
          ["approval_denied · approval_expired · approval_mismatch · approval_not_found", "Approval cannot be used"],
          ["idempotency_conflict", "An idempotency_key was reused with different arguments"],
          ["unknown_tool", "No such tool (JSON-RPC -32602)"],
          ["timeout · internal_error · output_contract_violation", "Execution failed; reference the request_id"],
        ]}
      />
      <h2>Idempotency</h2>
      <p>
        PREPARE tools accept an optional <Code>idempotency_key</Code>; without one, Sagolik derives a key from the connection and the exact arguments, so accidental repeats return the original draft instead of creating another. EXECUTE tools are idempotent through their single-use approval.
      </p>
    </>
  );
}

function Webhooks() {
  return (
    <>
      <p>Webhook endpoints receive signed JSON events for the environment they belong to.</p>
      <Table head={["Event", ""]} rows={WEBHOOK_EVENT_TYPES.map((e) => [<Code key={e}>{e}</Code>, ""])} />
      <h2>Delivery</h2>
      <ul>
        <li>HTTPS only. Private, loopback and link-local destinations are refused when saved and re-checked at delivery.</li>
        <li>Retries after 1 minute, 5 minutes, 30 minutes, 2 hours and 12 hours; then the delivery is marked failed. Failed deliveries can be retried manually.</li>
        <li>Respond with any 2xx status within 10 seconds. Redirects are not followed.</li>
      </ul>
      <h2>Signatures</h2>
      <CodeBlock code={`Sagolik-Signature: t=1790000000,v1=5f2b…\n\nsigned_payload = \`\${t}.\${raw_body}\`\nv1 = HMAC_SHA256(signing_secret, signed_payload)`} />
      <p>Reject events older than five minutes. During secret rotation, both the new and previous secret sign for 24 hours, producing two <Code>v1</Code> values.</p>
    </>
  );
}

function Versioning() {
  return (
    <>
      <p>Each tool has a semantic version. The major version is the compatibility contract: within a major version, changes are additive.</p>
      <ul>
        <li>
          Tools are identified as <Code>name@major</Code> (for example <Code>analyze_property_purchase@1</Code>). Calls without a pin use the latest active major.
        </li>
        <li>
          Pin a major version with <Code>{`"_meta": {"sagolik/tool_version": 1}`}</Code> in <Code>tools/call</Code>.
        </li>
        <li>Breaking changes ship as a new major. The previous major becomes <strong>deprecated</strong> — still callable, with a policy note — before it is <strong>retired</strong>, after which calls are denied with <Code>tool_retired</Code>.</li>
        <li>Changes are recorded in each tool’s changelog and in the <Link href="/docs/changelog">platform changelog</Link>.</li>
      </ul>
      <h2>Extending the platform</h2>
      <p>Future Sagolik modules — Wallet, ID, Scan, Cover, Pay, Auctions and institutional services — register tools in the same registry and inherit the same authentication, permissions, policy engine, approvals, audit and console. No module brings its own security model.</p>
    </>
  );
}

function SecurityDoc() {
  return (
    <>
      <p>
        The security model is summarized on the <Link href="/security">Security</Link> page. This section lists the concrete mechanisms.
      </p>
      <Table
        head={["Concern", "Mechanism"]}
        rows={[
          ["Credentials at rest", "Tokens, codes and client secrets stored as SHA-256 hashes; webhook secrets and provider credentials encrypted with AES-256-GCM"],
          ["Tenant isolation", "Row Level Security on every table; composite (id, organization_id, environment) foreign keys; server-side scoping of every query"],
          ["Browser access", "Browser roles can read only their organizations’ non-secret rows and can write nothing; secret tables have no policies or grants"],
          ["Least privilege", "Explicit scopes, role ceilings, per-tool restrictions, production EXECUTE off by default"],
          ["Human control", "Single-use, argument-bound, expiring approvals for every EXECUTE action"],
          ["Abuse", "Per-connection, per-tool and per-organization rate limits; loop detection; body size limits"],
          ["Integrity", "Append-only, hash-chained audit log with verification function"],
          ["Revocation", "Connections and sessions revoked immediately; refresh-token and code replay revoke the connection"],
          ["Transport", "HTTPS with HSTS; strict security headers; no cookies on the MCP endpoint"],
        ]}
      />
    </>
  );
}

function Changelog() {
  return (
    <>
      <h2>1.0.0 — September 28, 2026</h2>
      <ul>
        <li>Initial release of Sagolik MCP with {toolRecords().length} tools across property, financing, closing, documents, cash flow, ownership, Autopilot, identity, integrations and administration.</li>
        <li>OAuth 2.1 with PKCE, dynamic client registration and resource indicators; environment-bound connection tokens.</li>
        <li>Policy engine with scopes, role ceilings, per-tool permissions, transaction limits and production guard.</li>
        <li>Human approval engine for EXECUTE actions; idempotency for PREPARE actions.</li>
        <li>Append-only, hash-chained audit log; signed webhooks; sandbox with synthetic data.</li>
      </ul>
    </>
  );
}

export const DOC_CONTENT: Record<string, () => ReactNode> = {
  "": Introduction,
  "quick-start": QuickStart,
  "connect-claude": ConnectClaude,
  "connect-chatgpt": ConnectChatGPT,
  "connect-cursor": ConnectCursor,
  authentication: Authentication,
  permissions: Permissions,
  environments: Environments,
  approvals: Approvals,
  audit: Audit,
  tools: ToolsReference,
  "tool-schemas": ToolSchemas,
  errors: Errors,
  webhooks: Webhooks,
  versioning: Versioning,
  security: SecurityDoc,
  changelog: Changelog,
};


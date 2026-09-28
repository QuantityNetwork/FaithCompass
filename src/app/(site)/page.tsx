import Link from "next/link";
import { CATEGORY_META, TOOL_CATEGORIES } from "@/domain/categories";
import { EXECUTION_CLASS_META, type ExecutionClass } from "@/domain/execution-classes";
import { ENVIRONMENT_META } from "@/domain/environments";
import { ClassDot, ExecutionClassBadge } from "@/components/mcp/badges";
import { ArchitectureDiagram } from "@/components/site/architecture";
import { OperatingModel } from "@/components/site/operating-model";
import { SessionTrace } from "@/components/site/session-trace";
import { WorkflowSequence } from "@/components/site/workflow";
import { ButtonLink } from "@/components/ui/button";
import { CodeBlock } from "@/components/ui/code-block";
import { toolRecords } from "@/server/tools/registry";

const PUBLIC_URL = process.env.SAGOLIK_PUBLIC_URL ?? "https://mcp.sagolik.com";

const CLASSES: { cls: ExecutionClass; heading: string; body: string; examples: string[] }[] = [
  {
    cls: "read",
    heading: "Understand",
    body: "Retrieve authorized financial, property and transaction data.",
    examples: ["get_closing_status", "get_property", "get_connected_accounts"],
  },
  {
    cls: "simulate",
    heading: "Simulate",
    body: "Model financing, closing costs, cash flow and ownership scenarios without changing live data.",
    examples: ["compare_financing_scenarios", "calculate_cash_to_close"],
  },
  {
    cls: "prepare",
    heading: "Prepare",
    body: "Let agents assemble workflows, documentation and actions for human review.",
    examples: ["prepare_property_autopilot", "prepare_closing_checklist"],
  },
  {
    cls: "execute",
    heading: "Execute",
    body: "Allow approved agents to take controlled actions with explicit authorization and complete auditability.",
    examples: ["activate_property_autopilot", "submit_document_request"],
  },
];

const TRUST = [
  ["Scoped access", "Every connection holds explicit scopes. There are no wildcards and no default authority to act."],
  ["Human approvals", "EXECUTE actions always stop for a specific, human-readable approval before anything happens."],
  ["Sandbox isolation", "Sandbox tokens cannot reach production endpoints; the database refuses cross-environment references."],
  ["Immutable audit", "Every call is written to an append-only, hash-chained audit trail with its policy reasoning."],
  ["Tenant isolation", "Organizations are isolated in the database itself through row-level security and composite keys."],
  ["Instant revocation", "Revoking a connection invalidates its sessions on the very next request."],
];

export default function LandingPage() {
  const tools = toolRecords();
  const claudeCode = `claude mcp add --transport http sagolik-sandbox \\
  ${PUBLIC_URL}${ENVIRONMENT_META.sandbox.mcpPath} \\
  --header "Authorization: Bearer $SAGOLIK_SANDBOX_TOKEN"`;

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,#f7f9fb,transparent_70%)]" aria-hidden />
        <div className="relative mx-auto max-w-[1200px] px-4 pb-16 pt-16 text-center sm:px-6 sm:pb-20 sm:pt-24 md:pt-28">
          <p className="eyebrow">Sagolik MCP</p>
          <h1 className="mx-auto mt-5 max-w-3xl text-[44px] font-semibold leading-[1.04] tracking-[-0.035em] text-fg md:text-[64px]">
            The agent interface to Sagolik.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-[17px] leading-relaxed text-muted md:text-[19px]">
            Securely connect Claude, ChatGPT, Cursor and autonomous systems to Sagolik’s property, financial and ownership infrastructure.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href="/connections/new" size="lg">
              Connect an Agent
            </ButtonLink>
            <ButtonLink href="/tools" size="lg" variant="secondary">
              Explore Tools
            </ButtonLink>
            <ButtonLink href="/docs" size="lg" variant="ghost">
              View Documentation →
            </ButtonLink>
          </div>
          <div className="mx-auto mt-16 max-w-4xl text-left">
            <SessionTrace />
          </div>
        </div>
      </section>

      {/* Execution classes */}
      <section className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 sm:py-24">
        <div className="max-w-2xl">
          <p className="eyebrow">Authority model</p>
          <h2 className="mt-3 text-[32px] font-semibold leading-tight tracking-[-0.025em]">An agent may understand more than it is allowed to do.</h2>
          <p className="mt-4 text-[16px] leading-relaxed text-muted">
            Every tool belongs to one execution class. Reading and simulating never change records. Preparing creates drafts. Executing always requires explicit human approval.
          </p>
        </div>
        <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-2 lg:grid-cols-4">
          {CLASSES.map((c) => (
            <div key={c.cls} className="flex flex-col bg-canvas p-6">
              <ExecutionClassBadge value={c.cls} className="self-start" />
              <h3 className="mt-5 text-[19px] font-semibold uppercase tracking-[0.02em]">{c.heading}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{c.body}</p>
              <p className="mt-2 text-[12.5px] text-subtle">{EXECUTION_CLASS_META[c.cls].effect}</p>
              <ul className="mt-auto space-y-1 pt-6">
                {c.examples.map((e) => (
                  <li key={e} className="font-mono text-[12px] text-body">
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Operating model */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 sm:py-20">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow">Operating model</p>
              <h2 className="mt-3 text-[28px] font-semibold tracking-[-0.022em]">Reasoning is never mistaken for authority.</h2>
            </div>
            <p className="max-w-md text-[14px] text-muted">Each step is a boundary the platform enforces — not a convention agents are asked to follow.</p>
          </div>
          <div className="mt-10">
            <OperatingModel />
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Architecture</p>
          <h2 className="mt-3 text-[32px] font-semibold tracking-[-0.025em]">A controlled gateway, not an open API.</h2>
          <p className="mt-4 text-[16px] leading-relaxed text-muted">
            Agents call business-level tools. Sagolik authenticates, evaluates policy, executes against its own services and records the outcome. Agents never see databases, provider credentials or raw account data.
          </p>
        </div>
        <div className="mt-14">
          <ArchitectureDiagram />
        </div>
      </section>

      {/* Workflows */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 sm:py-24">
          <div className="max-w-2xl">
            <p className="eyebrow">Workflows</p>
            <h2 className="mt-3 text-[32px] font-semibold tracking-[-0.025em]">The difference between preparing and executing is fundamental.</h2>
          </div>
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <WorkflowSequence
              title="Read"
              prompt="Use Sagolik to tell me what remains before this property can close."
              steps={[
                { title: "Claude", kind: "agent" },
                { title: "get_closing_status", cls: "read" },
                { title: "Sagolik MCP authentication", detail: "Environment-bound token, active connection" },
                { title: "Policy check", detail: "closing.read granted — READ permitted" },
                { title: "Sagolik retrieves transaction data" },
                { title: "Structured result returned", detail: "Status, stages, blockers, audit id" },
                { title: "Claude summarizes blockers", kind: "agent" },
              ]}
              footnote="No database write occurs."
            />
            <WorkflowSequence
              title="Act"
              prompt="Prepare autopilot for this property."
              steps={[
                { title: "Agent", kind: "agent" },
                { title: "inspect_property_obligations", cls: "read" },
                { title: "prepare_property_autopilot", cls: "prepare", detail: "Sagolik creates a proposed plan — nothing is active" },
                { title: "Human reviews the plan", kind: "human", detail: "Exact payees, amounts, account and risks" },
                { title: "User approves", kind: "human" },
                { title: "activate_property_autopilot", cls: "execute", detail: "Single-use approval, fingerprint-matched" },
                { title: "Execution and audit record" },
              ]}
              footnote="Activation without an approved, unexpired, matching approval is impossible."
            />
          </div>
        </div>
      </section>

      {/* Tool library */}
      <section className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 sm:py-24">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow">Tool library</p>
            <h2 className="mt-3 text-[32px] font-semibold tracking-[-0.025em]">{tools.length} semantic tools. No raw database access.</h2>
            <p className="mt-4 text-[16px] text-muted">Tools represent intent — never insert_row, execute_sql or raw_api_call.</p>
          </div>
          <ButtonLink href="/tools" variant="secondary">
            Explore all tools
          </ButtonLink>
        </div>
        <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {TOOL_CATEGORIES.map((cat) => {
            const inCat = tools.filter((t) => t.category === cat);
            if (inCat.length === 0) return null;
            return (
              <div key={cat}>
                <p className="text-[13px] font-semibold text-fg">{CATEGORY_META[cat].label}</p>
                <ul className="mt-3 space-y-2 border-l border-line pl-4">
                  {inCat.map((t) => (
                    <li key={t.tool_id} className="flex items-center gap-2">
                      <ClassDot value={t.execution_class} />
                      <Link href={`/tools/${t.name}`} className="break-all font-mono text-[12.5px] text-body hover:text-fg">
                        {t.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* Trust */}
      <section className="border-y border-line bg-brand text-white">
        <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 sm:py-24">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/55">Institutional trust</p>
            <h2 className="mt-3 text-[32px] font-semibold tracking-[-0.025em] text-white">AI agents never receive uncontrolled access to Sagolik.</h2>
          </div>
          <div className="mt-12 grid gap-px overflow-hidden rounded-xl bg-white/10 md:grid-cols-3">
            {TRUST.map(([title, body]) => (
              <div key={title} className="bg-brand p-6">
                <p className="text-[15px] font-semibold text-white">{title}</p>
                <p className="mt-2 text-[13.5px] leading-relaxed text-white/65">{body}</p>
              </div>
            ))}
          </div>
          <Link href="/security" className="mt-8 inline-block text-[14px] text-white/80 underline-offset-4 hover:text-white hover:underline">
            Read the security model →
          </Link>
        </div>
      </section>

      {/* Connect */}
      <section className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 sm:py-24">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-center [&>*]:min-w-0">
          <div>
            <p className="eyebrow">Connect in a minute</p>
            <h2 className="mt-3 text-[32px] font-semibold tracking-[-0.025em]">Start in the sandbox. Move to production deliberately.</h2>
            <p className="mt-4 text-[16px] leading-relaxed text-muted">
              Every new connection defaults to the sandbox, with synthetic properties, accounts and closings. Production requires its own connection, its own token and an explicit grant.
            </p>
            <dl className="mt-8 space-y-3 text-[13.5px]">
              <div className="flex gap-4">
                <dt className="w-20 shrink-0 text-muted sm:w-24">Sandbox</dt>
                <dd className="min-w-0 break-all font-mono text-fg">{PUBLIC_URL}/sandbox/mcp</dd>
              </div>
              <div className="flex gap-4">
                <dt className="w-20 shrink-0 text-muted sm:w-24">Production</dt>
                <dd className="min-w-0 break-all font-mono text-fg">{PUBLIC_URL}/mcp</dd>
              </div>
            </dl>
            <div className="mt-8 flex gap-3">
              <ButtonLink href="/connections/new">Connect an Agent</ButtonLink>
              <ButtonLink href="/docs/quick-start" variant="secondary">
                Quick start
              </ButtonLink>
            </div>
          </div>
          <div className="space-y-4">
            <CodeBlock title="Claude Code" code={claudeCode} tone="dark" />
            <CodeBlock
              title="Cursor · ~/.cursor/mcp.json"
              tone="dark"
              code={JSON.stringify({ mcpServers: { "sagolik-sandbox": { url: `${PUBLIC_URL}/sandbox/mcp`, headers: { Authorization: "Bearer ${env:SAGOLIK_SANDBOX_TOKEN}" } } } }, null, 2)}
            />
          </div>
        </div>
      </section>
    </>
  );
}

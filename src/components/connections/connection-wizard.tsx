"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { CLIENT_META, type ClientType } from "@/domain/clients";
import type { Environment } from "@/domain/environments";
import { EXECUTION_CLASSES, EXECUTION_CLASS_META } from "@/domain/execution-classes";
import { DEFAULT_SCOPES, SCOPES, SCOPE_DEFINITIONS, type Scope } from "@/domain/scopes";
import { createConnectionAction, testConnectionAction, type CreateConnectionResult, type TestResult } from "@/app/(console)/connections/actions";
import { ClientMonogram, ExecutionClassBadge } from "@/components/mcp/badges";
import { Button, ButtonLink } from "@/components/ui/button";
import { CodeBlock } from "@/components/ui/code-block";
import { Input, Label, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";

type Variant = "oauth" | "token";

const STEPS = ["Name", "Environment", "Client", "Permissions", "Configuration", "Test connection", "First call"];

interface Props {
  publicUrl: string;
  demo: boolean;
  canCreateProduction: boolean;
  grantableScopes: Scope[];
}

export function ConnectionWizard({ publicUrl, demo, canCreateProduction, grantableScopes }: Props) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("Claude");
  const [environment, setEnvironment] = useState<Environment>("sandbox");
  const [clientType, setClientType] = useState<ClientType>("claude");
  const [variant, setVariant] = useState<Variant>("oauth");
  const [scopes, setScopes] = useState<Scope[]>(DEFAULT_SCOPES.filter((s) => grantableScopes.includes(s)));
  const [expires, setExpires] = useState<"1" | "7" | "30" | "90">("30");
  const [limit, setLimit] = useState("");
  const [created, setCreated] = useState<Extract<CreateConnectionResult, { ok: true }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [test, setTest] = useState<TestResult | null>(null);
  const [firstCall, setFirstCall] = useState<TestResult | null>(null);
  const [pending, start] = useTransition();

  const endpoint = `${publicUrl}${environment === "sandbox" ? "/sandbox/mcp" : "/mcp"}`;
  const oauth = variant === "oauth";
  const locked = created !== null;

  const chooseClient = (type: ClientType) => {
    setClientType(type);
    const auth = CLIENT_META[type].auth;
    setVariant(auth[0]!);
    if (name === "" || Object.values(CLIENT_META).some((m) => m.label === name)) setName(CLIENT_META[type].label);
  };

  const toggleScope = (scope: Scope) => setScopes((cur) => (cur.includes(scope) ? cur.filter((s) => s !== scope) : [...cur, scope]));

  const generate = () =>
    start(async () => {
      setError(null);
      const res = await createConnectionAction({
        name,
        environment,
        clientType,
        scopes,
        expiresInDays: expires,
        transactionLimit: limit ? Number(limit) : null,
      });
      if (res.ok) {
        setCreated(res);
        setStep(4);
      } else setError(res.error);
    });

  const runTest = (runTool: boolean) =>
    start(async () => {
      if (!created) return;
      const res = await testConnectionAction({ token: created.token, environment, runTool });
      if (runTool) setFirstCall(res);
      else setTest(res);
    });

  const hasExecute = scopes.some((s) => SCOPE_DEFINITIONS[s].executionClass === "execute");
  const canContinue = [name.trim().length > 0, true, true, scopes.length > 0, true, true, true][step];

  const snippets = useMemo(() => {
    const token = created?.token ?? "<token>";
    const label = `sagolik-${environment}`;
    return {
      claudeCode: `claude mcp add --transport http ${label} \\\n  ${endpoint} \\\n  --header "Authorization: Bearer ${token}"`,
      cursor: JSON.stringify({ mcpServers: { [label]: { url: endpoint, headers: { Authorization: `Bearer ${token}` } } } }, null, 2),
      desktop: JSON.stringify({ mcpServers: { [label]: { command: "npx", args: ["-y", "mcp-remote", endpoint, "--header", `Authorization: Bearer ${token}`] } } }, null, 2),
      curl: `curl -s ${endpoint} \\\n  -H "Authorization: Bearer ${token}" \\\n  -H "Content-Type: application/json" \\\n  -H "Accept: application/json, text/event-stream" \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`,
    };
  }, [created, endpoint, environment]);

  return (
    <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
      <ol className="space-y-1" aria-label="Steps">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              disabled={i > step || (locked && i < 4)}
              onClick={() => setStep(i)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-[13px] transition-colors",
                i === step ? "bg-surface-3 font-medium text-fg" : i < step ? "text-body hover:bg-surface-2" : "text-subtle",
              )}
            >
              <span
                className={cn(
                  "tnum flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10.5px] font-semibold",
                  i < step ? "border-brand bg-brand text-white" : i === step ? "border-brand text-brand" : "border-line-strong text-subtle",
                )}
              >
                {i < step ? "✓" : i + 1}
              </span>
              {label}
            </button>
          </li>
        ))}
      </ol>

      <div className="min-w-0 rounded-lg border border-line bg-canvas">
        <div className="border-b border-line px-6 py-5">
          <p className="eyebrow">
            Step {step + 1} of {STEPS.length}
          </p>
          <h2 className="mt-1.5 text-[18px] font-semibold">
            {
              [
                "Create a Sagolik MCP connection",
                "Choose an environment",
                "Choose your AI client",
                "Select permissions",
                "Connection configuration",
                "Test the connection",
                "Run a harmless READ tool",
              ][step]
            }
          </h2>
        </div>

        <div className="px-6 py-6">
          {step === 0 && (
            <div className="max-w-md">
              <Label htmlFor="name" hint="Shown in approvals and audit">
                Connection name
              </Label>
              <Input id="name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="e.g. Claude — closing assistant" />
              <p className="mt-3 text-[13px] leading-relaxed text-muted">
                Approval requests use this name verbatim — for example, “{name || "Claude"} is requesting permission to prepare recurring HOA and property-tax payments for Property #SGK-1042.”
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {(["sandbox", "production"] as const).map((env) => {
                const disabled = env === "production" && (!canCreateProduction || demo);
                return (
                  <button
                    key={env}
                    type="button"
                    disabled={disabled}
                    onClick={() => setEnvironment(env)}
                    className={cn(
                      "rounded-lg border p-5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                      environment === env ? "border-brand ring-2 ring-brand/10" : "border-line hover:border-line-strong",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn("h-2 w-2 rounded-full", env === "sandbox" ? "bg-sandbox" : "bg-brand")} />
                      <span className="text-[14px] font-semibold capitalize text-fg">{env}</span>
                      {env === "sandbox" && <span className="text-[12px] text-muted">· Recommended</span>}
                    </div>
                    <p className="mt-2 text-[13px] leading-relaxed text-muted">
                      {env === "sandbox"
                        ? "Synthetic properties, accounts and closings. Simulated providers. Nothing can affect production."
                        : demo
                          ? "Unavailable in demo mode — no database is configured."
                          : canCreateProduction
                            ? "Live Sagolik records. Use only after validating the agent in the sandbox."
                            : "Only owners and administrators can create production connections."}
                    </p>
                    <p className="mt-3 font-mono text-[11.5px] text-subtle">{`${publicUrl}${env === "sandbox" ? "/sandbox/mcp" : "/mcp"}`}</p>
                  </button>
                );
              })}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {(["claude", "chatgpt", "cursor", "custom"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => chooseClient(type)}
                    className={cn("flex items-center gap-3 rounded-lg border p-4 text-left transition-colors", clientType === type ? "border-brand ring-2 ring-brand/10" : "border-line hover:border-line-strong")}
                  >
                    <ClientMonogram type={type} />
                    <span className="text-[14px] font-medium text-fg">{CLIENT_META[type].label}</span>
                  </button>
                ))}
              </div>
              {CLIENT_META[clientType].auth.length > 1 && (
                <div>
                  <p className="mb-2 text-[12.5px] font-medium text-fg">How will it connect?</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {CLIENT_META[clientType].auth.map((v) => (
                      <label key={v} className={cn("flex cursor-pointer gap-3 rounded-lg border p-4", variant === v ? "border-brand ring-2 ring-brand/10" : "border-line")}>
                        <input type="radio" name="variant" className="mt-1 accent-brand" checked={variant === v} onChange={() => setVariant(v)} />
                        <span>
                          <span className="block text-[13.5px] font-medium text-fg">
                            {v === "oauth" ? (clientType === "claude" ? "Custom connector (claude.ai and Claude Desktop)" : "OAuth authorization") : clientType === "claude" ? "Claude Code (connection token)" : "Connection token"}
                          </span>
                          <span className="mt-0.5 block text-[12.5px] text-muted">
                            {v === "oauth" ? "You approve permissions on a Sagolik authorization screen. No secret is copied." : "A scoped bearer token is generated once and pasted into the client's configuration."}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              {oauth && (
                <p className="rounded-md border border-info/20 bg-info-soft px-4 py-3 text-[13px] text-info">
                  With OAuth, you confirm these permissions again on the Sagolik authorization screen when {CLIENT_META[clientType].label} connects.
                </p>
              )}
              {EXECUTION_CLASSES.map((cls) => {
                const inClass = SCOPES.filter((s) => SCOPE_DEFINITIONS[s].executionClass === cls);
                return (
                  <fieldset key={cls}>
                    <legend className="mb-2 flex items-center gap-2">
                      <ExecutionClassBadge value={cls} />
                      <span className="text-[12.5px] text-muted">{EXECUTION_CLASS_META[cls].effect}</span>
                    </legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {inClass.map((s) => {
                        const grantable = grantableScopes.includes(s);
                        return (
                          <label key={s} className={cn("flex gap-3 rounded-md border px-3.5 py-3", scopes.includes(s) ? "border-brand/40 bg-brand-soft/40" : "border-line", !grantable && "opacity-50")}>
                            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand" checked={scopes.includes(s)} disabled={!grantable} onChange={() => toggleScope(s)} />
                            <span className="min-w-0">
                              <span className="flex items-center gap-2 text-[13px] font-medium text-fg">
                                {SCOPE_DEFINITIONS[s].label}
                                <code className="font-mono text-[11px] font-normal text-subtle">{s}</code>
                              </span>
                              <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{SCOPE_DEFINITIONS[s].description}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                );
              })}
              {hasExecute && (
                <p className="rounded-md border border-execute/20 bg-execute-soft px-4 py-3 text-[13px] text-execute">
                  EXECUTE scopes let this agent request real-world actions. Every such action still stops for your explicit approval.
                </p>
              )}
              {!oauth && (
                <div className="grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="expires">Token expiry</Label>
                    <Select id="expires" value={expires} onChange={(e) => setExpires(e.target.value as typeof expires)}>
                      <option value="1">1 day</option>
                      <option value="7">7 days</option>
                      <option value="30">30 days</option>
                      <option value="90">90 days</option>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="limit" hint="Optional">
                      Transaction limit (USD)
                    </Label>
                    <Input id="limit" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="No limit" />
                  </div>
                </div>
              )}
              {error && <p className="text-[13px] text-danger">{error}</p>}
            </div>
          )}

          {step === 4 &&
            (oauth ? (
              <div className="space-y-5 text-[13.5px] leading-relaxed">
                <p className="text-muted">Add Sagolik as a remote MCP server in {CLIENT_META[clientType].label}. The client registers itself and opens Sagolik’s authorization screen, where you confirm permissions.</p>
                <CodeBlock title="Remote MCP server URL" code={endpoint} />
                <ol className="list-decimal space-y-2 pl-5 text-body">
                  {clientType === "claude" ? (
                    <>
                      <li>In Claude, open Settings → Connectors and choose Add custom connector.</li>
                      <li>
                        Name it <strong>Sagolik ({environment === "sandbox" ? "Sandbox" : "Production"})</strong> and paste the URL above.
                      </li>
                      <li>Select Connect. Sign in to Sagolik if asked, review the requested permissions and approve.</li>
                    </>
                  ) : (
                    <>
                      <li>In ChatGPT, enable developer mode for connectors (Settings → Apps & Connectors → Advanced).</li>
                      <li>Create a connector with the URL above and OAuth authentication.</li>
                      <li>Authorize on the Sagolik screen that opens, choosing only the permissions you need.</li>
                    </>
                  )}
                </ol>
                <p className="text-muted">
                  The connection appears on the <Link href="/connections" className="text-link hover:underline">Connections</Link> page as soon as you authorize.
                </p>
              </div>
            ) : created ? (
              <div className="space-y-5">
                <div className="rounded-md border border-warning/25 bg-warning-soft px-4 py-3 text-[13px] text-warning">
                  Copy this token now. Sagolik stores only its hash and cannot show it again.
                </div>
                <CodeBlock title={`Connection token · expires ${new Date(created.expiresAt ?? "").toLocaleDateString()}`} code={created.token} />
                {clientType === "claude" && <CodeBlock title="Claude Code" code={snippets.claudeCode} tone="dark" />}
                {clientType === "claude" && <CodeBlock title="Claude Desktop · claude_desktop_config.json (via mcp-remote)" code={snippets.desktop} tone="dark" />}
                {clientType === "cursor" && <CodeBlock title="Cursor · ~/.cursor/mcp.json" code={snippets.cursor} tone="dark" />}
                {(clientType === "custom" || clientType === "sagolik_agent") && <CodeBlock title="Any MCP client · Streamable HTTP" code={snippets.curl} tone="dark" />}
              </div>
            ) : null)}

          {step === 5 &&
            (oauth ? (
              <p className="text-[13.5px] text-muted">
                Once authorized, {CLIENT_META[clientType].label} lists Sagolik’s tools automatically. Verify the new connection on the <Link href="/connections" className="text-link hover:underline">Connections</Link> page.
              </p>
            ) : (
              <div className="space-y-4">
                <p className="text-[13.5px] text-muted">Sends initialize and tools/list to {endpoint} with the new token — exactly what your client will do.</p>
                <Button onClick={() => runTest(false)} disabled={pending}>
                  {pending ? "Testing…" : "Test connection"}
                </Button>
                {test && (test.ok ? (
                  <div className="rounded-md border border-success/25 bg-success-soft px-4 py-3 text-[13px] text-success">
                    Connected to {test.serverName} · protocol {test.protocolVersion} · {test.tools} tools available with these permissions · {test.latencyMs} ms
                  </div>
                ) : (
                  <div className="rounded-md border border-danger/25 bg-danger-soft px-4 py-3 text-[13px] text-danger">{test.error}</div>
                ))}
              </div>
            ))}

          {step === 6 && (
            <div className="space-y-4">
              {oauth ? (
                <>
                  <p className="text-[13.5px] text-muted">Ask {CLIENT_META[clientType].label}:</p>
                  <blockquote className="rounded-md border border-line bg-surface px-4 py-3 text-[14px] text-fg">“Use Sagolik to tell me what remains before this property can close.”</blockquote>
                  <p className="text-[13.5px] text-muted">It will call get_closing_status — a READ tool. No record changes; the call appears in the audit log.</p>
                </>
              ) : (
                <>
                  <p className="text-[13.5px] text-muted">Calls get_closing_status through the MCP endpoint. If Sagolik asks which property, the test answers the way an agent would.</p>
                  <Button onClick={() => runTest(true)} disabled={pending}>
                    {pending ? "Running…" : "Run get_closing_status"}
                  </Button>
                  {firstCall && (firstCall.ok ? <CodeBlock title="Structured response" code={JSON.stringify(firstCall.envelope, null, 2)} className="max-h-[420px] overflow-auto" /> : <p className="text-[13px] text-danger">{firstCall.error}</p>)}
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-4">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || (locked && step <= 4)}>
            Back
          </Button>
          {step < 3 && (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canContinue}>
              Continue
            </Button>
          )}
          {step === 3 &&
            (oauth ? (
              <Button onClick={() => setStep(4)} disabled={!canContinue}>
                Show connector setup
              </Button>
            ) : (
              <Button onClick={generate} disabled={!canContinue || pending}>
                {pending ? "Generating…" : "Generate configuration"}
              </Button>
            ))}
          {step >= 4 && step < 6 && <Button onClick={() => setStep((s) => s + 1)}>Continue</Button>}
          {step === 6 && <ButtonLink href={created ? `/connections/${created.connectionId}` : "/connections"}>Finish</ButtonLink>}
        </div>
      </div>
    </div>
  );
}

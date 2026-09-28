"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import type { Environment } from "@/domain/environments";
import type { ExecutionClass } from "@/domain/execution-classes";
import type { ResponseStatus } from "@/domain/statuses";
import { runToolAction, type ExplorerRun } from "@/app/(console)/tools/explorer/actions";
import { ClassDot, EnvironmentBadge, ExecutionClassBadge, StatusBadge } from "@/components/mcp/badges";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/cn";
import { SchemaForm, type JsonSchema } from "./schema-form";

export interface ExplorerTool {
  name: string;
  title: string;
  version: string;
  categoryLabel: string;
  executionClass: ExecutionClass;
  requiredScopes: string[];
  approvalRequired: boolean;
  idempotency: string;
  summary: string;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
}

interface Props {
  tools: ExplorerTool[];
  initialTool: string;
  environment: Environment;
  examples: Record<string, Record<string, unknown>>;
  connections: { id: string; name: string; environment: Environment }[];
  demo: boolean;
  consoleLabel: string;
}

type Tab = "response" | "request" | "policy" | "schema";

function Json({ value, className }: { value: unknown; className?: string }) {
  const text = JSON.stringify(value, null, 2);
  return (
    <div className={cn("relative", className)}>
      <div className="absolute right-3 top-3">
        <CopyButton value={text} className="bg-canvas" />
      </div>
      <pre className="max-h-[620px] overflow-auto rounded-md border border-line bg-surface px-4 py-3.5 font-mono text-[12px] leading-[1.65] text-fg">{text}</pre>
    </div>
  );
}

export function ToolExplorer({ tools, initialTool, environment: initialEnv, examples, connections, demo, consoleLabel }: Props) {
  const router = useRouter();
  const [toolName, setToolName] = useState(initialTool);
  const tool = tools.find((t) => t.name === toolName) ?? tools[0]!;
  const [environment, setEnvironment] = useState<Environment>(initialEnv);
  const [runAs, setRunAs] = useState<string>("console");
  const [mode, setMode] = useState<"form" | "json">("form");
  const [args, setArgs] = useState<Record<string, unknown>>(examples[tool.name] ?? {});
  const [jsonText, setJsonText] = useState(JSON.stringify(examples[tool.name] ?? {}, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [run, setRun] = useState<ExplorerRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("response");
  const [pending, start] = useTransition();

  const selectTool = (name: string) => {
    setToolName(name);
    const example = examples[name] ?? {};
    setArgs(example);
    setJsonText(JSON.stringify(example, null, 2));
    setJsonError(null);
    setRun(null);
    setError(null);
    router.replace(`/tools/explorer?tool=${name}`, { scroll: false });
  };

  const updateArgs = (next: Record<string, unknown>) => {
    setArgs(next);
    setJsonText(JSON.stringify(next, null, 2));
  };

  const onJson = (text: string) => {
    setJsonText(text);
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Arguments must be a JSON object.");
      setArgs(parsed);
      setJsonError(null);
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : "Invalid JSON");
    }
  };

  const execute = useCallback(
    (override?: Record<string, unknown>) => {
      if (jsonError && !override) return;
      start(async () => {
        setError(null);
        const res = await runToolAction({ tool: tool.name, arguments: override ?? args, environment, connectionId: runAs === "console" ? null : runAs });
        if (res.ok) {
          setRun(res.run);
          setTab("response");
        } else setError(res.error);
      });
    },
    [args, environment, jsonError, runAs, tool.name],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        execute();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [execute]);

  const grouped = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = tools.filter((t) => !q || t.name.includes(q) || t.title.toLowerCase().includes(q));
    const groups = new Map<string, ExplorerTool[]>();
    for (const t of list) groups.set(t.categoryLabel, [...(groups.get(t.categoryLabel) ?? []), t]);
    return [...groups.entries()];
  }, [filter, tools]);

  const envConnections = connections.filter((c) => c.environment === environment);
  const envelope = run?.envelope;
  const approval = envelope?.approval;

  return (
    <div className="grid overflow-hidden rounded-lg border border-line bg-canvas lg:grid-cols-[250px_1fr]">
      {/* Tool list */}
      <aside className="border-b border-line bg-surface lg:border-b-0 lg:border-r">
        <div className="border-b border-line p-3">
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter tools" className="h-8 w-full rounded-md border border-line-strong bg-canvas px-2.5 text-[13px] focus:border-focus focus:outline-none" />
        </div>
        <div className="max-h-[260px] overflow-y-auto p-2 lg:max-h-[calc(100vh-220px)]">
          {grouped.map(([label, list]) => (
            <div key={label} className="mb-3">
              <p className="eyebrow px-2 py-1.5 text-[10px]">{label}</p>
              {list.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => selectTool(t.name)}
                  className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left", t.name === tool.name ? "bg-canvas shadow-[var(--shadow-hairline)]" : "hover:bg-surface-2")}
                >
                  <ClassDot value={t.executionClass} />
                  <span className={cn("truncate font-mono text-[12px]", t.name === tool.name ? "text-fg" : "text-body")}>{t.name}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>

      <div className="min-w-0">
        {/* Tool header + controls */}
        <div className="border-b border-line px-6 py-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="font-mono text-[17px] font-semibold">{tool.name}</h2>
            <span className="font-mono text-[12px] text-subtle">v{tool.version}</span>
            <ExecutionClassBadge value={tool.executionClass} />
            {tool.approvalRequired && <span className="text-[12px] font-medium text-execute">Requires approval</span>}
            <Link href={`/tools/${tool.name}`} className="ml-auto text-[12.5px] text-link hover:underline">
              Documentation
            </Link>
          </div>
          <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-muted">{tool.summary}</p>
          <p className="mt-1.5 font-mono text-[11.5px] text-subtle">scopes: {tool.requiredScopes.join(", ") || "none"}</p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="inline-flex h-8 items-center rounded-lg bg-surface-2 p-0.5" role="radiogroup" aria-label="Environment">
              {(["sandbox", "production"] as const).map((env) => (
                <button
                  key={env}
                  type="button"
                  role="radio"
                  aria-checked={environment === env}
                  disabled={env === "production" && demo}
                  title={env === "production" && demo ? "Production is unavailable in demo mode" : undefined}
                  onClick={() => {
                    setEnvironment(env);
                    setRunAs("console");
                  }}
                  className={cn("h-7 rounded-md px-3 text-[12.5px] font-medium capitalize disabled:opacity-40", environment === env ? "bg-canvas text-fg shadow-[0_1px_2px_rgb(10_22_40/0.08)]" : "text-muted")}
                >
                  {env}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-[12.5px] text-muted">
              Run as
              <select value={runAs} onChange={(e) => setRunAs(e.target.value)} className="h-8 rounded-md border border-line-strong bg-canvas px-2 text-[12.5px] text-fg">
                <option value="console">{consoleLabel}</option>
                {envConnections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (connection grant)
                  </option>
                ))}
              </select>
            </label>
            <div className="ml-auto flex items-center gap-2">
              <button type="button" onClick={() => updateArgs(examples[tool.name] ?? {})} className="text-[12.5px] text-muted hover:text-fg">
                Load example
              </button>
              <Button onClick={() => execute()} disabled={pending || !!jsonError}>
                {pending ? "Running…" : "Run"}
                <kbd className="rounded bg-white/15 px-1 font-sans text-[10.5px]">⌘↵</kbd>
              </Button>
            </div>
          </div>
        </div>

        <div className="grid min-w-0 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          {/* Input */}
          <section className="min-w-0 border-b border-line xl:border-b-0 xl:border-r">
            <div className="flex items-center justify-between border-b border-line px-6 py-2.5">
              <p className="text-[12.5px] font-medium text-fg">Input</p>
              <div className="inline-flex rounded-md bg-surface-2 p-0.5">
                {(["form", "json"] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setMode(m)} className={cn("h-6 rounded px-2.5 text-[12px] font-medium", mode === m ? "bg-canvas text-fg shadow-[0_1px_1px_rgb(10_22_40/0.08)]" : "text-muted")}>
                    {m === "form" ? "Form" : "JSON"}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-6 py-5">
              {mode === "form" ? (
                <SchemaForm schema={tool.inputSchema} value={args} onChange={updateArgs} />
              ) : (
                <div>
                  <textarea
                    value={jsonText}
                    onChange={(e) => onJson(e.target.value)}
                    spellCheck={false}
                    className="min-h-[340px] w-full rounded-md border border-line-strong bg-surface px-4 py-3 font-mono text-[12.5px] leading-[1.65] text-fg focus:border-focus focus:outline-none"
                    aria-label="Arguments JSON"
                  />
                  {jsonError && <p className="mt-2 text-[12.5px] text-danger">{jsonError}</p>}
                </div>
              )}
            </div>
          </section>

          {/* Result */}
          <section className="min-w-0">
            <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-2.5">
              <div className="flex gap-1">
                {(["response", "request", "policy", "schema"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setTab(t)} className={cn("h-6 rounded px-2.5 text-[12px] font-medium capitalize", tab === t ? "bg-surface-3 text-fg" : "text-muted hover:text-fg")}>
                    {t}
                  </button>
                ))}
              </div>
              {envelope && (
                <div className="flex items-center gap-3 text-[12px] text-muted">
                  <span className="tnum">{run?.latencyMs} ms</span>
                  <Link href={`/audit/${envelope.audit_id}`} className="font-mono text-link hover:underline">
                    audit {envelope.audit_id.slice(0, 8)}
                  </Link>
                </div>
              )}
            </div>
            <div className="px-6 py-5">
              {error && <p className="rounded-md border border-danger/25 bg-danger-soft px-4 py-3 text-[13px] text-danger">{error}</p>}
              {tab === "schema" ? (
                <div className="space-y-4">
                  <p className="text-[12px] font-medium text-muted">Input schema</p>
                  <Json value={tool.inputSchema} />
                  <p className="text-[12px] font-medium text-muted">Output schema (envelope.data)</p>
                  <Json value={tool.outputSchema} />
                </div>
              ) : !run ? (
                <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
                  <p className="text-[14px] font-medium text-fg">Run {tool.name} to see the structured response.</p>
                  <p className="mt-1 max-w-sm text-[13px] text-muted">Runs through the same gateway agents use — policy, approvals, idempotency and audit included.</p>
                </div>
              ) : tab === "response" ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge value={envelope!.status as ResponseStatus} />
                    <EnvironmentBadge value={envelope!.environment} />
                    {envelope!.meta.state_changed ? <span className="text-[12px] text-prepare">Records changed</span> : <span className="text-[12px] text-subtle">No records changed</span>}
                    {envelope!.replayed && <span className="text-[12px] text-info">Replayed original result</span>}
                  </div>
                  <p className="text-[13.5px] leading-relaxed text-fg">{envelope!.summary ?? envelope!.message}</p>
                  {approval && (
                    <div className="rounded-md border border-prepare/25 bg-prepare-soft px-4 py-3.5">
                      <p className="text-[13px] font-semibold text-prepare">Approval {approval.status}</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-fg">{approval.summary}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link href={`/approvals/${approval.approval_id}`} className="inline-flex h-8 items-center rounded-md bg-brand px-3 text-[12.5px] font-medium text-white hover:bg-brand-hover">
                          Review approval
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            const next = { ...args, approval_id: approval.approval_id };
                            updateArgs(next);
                            execute(next);
                          }}
                          className="inline-flex h-8 items-center rounded-md border border-line-strong bg-canvas px-3 text-[12.5px] font-medium text-fg hover:bg-surface-2"
                        >
                          Run again with approval_id
                        </button>
                      </div>
                    </div>
                  )}
                  <Json value={envelope} />
                </div>
              ) : tab === "request" ? (
                <div className="space-y-3">
                  <p className="text-[12.5px] text-muted">JSON-RPC message an MCP client sends for this call:</p>
                  <Json value={run.request} />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-[13px]">
                    <span className="text-muted">Decision</span>
                    <span className="font-semibold capitalize text-fg">{run.policy.decision?.replace("_", " ") ?? "Not evaluated (rejected earlier)"}</span>
                  </div>
                  <ul className="divide-y divide-line rounded-md border border-line">
                    {run.policy.reasons.map((r) => (
                      <li key={r.rule} className="flex gap-3 px-4 py-2.5 text-[12.5px]">
                        <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", r.effect === "deny" ? "bg-danger" : r.effect === "require_approval" ? "bg-prepare" : "bg-success")} />
                        <span className="w-44 shrink-0 font-mono text-fg">{r.rule}</span>
                        <span className="text-body">{r.message}</span>
                      </li>
                    ))}
                    {run.policy.reasons.length === 0 && <li className="px-4 py-3 text-[12.5px] text-muted">No policy rules were evaluated.</li>}
                  </ul>
                  <div className="text-[12.5px] text-muted">
                    Caller: <span className="text-fg">{run.caller.name}</span> · highest class <span className="font-mono uppercase text-fg">{run.caller.maxExecutionClass}</span>
                    <p className="mt-1 font-mono text-[11.5px]">{run.caller.scopes.join(" · ")}</p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

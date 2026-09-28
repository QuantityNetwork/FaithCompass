import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORY_META } from "@/domain/categories";
import { EXECUTION_CLASS_META } from "@/domain/execution-classes";
import { SCOPE_DEFINITIONS } from "@/domain/scopes";
import { ExecutionClassBadge } from "@/components/mcp/badges";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CodeBlock } from "@/components/ui/code-block";
import { KeyValue } from "@/components/ui/key-value";
import { mcpToolDefinition } from "@/server/mcp/protocol";
import { resolveTool, toToolRecord } from "@/server/tools/registry";

export async function generateMetadata(props: PageProps<"/tools/[name]">) {
  const { name } = await props.params;
  return { title: name };
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="eyebrow">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((i) => (
          <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed text-body">
            <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-subtle" aria-hidden />
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function ToolPage(props: PageProps<"/tools/[name]">) {
  const { name } = await props.params;
  const tool = resolveTool(name);
  if (!tool) notFound();
  const record = toToolRecord(tool);
  const d = record.structured_description;

  return (
    <>
      <nav className="mb-4 text-[12.5px] text-muted">
        <Link href="/tools" className="hover:text-fg">
          Tools
        </Link>{" "}
        / {CATEGORY_META[record.category].label}
      </nav>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-mono text-[20px] font-semibold tracking-[-0.01em] [overflow-wrap:anywhere] sm:text-[24px]">{record.name}</h1>
            <Badge>v{record.version}</Badge>
            <ExecutionClassBadge value={record.execution_class} />
            {record.status !== "active" && <Badge tone="warning">{record.status}</Badge>}
          </div>
          <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-muted">{d.summary}</p>
        </div>
        <ButtonLink href={`/tools/explorer?tool=${record.name}`}>Run in Explorer</ButtonLink>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr] [&>*]:min-w-0">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Model-facing description" description="Exactly what agents read in tools/list." />
            <CardBody className="space-y-6">
              <Section title="When to use" items={d.whenToUse} />
              <Section title="When not to use" items={d.whenNotToUse} />
              <Section title="Required context" items={d.requiredContext} />
              <div>
                <p className="eyebrow">Effect</p>
                <p className="mt-2 text-[13.5px] leading-relaxed text-body">{d.effect}</p>
              </div>
              {d.limitations?.length ? <Section title="Limitations" items={d.limitations} /> : null}
              <div>
                <p className="eyebrow">Example</p>
                <p className="mt-2 text-[13.5px] text-fg">“{d.example.request}”</p>
                <CodeBlock className="mt-3" code={JSON.stringify(d.example.arguments, null, 2)} title="arguments" />
              </div>
            </CardBody>
          </Card>
          <CodeBlock title="Input schema (JSON Schema 2020-12)" code={JSON.stringify(record.input_schema, null, 2)} className="max-h-[560px] overflow-auto" />
          <CodeBlock title="Output schema — envelope.data" code={JSON.stringify(record.output_schema, null, 2)} className="max-h-[560px] overflow-auto" />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Authorization" />
            <CardBody className="space-y-5">
              <div className="rounded-md bg-surface-2 px-4 py-3 text-[13px] text-body">
                <span className="font-semibold uppercase text-fg">{EXECUTION_CLASS_META[record.execution_class].label}</span> — {EXECUTION_CLASS_META[record.execution_class].effect}
              </div>
              <div>
                <p className="mb-2 text-[12px] text-muted">Required scopes</p>
                {record.required_scopes.length ? (
                  <ul className="space-y-2">
                    {record.required_scopes.map((s) => (
                      <li key={s}>
                        <code className="font-mono text-[12.5px] text-fg">{s}</code>
                        <p className="text-[12.5px] text-muted">{SCOPE_DEFINITIONS[s].description}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-body">None — available to every authenticated connection.</p>
                )}
              </div>
              <KeyValue
                columns={2}
                items={[
                  { label: "Human approval", value: record.approval_required ? "Always required" : "Not required" },
                  { label: "Idempotency", value: record.idempotency === "none" ? "Not applicable" : record.idempotency === "key" ? "idempotency_key" : "Single-use approval" },
                  { label: "Rate limit", value: `${record.rate_limit_per_minute} / minute` },
                  { label: "Timeout", value: `${record.timeout_ms / 1000} s` },
                  { label: "Environments", value: record.environments.join(", ") },
                  { label: "External providers", value: record.providers.length ? record.providers.join(", ") : "None" },
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Registry record" />
            <CardBody>
              <KeyValue
                items={[
                  { label: "tool_id", value: <code className="font-mono text-[12.5px]">{record.tool_id}</code> },
                  { label: "Owner", value: record.owner },
                  { label: "Category", value: CATEGORY_META[record.category].label },
                  { label: "Created · updated", value: `${record.created_at} · ${record.updated_at}` },
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Changelog" />
            <ul className="divide-y divide-line">
              {record.changelog.map((c) => (
                <li key={c.version} className="px-5 py-3 text-[13px]">
                  <span className="font-mono text-fg">v{c.version}</span> <span className="text-subtle">· {c.date}</span>
                  <p className="text-muted">{c.notes}</p>
                </li>
              ))}
            </ul>
          </Card>
          <CodeBlock title="tools/list descriptor" code={JSON.stringify({ ...mcpToolDefinition(tool), inputSchema: "…", outputSchema: "…" }, null, 2)} className="max-h-[420px] overflow-auto" />
        </div>
      </div>
    </>
  );
}

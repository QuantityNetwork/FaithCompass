import Link from "next/link";
import { CATEGORY_META, TOOL_CATEGORIES, type ToolCategory } from "@/domain/categories";
import { EXECUTION_CLASSES, EXECUTION_CLASS_META, type ExecutionClass } from "@/domain/execution-classes";
import { ExecutionClassBadge } from "@/components/mcp/badges";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";
import { toolRecords } from "@/server/tools/registry";

export const metadata = { title: "Tool registry" };

export default async function ToolsPage(props: PageProps<"/tools">) {
  const params = await props.searchParams;
  const category = TOOL_CATEGORIES.find((c) => c === params.category) as ToolCategory | undefined;
  const cls = EXECUTION_CLASSES.find((c) => c === params.class) as ExecutionClass | undefined;
  const q = typeof params.q === "string" ? params.q.trim().toLowerCase() : "";
  const all = toolRecords();
  const tools = all.filter(
    (t) =>
      (!category || t.category === category) &&
      (!cls || t.execution_class === cls) &&
      (!q || t.name.includes(q) || t.display_name.toLowerCase().includes(q) || t.structured_description.summary.toLowerCase().includes(q)),
  );
  const href = (next: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { category, class: cls, q: q || undefined, ...next };
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v);
    const s = sp.toString();
    return s ? `/tools?${s}` : "/tools";
  };

  return (
    <>
      <PageHeader
        title="Tool registry"
        description="Every capability an agent can reach through Sagolik MCP. Tools are semantic business operations with explicit execution classes, scopes and schemas."
        actions={<ButtonLink href="/tools/explorer">Open Tool Explorer</ButtonLink>}
      />

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
          <Link href={href({ category: undefined })} className={cn("rounded-md px-2.5 py-1 text-[12.5px]", !category ? "bg-fg text-white" : "text-muted hover:bg-surface-2 hover:text-fg")}>
            All <span className="tnum opacity-60">{all.length}</span>
          </Link>
          {TOOL_CATEGORIES.map((c) => {
            const n = all.filter((t) => t.category === c).length;
            return (
              <Link key={c} href={href({ category: c })} className={cn("rounded-md px-2.5 py-1 text-[12.5px]", category === c ? "bg-fg text-white" : "text-muted hover:bg-surface-2 hover:text-fg")}>
                {CATEGORY_META[c].label} <span className="tnum opacity-60">{n}</span>
              </Link>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1">
            {EXECUTION_CLASSES.map((c) => (
              <Link key={c} href={href({ class: cls === c ? undefined : c })} className={cn("rounded-md border px-1 py-0.5", cls === c ? "border-fg" : "border-transparent opacity-80 hover:opacity-100")} title={EXECUTION_CLASS_META[c].summary}>
                <ExecutionClassBadge value={c} />
              </Link>
            ))}
          </div>
          <form action="/tools" className="flex flex-1 sm:flex-none">
            {category && <input type="hidden" name="category" value={category} />}
            {cls && <input type="hidden" name="class" value={cls} />}
            <input name="q" defaultValue={q} placeholder="Search tools" className="h-8 w-full rounded-md border border-line-strong px-3 text-[13px] focus:border-focus focus:outline-none sm:w-52" />
          </form>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-line bg-surface text-[12px] text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium sm:px-5">Tool</th>
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">Category</th>
              <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Class</th>
              <th className="hidden px-4 py-2.5 font-medium xl:table-cell">Required scopes</th>
              <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Version</th>
              <th className="hidden px-5 py-2.5 text-right font-medium sm:table-cell">Approval</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {tools.map((t) => (
              <tr key={t.tool_id} className="group hover:bg-surface">
                <td className="px-4 py-3.5 sm:px-5">
                  <Link href={`/tools/${t.name}`} className="block">
                    <span className="font-mono text-[13px] text-fg [overflow-wrap:anywhere] group-hover:underline">{t.name}</span>
                    <span className="mt-0.5 line-clamp-2 block max-w-xl text-[12.5px] text-muted sm:truncate">{t.structured_description.summary}</span>
                    <span className="mt-2 flex items-center gap-2 sm:hidden">
                      <ExecutionClassBadge value={t.execution_class} />
                      {t.approval_required && <span className="text-[12px] font-medium text-execute">Approval required</span>}
                    </span>
                  </Link>
                </td>
                <td className="hidden px-4 py-3.5 text-body md:table-cell">{CATEGORY_META[t.category].label}</td>
                <td className="hidden px-4 py-3.5 sm:table-cell">
                  <ExecutionClassBadge value={t.execution_class} />
                </td>
                <td className="hidden px-4 py-3.5 xl:table-cell">
                  <span className="font-mono text-[11.5px] text-muted">{t.required_scopes.join(" · ") || "—"}</span>
                </td>
                <td className="hidden px-4 py-3.5 lg:table-cell">
                  <span className="font-mono text-[12px] text-body">v{t.version}</span>
                  {t.status !== "active" && <Badge tone="warning" className="ml-2">{t.status}</Badge>}
                </td>
                <td className="hidden px-5 py-3.5 text-right text-[12.5px] sm:table-cell">{t.approval_required ? <span className="font-medium text-execute">Required</span> : <span className="text-subtle">—</span>}</td>
              </tr>
            ))}
            {tools.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-[13px] text-muted">
                  No tools match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

import { CATEGORY_META } from "@/domain/categories";
import { ToolExplorer, type ExplorerTool } from "@/components/explorer/explorer";
import type { JsonSchema } from "@/components/explorer/schema-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireConsoleSession } from "@/server/auth/console";
import { explorerExamples } from "@/server/console/explorer";
import { toolRecords } from "@/server/tools/registry";
import { getRuntime } from "@/server/runtime";

export const metadata = { title: "Tool Explorer" };

export default async function ExplorerPage(props: PageProps<"/tools/explorer">) {
  const session = await requireConsoleSession();
  const params = await props.searchParams;
  const records = toolRecords();
  const tools: ExplorerTool[] = records.map((r) => ({
    name: r.name,
    title: r.display_name,
    version: r.version,
    categoryLabel: CATEGORY_META[r.category].label,
    executionClass: r.execution_class,
    requiredScopes: r.required_scopes,
    approvalRequired: r.approval_required,
    idempotency: r.idempotency,
    summary: r.structured_description.summary,
    inputSchema: r.input_schema as JsonSchema,
    outputSchema: r.output_schema as JsonSchema,
  }));
  const requested = typeof params.tool === "string" ? params.tool : null;
  const initialTool = tools.find((t) => t.name === requested)?.name ?? "get_closing_status";
  const [examples, connections] = await Promise.all([
    explorerExamples(session, session.environment),
    getRuntime().store.listConnections(session.organization.id, { status: "active" }),
  ]);

  return (
    <>
      <PageHeader
        title="Tool Explorer"
        description="Run any tool exactly as an agent would. Calls pass through authentication, policy, approvals and audit — sandbox by default."
      />
      <ToolExplorer
        tools={tools}
        initialTool={initialTool}
        environment={session.environment}
        examples={examples}
        connections={connections.map((c) => ({ id: c.id, name: c.name, environment: c.environment }))}
        demo={session.mode === "demo"}
        consoleLabel={`Console · you (${session.role})`}
      />
    </>
  );
}

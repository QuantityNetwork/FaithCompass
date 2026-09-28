import Link from "next/link";
import { notFound } from "next/navigation";
import { effectText } from "@/components/console/audit-line";
import { ApprovalStatusBadge, ClientMonogram, EnvironmentBadge, ExecutionClassBadge, StatusBadge } from "@/components/mcp/badges";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { KeyValue } from "@/components/ui/key-value";
import { formatDateTime, formatMs } from "@/lib/format";
import { requireConsoleSession } from "@/server/auth/console";
import { getRuntime } from "@/server/runtime";

export const metadata = { title: "Audit record" };

function Mono({ children }: { children: React.ReactNode }) {
  return <code className="break-all font-mono text-[12px] text-fg">{children}</code>;
}

export default async function AuditRecordPage(props: PageProps<"/audit/[id]">) {
  const { id } = await props.params;
  const session = await requireConsoleSession();
  const { store } = getRuntime();
  const r = await store.getAudit(session.organization.id, id);
  if (!r) notFound();
  const [user, connection] = await Promise.all([r.user_id ? store.getUser(r.user_id) : null, r.connection_id ? store.getConnection(r.connection_id) : null]);

  return (
    <>
      <nav className="mb-4 text-[12.5px] text-muted">
        <Link href="/audit" className="hover:text-fg">
          Audit
        </Link>{" "}
        / #{r.sequence}
      </nav>
      <div className="mb-8 flex items-start gap-4">
        <ClientMonogram type={r.client_type} size="lg" />
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.015em]">
            {r.client_name} <span className="font-normal text-muted">used</span> <span className="font-mono">{r.tool_name}</span>
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <EnvironmentBadge value={r.environment} />
            <ExecutionClassBadge value={r.execution_class} />
            <StatusBadge value={r.status} />
            <span className="text-[13px] text-muted">{effectText(r)}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Who and what" />
          <CardBody>
            <KeyValue
              items={[
                { label: "Timestamp", value: `${formatDateTime(r.created_at)} (${r.created_at})` },
                { label: "User", value: user ? `${user.full_name ?? user.email}` : r.user_id ?? "—" },
                { label: "Organization", value: session.organization.name },
                { label: "Agent / client", value: `${r.client_name} · ${r.source === "console" ? "via Sagolik Console" : "via MCP"}` },
                { label: "Connection", value: connection ? <Link href={`/connections/${connection.id}`} className="text-link hover:underline">{connection.name}</Link> : "—" },
                { label: "Tool", value: <Mono>{r.tool_name}{r.tool_version ? `@${r.tool_version}` : ""}</Mono> },
                { label: "Arguments hash (SHA-256)", value: <Mono>{r.arguments_hash ?? "—"}</Mono> },
                { label: "Scopes exercised", value: r.scopes_used.length ? <Mono>{r.scopes_used.join(" · ")}</Mono> : "None" },
              ]}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Decision and outcome" />
          <CardBody className="space-y-5">
            <KeyValue
              columns={2}
              items={[
                { label: "Policy decision", value: r.policy_decision ? r.policy_decision.replace("_", " ") : "Not evaluated" },
                { label: "Result", value: <StatusBadge value={r.status} /> },
                { label: "Error code", value: r.error_code ?? "—" },
                { label: "Duration", value: formatMs(r.duration_ms) },
                { label: "State changed", value: r.state_changed ? "Yes" : "No" },
                { label: "Providers touched", value: r.providers_touched.length ? r.providers_touched.join(", ") : "None" },
                { label: "Approval", value: r.approval_id ? <Link href={`/approvals/${r.approval_id}`} className="text-link hover:underline">{r.approval_id.slice(0, 8)}…</Link> : "—" },
                { label: "Approval state", value: r.approval_status ? <ApprovalStatusBadge value={r.approval_status} /> : "—" },
              ]}
            />
            {r.policy_reasons.length > 0 && (
              <div>
                <p className="mb-1.5 text-[12px] text-muted">Policy reasoning</p>
                <ul className="divide-y divide-line rounded-md border border-line">
                  {r.policy_reasons.map((reason) => (
                    <li key={reason} className="px-3 py-2 font-mono text-[11.5px] text-body">
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardBody>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title="Integrity" description="Each record hashes its content together with the previous record's hash." />
          <CardBody>
            <KeyValue
              columns={2}
              items={[
                { label: "Sequence", value: `#${r.sequence}` },
                { label: "Request id", value: <Mono>{r.request_id}</Mono> },
                { label: "Previous hash", value: <Mono>{r.prev_hash}</Mono> },
                { label: "Record hash", value: <Mono>{r.record_hash}</Mono> },
                { label: "Session", value: <Mono>{r.session_id ?? "—"}</Mono> },
                { label: "Network", value: `${r.ip_address ?? "—"} · ${r.user_agent ?? "—"}` },
              ]}
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}

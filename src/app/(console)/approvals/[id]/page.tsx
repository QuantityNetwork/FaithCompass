import Link from "next/link";
import { notFound } from "next/navigation";
import { SCOPE_DEFINITIONS } from "@/domain/scopes";
import { DecisionForm } from "@/components/approvals/decision-form";
import { ApprovalStatusBadge, EnvironmentBadge, ExecutionClassBadge } from "@/components/mcp/badges";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CodeBlock } from "@/components/ui/code-block";
import { KeyValue } from "@/components/ui/key-value";
import { formatDateTime, relativeTime } from "@/lib/format";
import { requireConsoleSession } from "@/server/auth/console";
import { canDecideApproval, refreshExpiry } from "@/server/gateway/approvals";
import { getRuntime } from "@/server/runtime";

export const metadata = { title: "Approval request" };

export default async function ApprovalPage(props: PageProps<"/approvals/[id]">) {
  const { id } = await props.params;
  const session = await requireConsoleSession();
  const { store } = getRuntime();
  const found = await store.getApproval(session.organization.id, id);
  if (!found) notFound();
  const now = new Date();
  const approval = await refreshExpiry(store, found, now);
  const d = approval.details;
  const decider = approval.decided_by ? await store.getUser(approval.decided_by) : null;
  const connection = approval.connection_id ? await store.getConnection(approval.connection_id) : null;
  const canDecide = canDecideApproval(session.role, approval);

  return (
    <>
      <nav className="mb-4 text-[12.5px] text-muted">
        <Link href="/approvals" className="hover:text-fg">
          Approvals
        </Link>{" "}
        / Request
      </nav>
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-2">
          <ApprovalStatusBadge value={approval.status} />
          <ExecutionClassBadge value={approval.execution_class} />
          <EnvironmentBadge value={approval.environment} />
        </div>
        <h1 className="mt-4 max-w-4xl text-[22px] font-semibold leading-snug tracking-[-0.015em]">{approval.summary}</h1>
        <p className="mt-2 text-[13px] text-muted">
          Requested {formatDateTime(approval.created_at)} · {approval.status === "pending" ? `expires ${relativeTime(approval.expires_at, now)} (${formatDateTime(approval.expires_at)})` : `expired ${formatDateTime(approval.expires_at)}`}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="What you are approving" />
            <CardBody className="space-y-6">
              <KeyValue
                columns={2}
                items={[
                  { label: "Requesting agent", value: `${approval.client_name}${connection ? ` · connection “${connection.name}”` : ""}` },
                  { label: "Action", value: d.action },
                  { label: "Tool", value: <code className="font-mono text-[12.5px]">{approval.tool_name}@{approval.tool_version}</code> },
                  { label: "Amount", value: d.amount ? `$${d.amount.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${d.amount.cadence ? ` (${d.amount.cadence})` : ""}` : "No monetary amount" },
                  { label: "External provider", value: d.provider ?? "None" },
                  { label: "Environment", value: approval.environment === "sandbox" ? "Sandbox — no production effect" : "Production" },
                ]}
              />
              <div>
                <p className="text-[12px] text-muted">Affected</p>
                <ul className="mt-1.5 space-y-1">
                  {d.affected.map((a) => (
                    <li key={`${a.kind}-${a.reference}`} className="text-[13.5px] text-fg">
                      <span className="mr-2 text-[11.5px] uppercase tracking-wide text-subtle">{a.kind}</span>
                      {a.label}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[12px] text-muted">Expected result</p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-fg">{d.expected_result}</p>
              </div>
              <div>
                <p className="text-[12px] text-muted">Risks</p>
                <ul className="mt-1.5 space-y-1.5">
                  {d.risks.map((r) => (
                    <li key={r} className="flex gap-2.5 text-[13.5px] leading-relaxed text-fg">
                      <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-execute" aria-hidden />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[12px] text-muted">Permissions exercised</p>
                <ul className="mt-1.5 space-y-2">
                  {d.permissions.map((p) => (
                    <li key={p.scope} className="text-[13px]">
                      <code className="font-mono text-fg">{p.scope}</code> <span className="text-muted">— {SCOPE_DEFINITIONS[p.scope]?.description ?? p.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardBody>
          </Card>
          <CodeBlock title="Exact arguments (approval is bound to these by fingerprint)" code={JSON.stringify(approval.arguments, null, 2)} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Decision" />
            <CardBody>
              {approval.status === "pending" ? (
                canDecide ? (
                  <DecisionForm approvalId={approval.id} clientName={approval.client_name} toolName={approval.tool_name} />
                ) : (
                  <p className="text-[13px] text-muted">Your role ({session.role}) cannot approve {approval.execution_class.toUpperCase()} actions. Ask an owner or administrator.</p>
                )
              ) : (
                <KeyValue
                  items={[
                    { label: "Status", value: <ApprovalStatusBadge value={approval.status} /> },
                    { label: "Decided by", value: decider?.full_name ?? decider?.email ?? (approval.status === "expired" ? "Not decided before expiry" : "—") },
                    { label: "Decided at", value: formatDateTime(approval.decided_at) },
                    { label: "Note", value: approval.decision_note ?? "—" },
                    { label: "Executed", value: approval.consumed_at ? formatDateTime(approval.consumed_at) : "Not executed" },
                  ]}
                />
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="How approval works" />
            <CardBody>
              <ol className="list-decimal space-y-2 pl-4 text-[13px] leading-relaxed text-body">
                <li>The agent requested the action; nothing was executed.</li>
                <li>You approve or reject here. Rejection is final.</li>
                <li>After approval, the agent calls the tool again with this approval id and identical arguments.</li>
                <li>Sagolik executes once, records the result and audits it. Replays return the original result.</li>
              </ol>
            </CardBody>
          </Card>
          {approval.result && <CodeBlock title="Execution result" code={JSON.stringify(approval.result, null, 2)} className="max-h-[420px] overflow-auto" />}
        </div>
      </div>
    </>
  );
}

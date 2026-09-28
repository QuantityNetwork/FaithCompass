import { EnvironmentBadge } from "@/components/mcp/badges";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CodeBlock } from "@/components/ui/code-block";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { CreateWebhookForm, EndpointActions, RetryDeliveryButton } from "@/components/webhooks/webhook-controls";
import { formatDateTime, formatMs, relativeTime } from "@/lib/format";
import { canAdminister, requireConsoleSession } from "@/server/auth/console";
import { getRuntime } from "@/server/runtime";

export const metadata = { title: "Webhooks" };

const VERIFY_SNIPPET = `import { createHmac, timingSafeEqual } from "node:crypto";

// header: Sagolik-Signature: t=<unix>,v1=<hex>[,v1=<hex>]
export function verify(rawBody: string, header: string, secret: string) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const t = Number(parts.t);
  if (Math.abs(Date.now() / 1000 - t) > 300) return false;
  const expected = createHmac("sha256", secret).update(\`\${t}.\${rawBody}\`).digest("hex");
  return header.split(",").some((p) => {
    const [k, v] = p.split("=");
    return k === "v1" && v.length === expected.length && timingSafeEqual(Buffer.from(v), Buffer.from(expected));
  });
}`;

export default async function WebhooksPage() {
  const session = await requireConsoleSession();
  const { store } = getRuntime();
  const now = new Date();
  const scope = { organizationId: session.organization.id, environment: session.environment };
  const [endpoints, deliveries] = await Promise.all([store.listWebhookEndpoints(scope), store.listDeliveries(session.organization.id, { environment: session.environment, limit: 40 })]);
  const canManage = canAdminister(session.role);
  const endpointUrl = new Map(endpoints.map((e) => [e.id, e.url]));

  return (
    <>
      <PageHeader
        title="Webhooks"
        description="Receive signed events when transactions change, documents are needed, approvals are requested or Autopilot needs attention. Endpoints belong to one environment."
      />

      <div className="space-y-6">
        <Card>
          <CardHeader title="New endpoint" description={`Events from the ${session.environment} environment only.`} />
          <CardBody>
            <CreateWebhookForm disabledReason={canManage ? undefined : "Only owners and administrators can create webhook endpoints."} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Endpoints" />
          {endpoints.length === 0 ? (
            <EmptyState title="No webhook endpoints." description="Add an HTTPS endpoint to receive signed event notifications." className="py-10" />
          ) : (
            <ul className="divide-y divide-line">
              {endpoints.map((e) => (
                <li key={e.id} className="px-5 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="break-all font-mono text-[13px] text-fg">{e.url}</span>
                        {e.status === "enabled" ? <Badge tone="success" dot>Enabled</Badge> : <Badge dot>Disabled</Badge>}
                        <EnvironmentBadge value={e.environment} />
                      </div>
                      {e.description && <p className="mt-1 text-[13px] text-muted">{e.description}</p>}
                      <p className="mt-1.5 font-mono text-[11.5px] text-subtle">
                        {e.events.join(" · ")} · secret {e.secret_prefix}… {e.secret_rotated_at ? `· rotated ${relativeTime(e.secret_rotated_at, now)}` : ""}
                      </p>
                    </div>
                    <EndpointActions endpointId={e.id} enabled={e.status === "enabled"} canManage={canManage} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Recent deliveries" description="Failed deliveries retry after 1 min, 5 min, 30 min, 2 h and 12 h." />
          {deliveries.length === 0 ? (
            <EmptyState title="No deliveries yet." description="Deliveries appear here with their response codes and timings." className="py-10" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="border-b border-line bg-surface text-[12px] text-muted">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">Event</th>
                    <th className="px-4 py-2.5 font-medium">Endpoint</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium">Attempt</th>
                    <th className="px-4 py-2.5 font-medium">Response</th>
                    <th className="px-4 py-2.5 font-medium">When</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {deliveries.map((d) => (
                    <tr key={d.id}>
                      <td className="px-5 py-3 font-mono text-[12px] text-fg">{d.event_type}</td>
                      <td className="max-w-[260px] truncate px-4 py-3 font-mono text-[12px] text-muted">{endpointUrl.get(d.endpoint_id) ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Badge tone={d.status === "succeeded" ? "success" : d.status === "failed" ? "danger" : d.status === "retrying" ? "warning" : "neutral"} dot>
                          {d.status}
                        </Badge>
                      </td>
                      <td className="tnum px-4 py-3 text-body">{d.attempt}</td>
                      <td className="px-4 py-3 text-[12.5px] text-muted">
                        {d.response_status ? `HTTP ${d.response_status}` : d.error ?? "—"} {d.duration_ms !== null && `· ${formatMs(d.duration_ms)}`}
                        {d.next_attempt_at && <span className="block text-subtle">next attempt {formatDateTime(d.next_attempt_at)}</span>}
                      </td>
                      <td className="px-4 py-3 text-[12.5px] text-muted">{relativeTime(d.updated_at, now)}</td>
                      <td className="px-5 py-3 text-right">{d.status !== "succeeded" && canManage && <RetryDeliveryButton deliveryId={d.id} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Payload" />
            <CardBody>
              <CodeBlock
                code={JSON.stringify(
                  { id: "evt_…", type: "approval.requested", created_at: "2026-09-28T15:00:00.000Z", environment: "sandbox", livemode: false, data: { approval_id: "…", tool: "activate_property_autopilot", summary: "Claude is requesting permission to …" } },
                  null,
                  2,
                )}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Verify signatures" description="HMAC-SHA256 over `${timestamp}.${body}`, 5-minute tolerance." />
            <CardBody>
              <CodeBlock code={VERIFY_SNIPPET} title="verify.ts" />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

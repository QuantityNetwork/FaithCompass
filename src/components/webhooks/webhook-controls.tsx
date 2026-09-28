"use client";

import { useState, useTransition } from "react";
import { WEBHOOK_EVENT_TYPES, type WebhookEventType } from "@/domain/entities";
import {
  createWebhookAction,
  retryDeliveryAction,
  rotateWebhookSecretAction,
  sendTestWebhookAction,
  setWebhookStatusAction,
} from "@/app/(console)/webhooks/actions";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/ui/code-block";
import { Input, Label } from "@/components/ui/field";
import { cn } from "@/lib/cn";

const EVENT_GROUPS: { label: string; events: WebhookEventType[] }[] = [
  { label: "Closing", events: ["transaction.updated", "closing.blocker_detected"] },
  { label: "Documents", events: ["document.required", "document.received"] },
  { label: "Approvals", events: ["approval.requested", "approval.completed"] },
  { label: "Autopilot", events: ["autopilot.action_required", "autopilot.payment_due", "autopilot.failure"] },
  { label: "Ownership", events: ["ownership.created"] },
];

function SecretOnce({ secret, onDone }: { secret: string; onDone: () => void }) {
  return (
    <div className="space-y-3">
      <p className="rounded-md border border-warning/25 bg-warning-soft px-4 py-3 text-[13px] text-warning">Copy the signing secret now. It is encrypted at rest and cannot be shown again.</p>
      <CodeBlock title="Signing secret" code={secret} />
      <Button variant="secondary" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}

export function CreateWebhookForm({ disabledReason }: { disabledReason?: string }) {
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [events, setEvents] = useState<WebhookEventType[]>(["approval.requested", "approval.completed"]);
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (secret) return <SecretOnce secret={secret} onDone={() => setSecret(null)} />;

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          const res = await createWebhookAction({ url, description, events });
          if (res.ok) {
            setSecret(res.secret);
            setUrl("");
            setDescription("");
          } else setError(res.error);
        });
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="wh-url" hint="HTTPS only">
            Endpoint URL
          </Label>
          <Input id="wh-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/webhooks/sagolik" required disabled={!!disabledReason} />
        </div>
        <div>
          <Label htmlFor="wh-desc" hint="Optional">
            Description
          </Label>
          <Input id="wh-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} disabled={!!disabledReason} />
        </div>
      </div>
      <div>
        <p className="mb-2 text-[12.5px] font-medium text-fg">Events</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {EVENT_GROUPS.map((g) => (
            <fieldset key={g.label}>
              <legend className="eyebrow mb-1.5 text-[10px]">{g.label}</legend>
              {g.events.map((ev) => (
                <label key={ev} className="flex items-center gap-2 py-1 font-mono text-[12px] text-body">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-brand"
                    checked={events.includes(ev)}
                    disabled={!!disabledReason}
                    onChange={() => setEvents((cur) => (cur.includes(ev) ? cur.filter((x) => x !== ev) : [...cur, ev]))}
                  />
                  {ev}
                </label>
              ))}
            </fieldset>
          ))}
        </div>
      </div>
      {error && <p className="text-[13px] text-danger">{error}</p>}
      {disabledReason && <p className="text-[13px] text-muted">{disabledReason}</p>}
      <Button type="submit" disabled={pending || !!disabledReason || events.length === 0 || !url}>
        {pending ? "Creating…" : "Create endpoint"}
      </Button>
      <p className="sr-only">{WEBHOOK_EVENT_TYPES.length} event types available.</p>
    </form>
  );
}

export function EndpointActions({ endpointId, enabled, canManage }: { endpointId: string; enabled: boolean; canManage: boolean }) {
  const [pending, start] = useTransition();
  const [secret, setSecret] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  if (secret) return <SecretOnce secret={secret} onDone={() => setSecret(null)} />;
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    start(async () => {
      const res = await fn();
      setMessage(res.ok ? success : (res.error ?? "Failed."));
    });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="secondary" disabled={!canManage || pending || !enabled} onClick={() => run(() => sendTestWebhookAction(endpointId), "Test event sent.")}>
        Send test event
      </Button>
      <Button
        size="sm"
        variant="secondary"
        disabled={!canManage || pending}
        onClick={() => {
          if (!confirm("Rotate the signing secret? The previous secret keeps signing for 24 hours.")) return;
          start(async () => {
            const res = await rotateWebhookSecretAction(endpointId);
            if (res.ok) setSecret(res.secret);
            else setMessage(res.error);
          });
        }}
      >
        Rotate secret
      </Button>
      <Button size="sm" variant={enabled ? "danger" : "secondary"} disabled={!canManage || pending} onClick={() => run(() => setWebhookStatusAction(endpointId, !enabled), enabled ? "Endpoint disabled." : "Endpoint enabled.")}>
        {enabled ? "Disable" : "Enable"}
      </Button>
      {message && <span className={cn("text-[12.5px]", message.endsWith(".") ? "text-muted" : "text-danger")}>{message}</span>}
    </div>
  );
}

export function RetryDeliveryButton({ deliveryId, disabled }: { deliveryId: string; disabled?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={disabled || pending}
      onClick={() => start(async () => void (await retryDeliveryAction(deliveryId)))}
      className="text-[12.5px] font-medium text-link hover:underline disabled:text-subtle disabled:no-underline"
    >
      {pending ? "Retrying…" : "Retry"}
    </button>
  );
}

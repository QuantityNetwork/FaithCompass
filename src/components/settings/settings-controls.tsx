"use client";

import { useState, useTransition } from "react";
import type { OrganizationSettingsRow } from "@/domain/entities";
import {
  createPlaidLinkTokenAction,
  exchangePlaidTokenAction,
  resetSandboxAction,
  revokeAllConnectionsAction,
  updateSettingsAction,
} from "@/app/(console)/settings/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { cn } from "@/lib/cn";

function Feedback({ message }: { message: { ok: boolean; text: string } | null }) {
  if (!message) return null;
  return <p className={cn("text-[13px]", message.ok ? "text-success" : "text-danger")}>{message.text}</p>;
}

export function PolicySettingsForm({ settings, canEdit, isOwner, environmentNote }: { settings: OrganizationSettingsRow; canEdit: boolean; isOwner: boolean; environmentNote?: string }) {
  const [values, setValues] = useState({
    production_execute_enabled: settings.production_execute_enabled,
    approval_ttl_minutes: settings.approval_ttl_minutes,
    session_ttl_minutes: settings.session_ttl_minutes,
    rate_limit_per_minute: settings.rate_limit_per_minute,
    loop_threshold: settings.loop_threshold,
    max_transaction_amount: settings.max_transaction_amount_cents === null ? "" : String(settings.max_transaction_amount_cents / 100),
  });
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const num = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [k]: k === "max_transaction_amount" ? e.target.value.replace(/[^0-9.]/g, "") : Number(e.target.value) }));

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await updateSettingsAction({ ...values, max_transaction_amount: values.max_transaction_amount ? Number(values.max_transaction_amount) : null });
          setMessage(res.ok ? { ok: true, text: res.message ?? "Saved." } : { ok: false, text: res.error });
        });
      }}
    >
      <label className={cn("flex items-start justify-between gap-6 rounded-md border px-4 py-3.5", values.production_execute_enabled ? "border-execute/30 bg-execute-soft" : "border-line")}>
        <span>
          <span className="block text-[13.5px] font-medium text-fg">Allow EXECUTE actions in production</span>
          <span className="mt-0.5 block text-[12.5px] text-muted">Off by default. Even when on, every EXECUTE action requires a human approval. Only owners can enable this.</span>
          {environmentNote && <span className="mt-1 block text-[12px] text-subtle">{environmentNote}</span>}
        </span>
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-execute"
          checked={values.production_execute_enabled}
          disabled={!canEdit || (!isOwner && !values.production_execute_enabled)}
          onChange={(e) => setValues((v) => ({ ...v, production_execute_enabled: e.target.checked }))}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <Label htmlFor="ttl" hint="5–10080">Approval expiry (minutes)</Label>
          <Input id="ttl" type="number" value={values.approval_ttl_minutes} onChange={num("approval_ttl_minutes")} disabled={!canEdit} />
        </div>
        <div>
          <Label htmlFor="session" hint="5–1440">Access-token lifetime (minutes)</Label>
          <Input id="session" type="number" value={values.session_ttl_minutes} onChange={num("session_ttl_minutes")} disabled={!canEdit} />
        </div>
        <div>
          <Label htmlFor="rate">Calls per minute per connection</Label>
          <Input id="rate" type="number" value={values.rate_limit_per_minute} onChange={num("rate_limit_per_minute")} disabled={!canEdit} />
        </div>
        <div>
          <Label htmlFor="loop" hint="Identical calls / minute">Loop-protection threshold</Label>
          <Input id="loop" type="number" value={values.loop_threshold} onChange={num("loop_threshold")} disabled={!canEdit} />
        </div>
        <div>
          <Label htmlFor="max" hint="Optional">Maximum action amount (USD)</Label>
          <Input id="max" inputMode="decimal" placeholder="No organization limit" value={values.max_transaction_amount} onChange={num("max_transaction_amount")} disabled={!canEdit} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!canEdit || pending}>
          {pending ? "Saving…" : "Save policy"}
        </Button>
        <Feedback message={message} />
      </div>
    </form>
  );
}

export function ActionButton({ label, confirmText, action, variant = "secondary", disabled }: { label: string; confirmText: string; action: "reset_sandbox" | "revoke_all"; variant?: "secondary" | "danger"; disabled?: boolean }) {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant={variant}
        disabled={disabled || pending}
        onClick={() => {
          if (!confirm(confirmText)) return;
          start(async () => {
            const res = action === "reset_sandbox" ? await resetSandboxAction() : await revokeAllConnectionsAction();
            setMessage(res.ok ? { ok: true, text: res.message ?? "Done." } : { ok: false, text: res.error });
          });
        }}
      >
        {pending ? "Working…" : label}
      </Button>
      <Feedback message={message} />
    </div>
  );
}

declare global {
  interface Window {
    Plaid?: { create(config: { token: string; onSuccess: (publicToken: string, metadata: { institution?: { name?: string } | null }) => void; onExit?: () => void }): { open(): void } };
  }
}

function loadPlaid(): Promise<void> {
  if (window.Plaid) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Plaid Link could not be loaded."));
    document.head.appendChild(script);
  });
}

export function ConnectBankButton({ disabledReason }: { disabledReason?: string }) {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="secondary"
        size="sm"
        disabled={!!disabledReason || pending}
        title={disabledReason}
        onClick={() =>
          start(async () => {
            const res = await createPlaidLinkTokenAction();
            if (!res.ok) return setMessage({ ok: false, text: res.error });
            try {
              await loadPlaid();
            } catch (e) {
              return setMessage({ ok: false, text: (e as Error).message });
            }
            window.Plaid!.create({
              token: res.linkToken,
              onSuccess: (publicToken, metadata) =>
                start(async () => {
                  const done = await exchangePlaidTokenAction({ publicToken, institutionName: metadata.institution?.name ?? "" });
                  setMessage(done.ok ? { ok: true, text: done.message ?? "Connected." } : { ok: false, text: done.error });
                }),
            }).open();
          })
        }
      >
        Connect bank account
      </Button>
      {disabledReason && <span className="text-[12.5px] text-subtle">{disabledReason}</span>}
      <Feedback message={message} />
    </div>
  );
}

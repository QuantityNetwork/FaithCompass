"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { WEBHOOK_EVENT_TYPES } from "@/domain/entities";
import { canAdminister, requireConsoleSession } from "@/server/auth/console";
import { getRuntime } from "@/server/runtime";
import { WebhookError } from "@/server/webhooks/service";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function admin() {
  const session = await requireConsoleSession();
  if (!canAdminister(session.role)) throw new WebhookError("Only owners and administrators can manage webhooks.");
  return session;
}

async function guard<T>(fn: () => Promise<T>): Promise<Result<{ value: T }>> {
  try {
    const value = await fn();
    refresh();
    return { ok: true, value };
  } catch (e) {
    return { ok: false, error: e instanceof WebhookError ? e.message : "The operation failed." };
  }
}

const createSchema = z.object({
  url: z.string().trim().max(2048),
  description: z.string().trim().max(200).optional(),
  events: z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1),
});

/** Create an endpoint in the current environment. The signing secret is returned once. */
export async function createWebhookAction(input: z.input<typeof createSchema>): Promise<Result<{ secret: string }>> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a URL and select at least one event." };
  const res = await guard(async () => {
    const session = await admin();
    const { secret } = await getRuntime().webhooks.createEndpoint(
      { organizationId: session.organization.id, environment: session.environment },
      parsed.data,
      session.user.id,
    );
    return secret;
  });
  return res.ok ? { ok: true, secret: res.value } : res;
}

export async function rotateWebhookSecretAction(endpointId: string): Promise<Result<{ secret: string }>> {
  const res = await guard(async () => {
    const session = await admin();
    return (await getRuntime().webhooks.rotateSecret(session.organization.id, endpointId)).secret;
  });
  return res.ok ? { ok: true, secret: res.value } : res;
}

export async function setWebhookStatusAction(endpointId: string, enabled: boolean): Promise<Result> {
  const res = await guard(async () => {
    const session = await admin();
    await getRuntime().webhooks.setStatus(session.organization.id, endpointId, enabled ? "enabled" : "disabled");
  });
  return res.ok ? { ok: true } : res;
}

export async function sendTestWebhookAction(endpointId: string): Promise<Result> {
  const res = await guard(async () => {
    const session = await admin();
    await getRuntime().webhooks.sendTestEvent(session.organization.id, endpointId);
  });
  return res.ok ? { ok: true } : res;
}

export async function retryDeliveryAction(deliveryId: string): Promise<Result> {
  const res = await guard(async () => {
    const session = await admin();
    await getRuntime().webhooks.retry(session.organization.id, deliveryId);
  });
  return res.ok ? { ok: true } : res;
}

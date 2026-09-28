"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { canAdminister, requireConsoleSession } from "@/server/auth/console";
import { revokeConnection } from "@/server/auth/connections";
import { buildSandboxDataset } from "@/server/sandbox/fixtures";
import { getRuntime } from "@/server/runtime";

type Result = { ok: true; message?: string } | { ok: false; error: string };

async function requireAdmin() {
  const session = await requireConsoleSession();
  if (!canAdminister(session.role)) throw new Error("Only owners and administrators can change settings.");
  return session;
}

const settingsSchema = z.object({
  production_execute_enabled: z.boolean(),
  approval_ttl_minutes: z.number().int().min(5).max(10080),
  session_ttl_minutes: z.number().int().min(5).max(1440),
  rate_limit_per_minute: z.number().int().min(1).max(10000),
  loop_threshold: z.number().int().min(2).max(100),
  max_transaction_amount: z.number().positive().max(100_000_000).nullable(),
});

export async function updateSettingsAction(input: z.input<typeof settingsSchema>): Promise<Result> {
  try {
    const session = await requireAdmin();
    const parsed = settingsSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Check the values and try again." };
    const { max_transaction_amount, ...rest } = parsed.data;
    if (rest.production_execute_enabled && session.role !== "owner") return { ok: false, error: "Only owners can enable EXECUTE in production." };
    await getRuntime().store.updateOrganizationSettings(session.organization.id, {
      ...rest,
      max_transaction_amount_cents: max_transaction_amount === null ? null : Math.round(max_transaction_amount * 100),
    });
    refresh();
    return { ok: true, message: "Settings saved." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

/** Replace the organization's sandbox dataset with a fresh copy. Production is never touched. */
export async function resetSandboxAction(): Promise<Result> {
  try {
    const session = await requireAdmin();
    await getRuntime().store.replaceSandboxData(session.organization.id, buildSandboxDataset({ organizationId: session.organization.id, seedDate: new Date() }));
    refresh();
    return { ok: true, message: "Sandbox data reset. Dates are re-anchored to today." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function revokeAllConnectionsAction(): Promise<Result> {
  try {
    const session = await requireAdmin();
    const runtime = getRuntime();
    const active = await runtime.store.listConnections(session.organization.id, { environment: session.environment, status: "active" });
    for (const c of active) await revokeConnection(runtime.store, runtime.clock, c.id, session.user.id);
    refresh();
    return { ok: true, message: `Revoked ${active.length} connection(s) in ${session.environment}.` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function createPlaidLinkTokenAction(): Promise<{ ok: true; linkToken: string } | { ok: false; error: string }> {
  try {
    const session = await requireAdmin();
    const runtime = getRuntime();
    if (!runtime.plaid) return { ok: false, error: "Plaid is not configured for this deployment." };
    if (runtime.config.plaid?.environment === "sandbox" && session.environment !== "sandbox") return { ok: false, error: "The configured Plaid sandbox can only be used in the Sagolik sandbox." };
    return { ok: true, linkToken: await runtime.plaid.createLinkToken(session.user.id) };
  } catch {
    return { ok: false, error: "Plaid is temporarily unavailable." };
  }
}

/** Exchange a Plaid Link public token. The access token is encrypted before storage and never leaves the server. */
export async function exchangePlaidTokenAction(input: { publicToken: string; institutionName: string }): Promise<Result> {
  try {
    const session = await requireAdmin();
    const runtime = getRuntime();
    if (!runtime.plaid) return { ok: false, error: "Plaid is not configured for this deployment." };
    const { accessToken, itemId } = await runtime.plaid.exchangePublicToken(input.publicToken);
    const now = new Date().toISOString();
    const base = { organization_id: session.organization.id, environment: session.environment, created_at: now, updated_at: now };
    const integration = await runtime.store.insertIntegrationConnection({ id: crypto.randomUUID(), ...base, provider_id: "plaid", status: "active", external_reference: itemId, last_error: null, created_by: session.user.id });
    await runtime.store.putIntegrationCredential(integration.id, runtime.secrets.encrypt(accessToken));
    await runtime.store.insertFinancialConnection({
      id: crypto.randomUUID(),
      ...base,
      provider_id: "plaid",
      integration_connection_id: integration.id,
      institution_name: input.institutionName.slice(0, 120) || "Connected institution",
      status: "active",
      last_synced_at: now,
    });
    refresh();
    return { ok: true, message: "Account connected." };
  } catch {
    return { ok: false, error: "The account could not be connected." };
  }
}

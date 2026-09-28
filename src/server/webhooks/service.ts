import type { WebhookDeliveryRow, WebhookEndpointRow, WebhookEventType } from "@/domain/entities";
import { WEBHOOK_EVENT_TYPES } from "@/domain/entities";
import { randomBase62 } from "@/server/crypto/hash";
import type { SecretBox } from "@/server/crypto/encryption";
import type { Logger } from "@/server/observability/logger";
import type { Store, TenantScope } from "@/server/store/types";
import { SIGNATURE_HEADER, signPayload } from "./signing";
import { assertPublicDestination, validateWebhookUrl } from "./url-guard";

/** Delay before attempt n+1 (seconds). Six attempts over roughly 14 hours. */
export const RETRY_SCHEDULE_SECONDS = [60, 300, 1_800, 7_200, 43_200];
export const MAX_ATTEMPTS = RETRY_SCHEDULE_SECONDS.length + 1;
const PREVIOUS_SECRET_GRACE_MS = 24 * 3600_000;

export interface WebhookServiceDeps {
  store: Store;
  secrets: SecretBox;
  clock(): Date;
  newId(): string;
  logger: Logger;
  fetchImpl?: typeof fetch;
  resolveDestination?: (url: URL) => Promise<void>;
}

export class WebhookError extends Error {}

export class WebhookService {
  constructor(private readonly deps: WebhookServiceDeps) {}

  private get fetchImpl() {
    return this.deps.fetchImpl ?? fetch;
  }

  private newSecret(): string {
    return `whsec_${randomBase62(40)}`;
  }

  async createEndpoint(scope: TenantScope, input: { url: string; description?: string | null; events: string[] }, createdBy: string) {
    const check = validateWebhookUrl(input.url);
    if (!check.ok) throw new WebhookError(check.reason);
    const events = input.events.filter((e): e is WebhookEventType => (WEBHOOK_EVENT_TYPES as readonly string[]).includes(e));
    if (events.length === 0) throw new WebhookError("Select at least one event.");
    const secret = this.newSecret();
    const now = this.deps.clock().toISOString();
    const id = this.deps.newId();
    const endpoint = await this.deps.store.insertWebhookEndpoint(
      {
        id,
        organization_id: scope.organizationId,
        environment: scope.environment,
        url: check.url.toString(),
        description: input.description?.trim().slice(0, 200) || null,
        events,
        status: "enabled",
        secret_prefix: secret.slice(0, 12),
        secret_rotated_at: null,
        created_by: createdBy,
        created_at: now,
        updated_at: now,
      },
      { endpoint_id: id, encrypted_secret: this.deps.secrets.encrypt(secret), previous_encrypted_secret: null, previous_expires_at: null },
    );
    return { endpoint, secret };
  }

  /** Rotate the signing secret. The previous secret keeps signing for 24 hours. */
  async rotateSecret(organizationId: string, endpointId: string) {
    const endpoint = await this.deps.store.getWebhookEndpoint(organizationId, endpointId);
    const current = endpoint ? await this.deps.store.getWebhookSecret(endpoint.id) : null;
    if (!endpoint || !current) throw new WebhookError("Endpoint not found.");
    const secret = this.newSecret();
    const now = this.deps.clock();
    await this.deps.store.setWebhookSecret({
      endpoint_id: endpoint.id,
      encrypted_secret: this.deps.secrets.encrypt(secret),
      previous_encrypted_secret: current.encrypted_secret,
      previous_expires_at: new Date(now.getTime() + PREVIOUS_SECRET_GRACE_MS).toISOString(),
    });
    await this.deps.store.updateWebhookEndpoint(organizationId, endpoint.id, { secret_prefix: secret.slice(0, 12), secret_rotated_at: now.toISOString(), updated_at: now.toISOString() });
    return { secret };
  }

  async setStatus(organizationId: string, endpointId: string, status: WebhookEndpointRow["status"]) {
    const updated = await this.deps.store.updateWebhookEndpoint(organizationId, endpointId, { status, updated_at: this.deps.clock().toISOString() });
    if (!updated) throw new WebhookError("Endpoint not found.");
    return updated;
  }

  /** Record an event and deliver it to every enabled endpoint subscribed to it in the same environment. */
  async publish(scope: TenantScope, type: WebhookEventType, payload: Record<string, unknown>): Promise<void> {
    const endpoints = await this.deps.store.listSubscribedEndpoints(scope, type);
    if (endpoints.length === 0) return;
    const event = await this.deps.store.insertWebhookEvent({
      id: `evt_${randomBase62(24)}`,
      organization_id: scope.organizationId,
      environment: scope.environment,
      type,
      payload,
      created_at: this.deps.clock().toISOString(),
    });
    for (const endpoint of endpoints) {
      const delivery = await this.deps.store.insertDelivery(this.newDelivery(endpoint, event.id, type));
      await this.attempt(delivery.id, scope.organizationId);
    }
  }

  async sendTestEvent(organizationId: string, endpointId: string) {
    const endpoint = await this.deps.store.getWebhookEndpoint(organizationId, endpointId);
    if (!endpoint) throw new WebhookError("Endpoint not found.");
    const type = endpoint.events[0] ?? "transaction.updated";
    const event = await this.deps.store.insertWebhookEvent({
      id: `evt_${randomBase62(24)}`,
      organization_id: organizationId,
      environment: endpoint.environment,
      type,
      payload: { test: true, message: "Test event sent from the Sagolik MCP console." },
      created_at: this.deps.clock().toISOString(),
    });
    const delivery = await this.deps.store.insertDelivery(this.newDelivery(endpoint, event.id, type));
    return this.attempt(delivery.id, organizationId);
  }

  async retry(organizationId: string, deliveryId: string) {
    const delivery = await this.deps.store.getDelivery(organizationId, deliveryId);
    if (!delivery) throw new WebhookError("Delivery not found.");
    if (delivery.status === "succeeded") throw new WebhookError("This delivery already succeeded.");
    await this.deps.store.updateDelivery(delivery.id, { status: "pending", next_attempt_at: null, updated_at: this.deps.clock().toISOString() });
    return this.attempt(delivery.id, organizationId, { manual: true });
  }

  /** Process deliveries whose retry time has arrived (called by the maintenance cron). */
  async processDue(limit = 50): Promise<number> {
    const due = await this.deps.store.listDueDeliveries(this.deps.clock().toISOString(), limit);
    for (const d of due) await this.attempt(d.id, d.organization_id);
    return due.length;
  }

  private newDelivery(endpoint: WebhookEndpointRow, eventId: string, type: WebhookEventType): WebhookDeliveryRow {
    const now = this.deps.clock().toISOString();
    return {
      id: this.deps.newId(),
      organization_id: endpoint.organization_id,
      environment: endpoint.environment,
      endpoint_id: endpoint.id,
      event_id: eventId,
      event_type: type,
      attempt: 0,
      status: "pending",
      response_status: null,
      duration_ms: null,
      error: null,
      next_attempt_at: null,
      created_at: now,
      updated_at: now,
    };
  }

  private async attempt(deliveryId: string, organizationId: string, options: { manual?: boolean } = {}): Promise<WebhookDeliveryRow | null> {
    const delivery = await this.deps.store.getDelivery(organizationId, deliveryId);
    if (!delivery) return null;
    const endpoint = await this.deps.store.getWebhookEndpoint(organizationId, delivery.endpoint_id);
    const event = await this.deps.store.getWebhookEvent(delivery.event_id);
    const secrets = endpoint ? await this.deps.store.getWebhookSecret(endpoint.id) : null;
    if (!endpoint || !event || !secrets) return this.deps.store.updateDelivery(delivery.id, { status: "failed", error: "Endpoint no longer exists.", updated_at: this.deps.clock().toISOString() });
    if (endpoint.status !== "enabled" && !options.manual) {
      return this.deps.store.updateDelivery(delivery.id, { status: "failed", error: "Endpoint is disabled.", updated_at: this.deps.clock().toISOString() });
    }

    const now = this.deps.clock();
    const signing = [this.deps.secrets.decrypt(secrets.encrypted_secret)];
    if (secrets.previous_encrypted_secret && secrets.previous_expires_at && secrets.previous_expires_at > now.toISOString()) {
      signing.push(this.deps.secrets.decrypt(secrets.previous_encrypted_secret));
    }
    const body = JSON.stringify({
      id: event.id,
      type: event.type,
      created_at: event.created_at,
      environment: event.environment,
      livemode: event.environment === "production",
      data: event.payload,
    });
    const timestamp = Math.floor(now.getTime() / 1000);
    const attempt = delivery.attempt + 1;
    const started = performance.now();
    let status: number | null = null;
    let error: string | null = null;
    try {
      const url = new URL(endpoint.url);
      await (this.deps.resolveDestination ?? assertPublicDestination)(url);
      const res = await this.fetchImpl(url, {
        method: "POST",
        redirect: "manual",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Sagolik-Webhooks/1.0",
          "Sagolik-Event-Id": event.id,
          "Sagolik-Event-Type": event.type,
          [SIGNATURE_HEADER]: signPayload(signing, timestamp, body),
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      status = res.status;
      if (res.status < 200 || res.status >= 300) error = `Endpoint responded with HTTP ${res.status}.`;
    } catch (e) {
      error = e instanceof Error && e.name === "TimeoutError" ? "Timed out after 10 seconds." : e instanceof Error ? e.message.slice(0, 200) : "Delivery failed.";
    }
    const duration = Math.round(performance.now() - started);
    const delay = RETRY_SCHEDULE_SECONDS[attempt - 1];
    const finalStatus: WebhookDeliveryRow["status"] = !error ? "succeeded" : attempt >= MAX_ATTEMPTS || delay === undefined ? "failed" : "retrying";
    if (error) this.deps.logger.warn("webhook delivery failed", { deliveryId, attempt, error });
    return this.deps.store.updateDelivery(delivery.id, {
      attempt,
      status: finalStatus,
      response_status: status,
      duration_ms: duration,
      error,
      next_attempt_at: finalStatus === "retrying" && delay !== undefined ? new Date(now.getTime() + delay * 1000).toISOString() : null,
      updated_at: this.deps.clock().toISOString(),
    });
  }
}

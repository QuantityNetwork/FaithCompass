import { describe, expect, it } from "vitest";
import { SecretBox } from "@/server/crypto/encryption";
import { logger } from "@/server/observability/logger";
import { SIGNATURE_HEADER, signPayload, verifySignature } from "@/server/webhooks/signing";
import { WebhookService } from "@/server/webhooks/service";
import { isPrivateAddress, validateWebhookUrl } from "@/server/webhooks/url-guard";
import { createHarness, ORG_A } from "./support/harness";

describe("webhook signing", () => {
  it("verifies signatures within the tolerance window only", () => {
    const body = JSON.stringify({ id: "evt_1" });
    const header = signPayload(["whsec_secret"], 1_800_000_000, body);
    expect(verifySignature(header, body, "whsec_secret", 1_800_000_100)).toBe(true);
    expect(verifySignature(header, body, "whsec_other", 1_800_000_100)).toBe(false);
    expect(verifySignature(header, body + " ", "whsec_secret", 1_800_000_100)).toBe(false);
    expect(verifySignature(header, body, "whsec_secret", 1_800_001_000)).toBe(false);
  });

  it("signs with both secrets during rotation", () => {
    const header = signPayload(["new", "old"], 1, "{}");
    expect(verifySignature(header, "{}", "old", 1)).toBe(true);
    expect(verifySignature(header, "{}", "new", 1)).toBe(true);
  });
});

describe("webhook destination guard", () => {
  it("rejects non-HTTPS, private and credentialed URLs", () => {
    expect(validateWebhookUrl("http://hooks.example.com").ok).toBe(false);
    expect(validateWebhookUrl("https://localhost/hook").ok).toBe(false);
    expect(validateWebhookUrl("https://10.0.0.8/hook").ok).toBe(false);
    expect(validateWebhookUrl("https://169.254.169.254/latest").ok).toBe(false);
    expect(validateWebhookUrl("https://user:pw@hooks.example.com").ok).toBe(false);
    expect(validateWebhookUrl("https://hooks.example.com/sagolik").ok).toBe(true);
    expect(isPrivateAddress("::ffff:192.168.1.10")).toBe(true);
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
  });
});

describe("webhook delivery", () => {
  function service(h: ReturnType<typeof createHarness>, responder: (req: Request) => Response) {
    const requests: Request[] = [];
    const svc = new WebhookService({
      store: h.store,
      secrets: SecretBox.ephemeral(),
      clock: h.clock.now,
      newId: h.clock.newId,
      logger,
      resolveDestination: async () => {},
      fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const req = new Request(input, init);
        requests.push(req.clone());
        return responder(req);
      }) as typeof fetch,
    });
    return { svc, requests };
  }

  it("delivers signed events to subscribed endpoints in the same environment", async () => {
    const h = createHarness();
    const { svc, requests } = service(h, () => new Response("ok"));
    const { endpoint, secret } = await svc.createEndpoint({ organizationId: ORG_A, environment: "sandbox" }, { url: "https://hooks.example.com/sagolik", events: ["approval.requested"] }, "u");
    expect(endpoint.secret_prefix).toBe(secret.slice(0, 12));
    await svc.publish({ organizationId: ORG_A, environment: "production" }, "approval.requested", { approval_id: "x" });
    expect(requests).toHaveLength(0);
    await svc.publish({ organizationId: ORG_A, environment: "sandbox" }, "approval.requested", { approval_id: "x" });
    expect(requests).toHaveLength(1);
    const req = requests[0]!;
    const body = await req.text();
    expect(verifySignature(req.headers.get(SIGNATURE_HEADER)!, body, secret, Math.floor(h.clock.now().getTime() / 1000))).toBe(true);
    expect(JSON.parse(body).livemode).toBe(false);
    const deliveries = await h.store.listDeliveries(ORG_A, {});
    expect(deliveries[0]?.status).toBe("succeeded");
  });

  it("schedules retries with backoff and supports manual retry", async () => {
    const h = createHarness();
    let fail = true;
    const { svc } = service(h, () => new Response("nope", { status: fail ? 500 : 200 }));
    const { endpoint } = await svc.createEndpoint({ organizationId: ORG_A, environment: "sandbox" }, { url: "https://hooks.example.com/x", events: ["autopilot.failure"] }, "u");
    await svc.publish({ organizationId: ORG_A, environment: "sandbox" }, "autopilot.failure", {});
    const [delivery] = await h.store.listDeliveries(ORG_A, { endpointId: endpoint.id });
    expect(delivery?.status).toBe("retrying");
    expect(delivery?.response_status).toBe(500);
    expect(delivery?.next_attempt_at).toBe(new Date(h.clock.now().getTime() + 60_000).toISOString());
    fail = false;
    const retried = await svc.retry(ORG_A, delivery!.id);
    expect(retried?.status).toBe("succeeded");
    expect(retried?.attempt).toBe(2);
  });

  it("encrypts secrets at rest", async () => {
    const h = createHarness();
    const { svc } = service(h, () => new Response("ok"));
    const { endpoint, secret } = await svc.createEndpoint({ organizationId: ORG_A, environment: "sandbox" }, { url: "https://hooks.example.com/x", events: ["ownership.created"] }, "u");
    const stored = await h.store.getWebhookSecret(endpoint.id);
    expect(stored?.encrypted_secret).not.toContain(secret);
    expect(stored?.encrypted_secret.startsWith("v1.")).toBe(true);
    const rotated = await svc.rotateSecret(ORG_A, endpoint.id);
    expect(rotated.secret).not.toBe(secret);
    expect((await h.store.getWebhookSecret(endpoint.id))?.previous_encrypted_secret).toBe(stored?.encrypted_secret);
  });
});

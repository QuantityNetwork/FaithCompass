import { describe, expect, it } from "vitest";
import { createFinancialProviders, paymentProviderFor } from "@/server/integrations/registry";
import { logger } from "@/server/observability/logger";
import { DEMO_ORGANIZATION_ID, seedDemoWorkspace } from "@/server/sandbox/demo";
import { MemoryStore } from "@/server/store/memory";

describe("demo workspace", () => {
  it("is produced by a real scripted session through the gateway", async () => {
    const store = new MemoryStore();
    await seedDemoWorkspace(store, {
      store,
      clock: () => new Date("2026-09-28T15:00:00Z"),
      newId: () => crypto.randomUUID(),
      financialProviders: createFinancialProviders(store),
      paymentsFor: paymentProviderFor,
      events: { publish: async () => {} },
      defer: (task) => void task(),
      publicUrl: "http://localhost:3000",
      logger,
    });
    const audit = await store.listAudit(DEMO_ORGANIZATION_ID, { limit: 100 });
    expect(audit.length).toBe(15);
    expect(audit.every((a) => a.environment === "sandbox")).toBe(true);
    expect(audit.some((a) => a.status === "denied" && a.client_name === "Cursor")).toBe(true);
    expect(audit.some((a) => a.status === "needs_clarification")).toBe(true);
    const pending = await store.listApprovals(DEMO_ORGANIZATION_ID, { status: ["pending"] });
    expect(pending).toHaveLength(1);
    expect(pending[0]!.summary).toMatch(/^Claude is requesting permission to activate Sagolik Autopilot for Property #SGK-1042/);
    const production = await store.listProperties({ organizationId: DEMO_ORGANIZATION_ID, environment: "production" });
    expect(production).toHaveLength(0);
  });
});

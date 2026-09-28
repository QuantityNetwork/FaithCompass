import type { ClientType } from "@/domain/clients";
import type { MemberRole, WebhookEventType } from "@/domain/entities";
import type { Environment } from "@/domain/environments";
import type { Scope } from "@/domain/scopes";
import { SCOPES } from "@/domain/scopes";
import { createConnection, issueConnectionToken } from "@/server/auth/connections";
import type { Caller } from "@/server/gateway/caller";
import { callTool, type GatewayDeps } from "@/server/gateway/gateway";
import { createFinancialProviders, paymentProviderFor } from "@/server/integrations/registry";
import { logger } from "@/server/observability/logger";
import { buildSandboxDataset } from "@/server/sandbox/fixtures";
import { MemoryStore, seedOrganization } from "@/server/store/memory";

export const ORG_A = "0b5c7e1a-1111-4a11-8a11-111111111111";
export const ORG_B = "0b5c7e1a-2222-4a22-8a22-222222222222";
export const USER_A = "5e1f0a2b-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const USER_B = "5e1f0a2b-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const VIEWER_A = "5e1f0a2b-cccc-4ccc-8ccc-cccccccccccc";

export function createHarness(options: { now?: Date } = {}) {
  let now = options.now ?? new Date("2026-09-28T15:00:00.000Z");
  const store = new MemoryStore();
  const published: { organizationId: string; environment: Environment; type: WebhookEventType; payload: Record<string, unknown> }[] = [];
  const deferred: Promise<void>[] = [];

  seedOrganization(store, { organizationId: ORG_A, name: "Lindqvist Household", kind: "family", userId: USER_A, email: "owner@a.invalid", fullName: "Owner A", role: "owner", now });
  seedOrganization(store, { organizationId: ORG_A, name: "Lindqvist Household", kind: "family", userId: VIEWER_A, email: "viewer@a.invalid", fullName: "Viewer A", role: "viewer", now });
  seedOrganization(store, { organizationId: ORG_B, name: "Harbor Holdings", kind: "business", userId: USER_B, email: "owner@b.invalid", fullName: "Owner B", role: "owner", now });

  const deps: GatewayDeps = {
    store,
    clock: () => now,
    newId: () => crypto.randomUUID(),
    financialProviders: createFinancialProviders(store),
    paymentsFor: paymentProviderFor,
    events: {
      publish: async (scope, type, payload) => {
        published.push({ organizationId: scope.organizationId, environment: scope.environment, type, payload });
      },
    },
    defer: (task) => {
      deferred.push(task());
    },
    publicUrl: "https://mcp.test",
    logger,
  };

  const ready = (async () => {
    await store.replaceSandboxData(ORG_A, buildSandboxDataset({ organizationId: ORG_A, seedDate: now }));
    await store.replaceSandboxData(ORG_B, buildSandboxDataset({ organizationId: ORG_B, seedDate: now }));
  })();

  const clock = { now: () => now, newId: () => crypto.randomUUID() };

  async function connect(input: { organizationId?: string; userId?: string; environment?: Environment; scopes?: Scope[]; clientType?: ClientType; name?: string; transactionLimitCents?: number | null } = {}) {
    await ready;
    const connection = await createConnection(store, clock, {
      organizationId: input.organizationId ?? ORG_A,
      environment: input.environment ?? "sandbox",
      userId: input.userId ?? USER_A,
      name: input.name ?? "Claude",
      clientType: input.clientType ?? "claude",
      authMethod: "token",
      scopes: input.scopes ?? [...SCOPES],
      transactionLimitCents: input.transactionLimitCents ?? null,
      expiresAt: null,
    });
    const { token } = await issueConnectionToken(store, clock, connection);
    return { connection, token };
  }

  function caller(input: { organizationId?: string; userId?: string; role?: MemberRole; environment?: Environment; scopes?: Scope[]; connectionId?: string | null; maxClass?: Caller["maxExecutionClass"]; transactionLimitCents?: number | null } = {}): Caller {
    return {
      source: input.connectionId ? "mcp" : "console",
      organizationId: input.organizationId ?? ORG_A,
      organization: { name: "Lindqvist Household", kind: "family" },
      environment: input.environment ?? "sandbox",
      userId: input.userId ?? USER_A,
      role: input.role ?? "owner",
      client: { name: input.connectionId ? "Claude" : "Sagolik Console", type: input.connectionId ? "claude" : "console", connectionId: input.connectionId ?? null, clientId: null },
      sessionId: null,
      scopes: input.scopes ?? [...SCOPES],
      maxExecutionClass: input.maxClass ?? "execute",
      transactionLimitCents: input.transactionLimitCents ?? null,
      sessionExpiresAt: null,
      ip: null,
      userAgent: null,
    };
  }

  async function call(c: Caller, name: string, args: Record<string, unknown> = {}) {
    await ready;
    const result = await callTool(deps, c, { name, arguments: args });
    return result.envelope;
  }

  return {
    store,
    deps,
    clock,
    published,
    ready,
    connect,
    caller,
    call,
    flush: async () => {
      await Promise.all(deferred.splice(0));
    },
    advance: (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
  };
}

export type Harness = ReturnType<typeof createHarness>;

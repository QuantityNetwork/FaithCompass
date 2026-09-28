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
import type { Store } from "@/server/store/types";

export const ORG_A = "0b5c7e1a-1111-4a11-8a11-111111111111";
export const ORG_B = "0b5c7e1a-2222-4a22-8a22-222222222222";
export const USER_A = "5e1f0a2b-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const USER_B = "5e1f0a2b-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const VIEWER_A = "5e1f0a2b-cccc-4ccc-8ccc-cccccccccccc";

export type HarnessSeed = Parameters<typeof seedOrganization>[1];

/** Alternative persistence for the whole suite (e.g. PostgREST over PGlite). Defaults to the in-memory store. */
export interface HarnessBackend {
  /** Start from an empty database, apply the seeds and return a store bound to it. */
  prepare(seeds: HarnessSeed[]): Promise<Store>;
}

let backend: HarnessBackend | null = null;
const outstanding = new Set<Promise<unknown>>();

export function setHarnessBackend(next: HarnessBackend | null): void {
  backend = next;
}

/** Work a later harness must wait for before resetting a shared database. */
function track<T>(work: Promise<T>): Promise<T> {
  outstanding.add(work);
  void work.finally(() => outstanding.delete(work)).catch(() => undefined);
  return work;
}

/** A store whose calls wait for the backend to finish resetting. */
function deferredStore(pending: Promise<Store>): Store {
  return new Proxy({} as Store, {
    get(_, prop) {
      if (prop === "then" || typeof prop === "symbol") return undefined;
      return async (...args: unknown[]) => {
        const real = await pending;
        const method = Reflect.get(real, prop) as (...a: unknown[]) => unknown;
        return method.apply(real, args);
      };
    },
  });
}

export function createHarness(options: { now?: Date } = {}) {
  let now = options.now ?? new Date("2026-09-28T15:00:00.000Z");
  const seeds: HarnessSeed[] = [
    { organizationId: ORG_A, name: "Lindqvist Household", kind: "family", userId: USER_A, email: "owner@a.invalid", fullName: "Owner A", role: "owner", now },
    { organizationId: ORG_A, name: "Lindqvist Household", kind: "family", userId: VIEWER_A, email: "viewer@a.invalid", fullName: "Viewer A", role: "viewer", now },
    { organizationId: ORG_B, name: "Harbor Holdings", kind: "business", userId: USER_B, email: "owner@b.invalid", fullName: "Owner B", role: "owner", now },
  ];
  let store: Store;
  if (backend) {
    // Let work deferred by earlier harnesses settle before the database is reset underneath it.
    const settled = Promise.allSettled([...outstanding]);
    const active = backend;
    store = deferredStore(settled.then(() => active.prepare(seeds)));
  } else {
    const memory = new MemoryStore();
    for (const seed of seeds) seedOrganization(memory, seed);
    store = memory;
  }
  const published: { organizationId: string; environment: Environment; type: WebhookEventType; payload: Record<string, unknown> }[] = [];
  const deferred: Promise<void>[] = [];

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
      deferred.push(track(task()));
    },
    publicUrl: "https://mcp.test",
    logger,
  };

  const ready = (async () => {
    await store.replaceSandboxData(ORG_A, buildSandboxDataset({ organizationId: ORG_A, seedDate: now }));
    await store.replaceSandboxData(ORG_B, buildSandboxDataset({ organizationId: ORG_B, seedDate: now }));
  })();
  track(ready);

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
      deniedTools: [],
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

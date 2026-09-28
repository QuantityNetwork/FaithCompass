import "server-only";
import { createClient } from "@supabase/supabase-js";
import { after } from "next/server";
import type { Environment } from "@/domain/environments";
import type { Clock } from "@/server/auth/connections";
import { serverConfig, type ServerConfig } from "@/server/config/env";
import { SecretBox } from "@/server/crypto/encryption";
import type { GatewayDeps } from "@/server/gateway/gateway";
import { PlaidFinancialProvider } from "@/server/integrations/financial/plaid-provider";
import { createFinancialProviders, paymentProviderFor } from "@/server/integrations/registry";
import { logger } from "@/server/observability/logger";
import { seedDemoWorkspace } from "@/server/sandbox/demo";
import { MemoryStore } from "@/server/store/memory";
import { toolCatalogRows } from "@/server/tools/registry";
import type { Database } from "@/server/store/supabase/database.types";
import { SupabaseStore } from "@/server/store/supabase/store";
import type { Store } from "@/server/store/types";
import { WebhookService } from "@/server/webhooks/service";

export interface Runtime {
  mode: ServerConfig["mode"];
  config: ServerConfig;
  store: Store;
  secrets: SecretBox;
  clock: Clock;
  webhooks: WebhookService;
  plaid: PlaidFinancialProvider | null;
  /** Gateway dependencies bound to the public origin of the current request. */
  gateway(publicUrl: string): GatewayDeps;
  /** Resolves when demo seeding (if any) has finished. */
  ready: Promise<void>;
}

/** Run work after the response when inside a request; otherwise run it now. */
function defer(task: () => Promise<void>): void {
  const guarded = () => task().catch((error) => logger.error("deferred task failed", { error }));
  try {
    after(guarded);
  } catch {
    void guarded();
  }
}

function createRuntime(): Runtime {
  const config = serverConfig();
  const secrets = config.encryptionKey ? SecretBox.fromBase64(config.encryptionKey) : SecretBox.ephemeral();
  const clock: Clock = { now: () => new Date(), newId: () => crypto.randomUUID() };

  const store: Store =
    config.mode === "live" && config.supabase
      ? new SupabaseStore(
          createClient<Database>(config.supabase.url, config.supabase.serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
            global: { headers: { "X-Client-Info": "sagolik-mcp-gateway" } },
          }),
        )
      : new MemoryStore();

  const plaid = config.plaid
    ? new PlaidFinancialProvider(config.plaid, async (integrationConnectionId) => {
        const encrypted = await store.getIntegrationCredential(integrationConnectionId);
        return encrypted ? secrets.decrypt(encrypted) : null;
      })
    : null;
  const financialProviders = createFinancialProviders(store, { plaid });
  const webhooks = new WebhookService({ store, secrets, clock: clock.now, newId: clock.newId, logger });

  const gateway = (publicUrl: string): GatewayDeps => ({
    store,
    clock: clock.now,
    newId: clock.newId,
    financialProviders,
    paymentsFor: (environment: Environment) => paymentProviderFor(environment),
    events: { publish: (scope, type, payload) => webhooks.publish(scope, type, payload) },
    defer,
    publicUrl,
    logger,
  });

  const ready = (async () => {
    await store.syncToolCatalog(toolCatalogRows());
    if (store instanceof MemoryStore) await seedDemoWorkspace(store, { ...gateway(config.publicUrl ?? "http://localhost:3000"), defer: (t) => void t() });
  })().catch((error) => {
    logger.error("runtime initialization failed", { error });
  });

  if (config.mode === "demo") logger.info("Sagolik MCP running in demo mode (in-memory, sandbox only)");
  return { mode: config.mode, config, store, secrets, clock, webhooks, plaid, gateway, ready };
}

const globalRuntime = globalThis as unknown as { __sagolikRuntime?: Runtime };

/** Process-wide runtime, reused across requests (and across hot reloads in development). */
export function getRuntime(): Runtime {
  const current = globalRuntime.__sagolikRuntime;
  // Route handlers and pages may be bundled separately, so class identity is not shared between them.
  // Rebuild only when a hot reload added store methods the live instance lacks (development only).
  const stale =
    current?.mode === "demo" &&
    Object.getOwnPropertyNames(MemoryStore.prototype).some((m) => typeof (current.store as unknown as Record<string, unknown>)[m] !== "function");
  if (!current || stale) globalRuntime.__sagolikRuntime = createRuntime();
  return globalRuntime.__sagolikRuntime!;
}

/** Resolve the public origin: configured value first, then the request's forwarded host. */
export function publicUrlFrom(request: { headers: Headers }): string {
  const configured = serverConfig().publicUrl;
  if (configured) return configured;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost:3000";
  const proto = request.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

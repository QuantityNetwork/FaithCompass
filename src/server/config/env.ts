import "server-only";

export type RuntimeMode = "demo" | "live";

export interface ServerConfig {
  mode: RuntimeMode;
  publicUrl: string | null;
  supabase: { url: string; anonKey: string; serviceRoleKey: string } | null;
  encryptionKey: string | null;
  cronSecret: string | null;
  plaid: { clientId: string; secret: string; environment: "sandbox" | "production" } | null;
  isProductionBuild: boolean;
}

const clean = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

let cached: ServerConfig | null = null;

/** Server configuration. Values are read once; secrets never leave the server. */
export function serverConfig(): ServerConfig {
  if (cached) return cached;
  const url = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const serviceRoleKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const supabase = url && anonKey && serviceRoleKey ? { url, anonKey, serviceRoleKey } : null;
  const forced = clean(process.env.SAGOLIK_MODE);
  const mode: RuntimeMode = forced === "demo" || !supabase ? "demo" : "live";
  const plaidId = clean(process.env.PLAID_CLIENT_ID);
  const plaidSecret = clean(process.env.PLAID_SECRET);
  cached = {
    mode,
    publicUrl: clean(process.env.SAGOLIK_PUBLIC_URL)?.replace(/\/$/, "") ?? null,
    supabase,
    encryptionKey: clean(process.env.SAGOLIK_ENCRYPTION_KEY),
    cronSecret: clean(process.env.CRON_SECRET),
    plaid: plaidId && plaidSecret ? { clientId: plaidId, secret: plaidSecret, environment: process.env.PLAID_ENV === "production" ? "production" : "sandbox" } : null,
    isProductionBuild: process.env.NODE_ENV === "production",
  };
  if (cached.mode === "live" && !cached.encryptionKey) {
    throw new Error("SAGOLIK_ENCRYPTION_KEY is required when Supabase is configured.");
  }
  return cached;
}

/** Test hook: reset cached configuration. */
export function resetServerConfig(): void {
  cached = null;
}

import { defineConfig } from "vitest/config";
import base from "./vitest.config";

/**
 * The harness-driven suites against the Supabase data path
 * (SupabaseStore → supabase-js → PostgREST → Postgres with all migrations and RLS).
 * Requires POSTGREST_BIN; see README → Testing.
 */
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ["tests/tools.test.ts", "tests/gateway.test.ts", "tests/mcp-http.test.ts", "tests/webhooks.test.ts"],
    setupFiles: ["tests/support/postgrest-setup.ts"],
    fileParallelism: false,
    testTimeout: 60_000,
  },
});

import { afterAll, beforeAll } from "vitest";
import { setHarnessBackend } from "./harness";
import { startPostgrest, type PostgrestStack } from "./postgrest";

// Runs the suite against SupabaseStore → PostgREST → Postgres instead of the in-memory store.
let stack: PostgrestStack | null = null;

beforeAll(async () => {
  const binary = process.env.POSTGREST_BIN;
  if (!binary) throw new Error("Set POSTGREST_BIN to a PostgREST v12+ executable to run the PostgREST suite.");
  stack = await startPostgrest(binary);
  setHarnessBackend(stack.backend);
}, 60_000);

afterAll(async () => {
  setHarnessBackend(null);
  await stack?.stop();
});

import { spawn, type ChildProcess } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { createServer, type AddressInfo } from "node:net";
import type { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/server/store/supabase/database.types";
import { SupabaseStore } from "@/server/store/supabase/store";
import type { HarnessBackend, HarnessSeed } from "./harness";
import { createDatabase } from "./pglite";

/** Tables populated by migrations; everything else is emptied between harnesses. */
const CATALOG_TABLES = new Set(["mcp_scopes", "integration_providers", "mcp_tools"]);

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

function signJwt(secret: string, payload: Record<string, unknown>): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}`;
  return `${unsigned}.${createHmac("sha256", secret).update(unsigned).digest("base64url")}`;
}

export interface PostgrestStack {
  db: PGlite;
  store: SupabaseStore;
  backend: HarnessBackend;
  stop(): Promise<void>;
}

/**
 * The production data path, locally: SupabaseStore → supabase-js → PostgREST → Postgres (PGlite)
 * with every migration, grant and RLS policy applied. The client authenticates as service_role,
 * exactly like the gateway does in live mode.
 */
export async function startPostgrest(binary: string): Promise<PostgrestStack> {
  const db = await createDatabase();
  const pgPort = await freePort();
  const socket = new PGLiteSocketServer({ db, port: pgPort, host: "127.0.0.1" });
  await socket.start();

  const [httpPort, adminPort] = [await freePort(), await freePort()];
  const secret = randomBytes(32).toString("hex");
  let output = "";
  const child: ChildProcess = spawn(binary, [], {
    env: {
      NODE_ENV: "test",
      PGRST_DB_URI: `postgres://postgres@127.0.0.1:${pgPort}/postgres?sslmode=disable`,
      PGRST_DB_SCHEMAS: "public",
      PGRST_DB_ANON_ROLE: "anon",
      PGRST_JWT_SECRET: secret,
      PGRST_SERVER_HOST: "127.0.0.1",
      PGRST_SERVER_PORT: String(httpPort),
      PGRST_ADMIN_SERVER_PORT: String(adminPort),
      // PGlite serves one session: a single pooled connection and no LISTEN channel.
      PGRST_DB_POOL: "1",
      PGRST_DB_CHANNEL_ENABLED: "false",
      PGRST_DB_CONFIG: "false",
      PGRST_LOG_LEVEL: process.env.PGRST_LOG_LEVEL ?? "error",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (d) => (output += d));
  child.stderr?.on("data", (d) => (output += d));
  if (process.env.PGRST_LOG_LEVEL) child.stderr?.pipe(process.stderr);
  if (process.env.PGRST_LOG_LEVEL) child.stdout?.pipe(process.stderr);

  const url = `http://127.0.0.1:${httpPort}`;
  for (let attempt = 0; ; attempt++) {
    const ready = await fetch(`http://127.0.0.1:${adminPort}/ready`).then((r) => r.ok, () => false);
    if (ready) break;
    if (attempt > 200 || child.exitCode !== null) throw new Error(`PostgREST did not start:\n${output}`);
    await new Promise((r) => setTimeout(r, 100));
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const serviceKey = signJwt(secret, { role: "service_role", iss: "sagolik-test", iat: issuedAt, exp: issuedAt + 86_400 });
  const client = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      // supabase-js addresses PostgREST under /rest/v1 (the Supabase API gateway prefix).
      fetch: (input, init) => {
        const target = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        return fetch(target.replace(`${url}/rest/v1`, url), init);
      },
    },
  });
  const store = new SupabaseStore(client);

  const tables = (await db.query<{ tablename: string }>(`select tablename from pg_tables where schemaname = 'public'`)).rows
    .map((r) => r.tablename)
    .filter((t) => !CATALOG_TABLES.has(t));

  async function reset(seeds: HarnessSeed[]) {
    // Superuser maintenance: replica mode skips the audit log's immutability triggers for the truncate.
    await db.exec(`
      set session_replication_role = replica;
      truncate table ${tables.map((t) => `public.${t}`).join(", ")}, auth.users cascade;
      set session_replication_role = origin;
    `);
    for (const seed of seeds) {
      const iso = seed.now.toISOString();
      await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, jsonb_build_object('full_name', $3::text)) on conflict (id) do nothing`, [seed.userId, seed.email, seed.fullName]);
      await db.query(`insert into public.organizations (id, name, kind, created_at, updated_at) values ($1, $2, $3, $4, $4) on conflict (id) do nothing`, [seed.organizationId, seed.name, seed.kind, iso]);
      await db.query(`insert into public.organization_settings (organization_id) values ($1) on conflict (organization_id) do nothing`, [seed.organizationId]);
      await db.query(`insert into public.organization_members (organization_id, user_id, role, created_at) values ($1, $2, $3, $4)`, [seed.organizationId, seed.userId, seed.role, iso]);
    }
  }

  return {
    db,
    store,
    backend: {
      prepare: async (seeds) => {
        await reset(seeds);
        return store;
      },
    },
    stop: async () => {
      child.kill("SIGTERM");
      await socket.stop();
      await db.close();
    },
  };
}

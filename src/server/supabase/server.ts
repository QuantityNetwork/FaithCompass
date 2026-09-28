import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { serverConfig } from "@/server/config/env";
import type { Database } from "@/server/store/supabase/database.types";

/**
 * Supabase client bound to the signed-in user's session cookies. Uses the
 * public anon key, so every query it makes is subject to Row Level Security.
 */
export async function createUserClient() {
  const config = serverConfig();
  if (!config.supabase) return null;
  const store = await cookies();
  return createServerClient<Database>(config.supabase.url, config.supabase.anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component: cookies are refreshed by the proxy instead.
        }
      },
    },
  });
}

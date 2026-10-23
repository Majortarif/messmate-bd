import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { env } from "@/lib/env";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

/** Supabase client for Client Components (one shared instance per tab). */
export function createClient() {
  browserClient ??= createBrowserClient<Database>(env.supabaseUrl, env.supabaseKey);
  return browserClient;
}

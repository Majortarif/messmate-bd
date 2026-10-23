import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Service client for the few things a user cannot do for themselves (closing
 * their auth account after "delete my account"). It bypasses Row Level
 * Security, so it is server-only and used for exactly that. Returns null when
 * SUPABASE_SECRET_KEY is not configured.
 */
export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env.supabaseUrl || !secret) return null;
  return createClient<Database>(env.supabaseUrl, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Public runtime configuration. Only NEXT_PUBLIC_* values belong here — they
 * are shipped to the browser. Server-only secrets are read where they are used.
 */
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  // Supabase now calls this the "publishable" key; older projects call it "anon".
  supabaseKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "",
};

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseKey);

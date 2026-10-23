import "server-only";
import { createClient as createAnonClient } from "@supabase/supabase-js";
import { cacheLife } from "next/cache";
import { env, isSupabaseConfigured } from "@/lib/env";
import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type Area = { id: number; slug: string; name_bn: string; name_en: string; lat: number | null; lng: number | null };

/**
 * Dhaka areas (public reference data, changes almost never). Read without the
 * user's cookies so it can be cached across requests and prerendered.
 */
export async function getAreas(): Promise<Area[]> {
  "use cache";
  cacheLife("days");
  if (!isSupabaseConfigured) return [];
  const supabase = createAnonClient<Database>(env.supabaseUrl, env.supabaseKey, { auth: { persistSession: false } });
  const { data } = await supabase.from("areas").select("id, slug, name_bn, name_en, lat, lng").order("sort_order");
  return (data ?? []).map((a) => ({ ...a, lat: a.lat === null ? null : Number(a.lat), lng: a.lng === null ? null : Number(a.lng) }));
}

export const areaName = (area: Pick<Area, "name_bn" | "name_en"> | undefined, locale: string) =>
  area ? (locale === "en" ? area.name_en : area.name_bn) : undefined;

/** Names for community authors: full name for messmates, "Rafi A." for strangers. */
export async function getDisplayNames(supabase: Awaited<ReturnType<typeof createClient>>, ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map<string, { name: string | null; avatarUrl: string | null }>();
  const { data } = await supabase.rpc("get_display_names", { p_ids: unique });
  return new Map((data ?? []).map((r) => [r.id, { name: r.name, avatarUrl: r.avatar_url }]));
}

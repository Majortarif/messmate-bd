"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { MARKET_STATUSES, type MarketItemInput, marketItemSchema } from "@/lib/validations/community";

// Second-hand marketplace. Items go live straight away (post-moderated); a
// trigger fixes the seller and mess, and RLS limits edits to the seller.

const uuid = z.uuid();

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, userId: data.user?.id ?? null };
}

export async function saveMarketItem(input: MarketItemInput, itemId?: string): Promise<ActionResult<{ id: string }>> {
  const parsed = marketItemSchema.safeParse(input);
  if (!parsed.success || (itemId && !uuid.safeParse(itemId).success)) return fail("invalid_input");
  const v = parsed.data;
  const { supabase, userId } = await session();
  if (!userId) return fail("not_authenticated");
  const row = {
    title: v.title,
    description: v.description ?? null,
    category: v.category,
    condition: v.condition,
    price: v.price,
    is_negotiable: v.isNegotiable,
    area_id: v.areaId ?? null,
    contact_phone: v.contactPhone,
  };
  const result = itemId
    ? await supabase.from("market_items").update(row).eq("id", itemId).eq("seller_id", userId).select("id").maybeSingle()
    : await supabase.from("market_items").insert({ ...row, seller_id: userId }).select("id").single();
  if (result.error) return fail(result.error);
  if (!result.data) return fail("not_found");
  refresh();
  return ok({ id: result.data.id });
}

export async function addMarketPhotos(itemId: string, paths: string[]): Promise<ActionResult> {
  if (!uuid.safeParse(itemId).success || paths.length === 0 || paths.length > 6) return fail("invalid_input");
  const { supabase, userId } = await session();
  if (!userId) return fail("not_authenticated");
  if (!paths.every((p) => p.startsWith(`${userId}/${itemId}/`) && p.length <= 300)) return fail("invalid_photo_path");
  const { count } = await supabase.from("market_item_photos").select("id", { count: "exact", head: true }).eq("item_id", itemId);
  const start = count ?? 0;
  const { error } = await supabase
    .from("market_item_photos")
    .insert(paths.map((storage_path, i) => ({ item_id: itemId, storage_path, sort_order: start + i })));
  if (error) return fail(error);
  refresh();
  return ok(undefined);
}

export async function removeMarketPhotos(itemId: string, photoIds: string[]): Promise<ActionResult> {
  if (!uuid.safeParse(itemId).success || !photoIds.every((id) => uuid.safeParse(id).success)) return fail("invalid_input");
  if (photoIds.length === 0) return ok(undefined);
  const { supabase } = await session();
  const { data, error } = await supabase
    .from("market_item_photos")
    .delete()
    .eq("item_id", itemId)
    .in("id", photoIds)
    .select("storage_path");
  if (error) return fail(error);
  if (data?.length) await supabase.storage.from("market-photos").remove(data.map((p) => p.storage_path));
  refresh();
  return ok(undefined);
}

export async function setMarketStatus(itemId: string, status: (typeof MARKET_STATUSES)[number]): Promise<ActionResult> {
  if (!uuid.safeParse(itemId).success || !MARKET_STATUSES.includes(status)) return fail("invalid_input");
  const { supabase, userId } = await session();
  if (!userId) return fail("not_authenticated");
  const { data, error } = await supabase.from("market_items").update({ status }).eq("id", itemId).eq("seller_id", userId).select("id");
  if (error) return fail(error);
  if (!data?.length) return fail("not_found");
  refresh();
  return ok(undefined);
}

export async function deleteMarketItem(itemId: string): Promise<ActionResult> {
  if (!uuid.safeParse(itemId).success) return fail("invalid_input");
  const { supabase, userId } = await session();
  if (!userId) return fail("not_authenticated");
  const { data: photos } = await supabase.from("market_item_photos").select("storage_path").eq("item_id", itemId);
  const { data, error } = await supabase.from("market_items").delete().eq("id", itemId).eq("seller_id", userId).select("id");
  if (error) return fail(error);
  if (!data?.length) return fail("not_found");
  if (photos?.length) await supabase.storage.from("market-photos").remove(photos.map((p) => p.storage_path));
  refresh();
  return ok(undefined);
}

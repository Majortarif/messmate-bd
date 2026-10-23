"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { type ReviewInput, reviewSchema, type ServiceInput, serviceSchema } from "@/lib/validations/community";

// Local service directory: anyone suggests a provider (reviewed by a platform
// admin before it is listed), signed-in users rate and review.

const uuid = z.uuid();

/** Suggest a provider, or edit your own suggestion (edits go back to review). */
export async function saveService(input: ServiceInput, serviceId?: string): Promise<ActionResult<{ id: string }>> {
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success || (serviceId && !uuid.safeParse(serviceId).success)) return fail("invalid_input");
  const v = parsed.data;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return fail("not_authenticated");
  const row = {
    name: v.name,
    category: v.category,
    area_id: v.areaId ?? null,
    phone: v.phone,
    alt_phone: v.altPhone ?? null,
    description: v.description ?? null,
    price_note: v.priceNote ?? null,
  };
  const result = serviceId
    ? await supabase.from("service_providers").update(row).eq("id", serviceId).eq("owner_id", auth.user.id).select("id").maybeSingle()
    : await supabase.from("service_providers").insert(row).select("id").single();
  if (result.error) return fail(result.error);
  if (!result.data) return fail("not_found");
  refresh();
  return ok({ id: result.data.id });
}

/** Add or change your rating and review of a provider. */
export async function saveReview(input: ReviewInput): Promise<ActionResult> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const v = parsed.data;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return fail("not_authenticated");
  const { error } = await supabase
    .from("service_reviews")
    .upsert({ provider_id: v.providerId, user_id: auth.user.id, rating: v.rating, comment: v.comment ?? null }, { onConflict: "provider_id,user_id" });
  if (error) return fail(error);
  refresh();
  return ok(undefined);
}

export async function deleteReview(providerId: string): Promise<ActionResult> {
  if (!uuid.safeParse(providerId).success) return fail("invalid_input");
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return fail("not_authenticated");
  const { error } = await supabase.from("service_reviews").delete().eq("provider_id", providerId).eq("user_id", auth.user.id);
  if (error) return fail(error);
  refresh();
  return ok(undefined);
}

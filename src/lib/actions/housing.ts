"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import {
  type HandoverInput,
  handoverSchema,
  type ListingInput,
  listingSchema,
  type MoveChecklistInput,
  moveChecklistSchema,
  type RentPaymentInput,
  rentPaymentSchema,
  type RentRecordInput,
  rentRecordSchema,
  type RoommateInput,
  roommateSchema,
} from "@/lib/validations/community";

// Housing: listings, roommate profile, rent tracker, move checklists.
// Ownership is enforced by RLS and triggers; these actions validate input and
// translate database errors into error keys.

const uuid = z.uuid();

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, userId: data.user?.id ?? null };
}

// ------------------------------------------------------------------ listings --
/** Create or edit a listing. Any content edit sends it back for review. */
export async function saveListing(input: ListingInput, listingId?: string): Promise<ActionResult<{ id: string }>> {
  const parsed = listingSchema.safeParse(input);
  if (!parsed.success || (listingId && !uuid.safeParse(listingId).success)) return fail("invalid_input");
  const v = parsed.data;
  const { supabase, userId } = await session();
  if (!userId) return fail("not_authenticated");
  const row = {
    listing_type: v.listingType,
    title: v.title,
    description: v.description ?? null,
    area_id: v.areaId,
    address_line: v.addressLine ?? null,
    lat: v.lat,
    lng: v.lng,
    rent: v.rent,
    advance_deposit: v.advanceDeposit,
    available_from: v.availableFrom ?? null,
    gender_pref: v.genderPref,
    tenant_pref: v.tenantPref,
    seats_available: v.seatsAvailable,
    facilities: v.facilities,
    contact_name: v.contactName ?? null,
    contact_phone: v.contactPhone,
  };
  const result = listingId
    ? await supabase.from("listings").update(row).eq("id", listingId).eq("owner_id", userId).select("id").maybeSingle()
    : await supabase.from("listings").insert({ ...row, owner_id: userId }).select("id").single();
  if (result.error) return fail(result.error);
  if (!result.data) return fail("not_found");
  refresh();
  return ok({ id: result.data.id });
}

/** Rows for photos the browser already uploaded to listing-photos/{user}/{listing}/. */
export async function addListingPhotos(listingId: string, paths: string[]): Promise<ActionResult> {
  if (!uuid.safeParse(listingId).success || paths.length === 0 || paths.length > 8) return fail("invalid_input");
  const { supabase, userId } = await session();
  if (!userId) return fail("not_authenticated");
  if (!paths.every((p) => p.startsWith(`${userId}/${listingId}/`) && p.length <= 300)) return fail("invalid_photo_path");
  const { count } = await supabase.from("listing_photos").select("id", { count: "exact", head: true }).eq("listing_id", listingId);
  const start = count ?? 0;
  const { error } = await supabase
    .from("listing_photos")
    .insert(paths.map((storage_path, i) => ({ listing_id: listingId, storage_path, sort_order: start + i })));
  if (error) return fail(error);
  refresh();
  return ok(undefined);
}

export async function removeListingPhotos(listingId: string, photoIds: string[]): Promise<ActionResult> {
  if (!uuid.safeParse(listingId).success || !photoIds.every((id) => uuid.safeParse(id).success)) return fail("invalid_input");
  if (photoIds.length === 0) return ok(undefined);
  const { supabase } = await session();
  const { data, error } = await supabase
    .from("listing_photos")
    .delete()
    .eq("listing_id", listingId)
    .in("id", photoIds)
    .select("storage_path");
  if (error) return fail(error);
  if (data?.length) await supabase.storage.from("listing-photos").remove(data.map((p) => p.storage_path));
  refresh();
  return ok(undefined);
}

/** Owner switches: filled / open again, archive / back to review. */
export async function updateListingState(listingId: string, change: "fill" | "reopen" | "archive" | "restore"): Promise<ActionResult> {
  if (!uuid.safeParse(listingId).success) return fail("invalid_input");
  const { supabase, userId } = await session();
  if (!userId) return fail("not_authenticated");
  const patch =
    change === "fill"
      ? { is_filled: true }
      : change === "reopen"
        ? { is_filled: false }
        : change === "archive"
          ? { status: "archived" as const }
          : { status: "pending" as const };
  const { data, error } = await supabase.from("listings").update(patch).eq("id", listingId).eq("owner_id", userId).select("id");
  if (error) return fail(error);
  if (!data?.length) return fail("not_found");
  refresh();
  return ok(undefined);
}

export async function deleteListing(listingId: string): Promise<ActionResult> {
  if (!uuid.safeParse(listingId).success) return fail("invalid_input");
  const { supabase, userId } = await session();
  if (!userId) return fail("not_authenticated");
  const { data: photos } = await supabase.from("listing_photos").select("storage_path").eq("listing_id", listingId);
  const { data, error } = await supabase.from("listings").delete().eq("id", listingId).eq("owner_id", userId).select("id");
  if (error) return fail(error);
  if (!data?.length) return fail("not_found");
  if (photos?.length) await supabase.storage.from("listing-photos").remove(photos.map((p) => p.storage_path));
  refresh();
  return ok(undefined);
}

// ---------------------------------------------------------------- roommates --
export async function saveRoommateProfile(input: RoommateInput): Promise<ActionResult> {
  const parsed = roommateSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const v = parsed.data;
  const { supabase, userId } = await session();
  if (!userId) return fail("not_authenticated");
  const { error } = await supabase.from("roommate_profiles").upsert(
    {
      user_id: userId,
      is_active: v.isActive,
      gender: v.gender,
      occupation: v.occupation,
      budget_min: v.budgetMin,
      budget_max: v.budgetMax,
      smoking: v.smoking,
      sleep_schedule: v.sleepSchedule,
      cleanliness: v.cleanliness,
      food_pref: v.foodPref,
      guests_ok: v.guestsOk,
      move_in_date: v.moveInDate ?? null,
      about: v.about ?? null,
      contact_phone: v.contactPhone ?? null,
      show_phone: v.showPhone,
    },
    { onConflict: "user_id" },
  );
  if (error) return fail(error);
  // replace area preferences
  const { error: clearError } = await supabase.from("roommate_area_prefs").delete().eq("user_id", userId);
  if (clearError) return fail(clearError);
  if (v.areaIds.length > 0) {
    const { error: areaError } = await supabase
      .from("roommate_area_prefs")
      .insert([...new Set(v.areaIds)].map((area_id) => ({ user_id: userId, area_id })));
    if (areaError) return fail(areaError);
  }
  refresh();
  return ok(undefined);
}

// ------------------------------------------------------------- rent tracker --
export async function saveRentRecord(input: RentRecordInput, recordId?: string): Promise<ActionResult> {
  const parsed = rentRecordSchema.safeParse(input);
  if (!parsed.success || (recordId && !uuid.safeParse(recordId).success)) return fail("invalid_input");
  const v = parsed.data;
  const { supabase, userId } = await session();
  if (!userId) return fail("not_authenticated");
  const row = {
    title: v.title,
    landlord_name: v.landlordName ?? null,
    landlord_phone: v.landlordPhone ?? null,
    property_address: v.propertyAddress ?? null,
    monthly_rent: v.monthlyRent,
    advance_paid: v.advancePaid,
    security_deposit: v.securityDeposit,
    rent_due_day: v.rentDueDay,
    agreement_start: v.agreementStart ?? null,
    agreement_end: v.agreementEnd ?? null,
    notice_period_days: v.noticePeriodDays ?? null,
    agreement_notes: v.agreementNotes ?? null,
    is_active: v.isActive,
  };
  const { data, error } = recordId
    ? await supabase.from("rent_records").update(row).eq("id", recordId).select("id")
    : await supabase.from("rent_records").insert({ ...row, user_id: userId }).select("id");
  if (error) return fail(error);
  if (!data?.length) return fail("not_found");
  refresh();
  return ok(undefined);
}

export async function deleteRentRecord(recordId: string): Promise<ActionResult> {
  if (!uuid.safeParse(recordId).success) return fail("invalid_input");
  const { supabase } = await session();
  const { data, error } = await supabase.from("rent_records").delete().eq("id", recordId).select("id");
  if (error) return fail(error);
  if (!data?.length) return fail("not_found");
  refresh();
  return ok(undefined);
}

/** Record (or correct) the rent paid for one month. */
export async function saveRentPayment(input: RentPaymentInput): Promise<ActionResult> {
  const parsed = rentPaymentSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const v = parsed.data;
  const { supabase, userId } = await session();
  if (!userId) return fail("not_authenticated");
  const { error } = await supabase.from("rent_payments").upsert(
    {
      rent_record_id: v.recordId,
      user_id: userId,
      period_month: `${v.month}-01`,
      amount: v.amount,
      paid_on: v.paidOn,
      method: v.method,
      note: v.note ?? null,
    },
    { onConflict: "rent_record_id,period_month" },
  );
  if (error) return fail(error);
  refresh();
  return ok(undefined);
}

export async function deleteRentPayment(paymentId: string): Promise<ActionResult> {
  if (!uuid.safeParse(paymentId).success) return fail("invalid_input");
  const { supabase } = await session();
  const { error } = await supabase.from("rent_payments").delete().eq("id", paymentId);
  if (error) return fail(error);
  refresh();
  return ok(undefined);
}

// ----------------------------------------------------------- move checklists --
export async function createMoveChecklist(input: MoveChecklistInput): Promise<ActionResult<{ id: string }>> {
  const parsed = moveChecklistSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const v = parsed.data;
  const { supabase } = await session();
  const { data, error } = await supabase.rpc("create_move_checklist", {
    p_kind: v.kind,
    p_title: v.title,
    p_address: v.address ?? undefined,
    p_date: v.date ?? undefined,
  });
  if (error || !data) return fail(error);
  refresh();
  return ok({ id: data });
}

export async function deleteMoveChecklist(checklistId: string): Promise<ActionResult> {
  if (!uuid.safeParse(checklistId).success) return fail("invalid_input");
  const { supabase, userId } = await session();
  if (!userId) return fail("not_authenticated");
  const { data: items } = await supabase.from("move_checklist_items").select("photo_path").eq("checklist_id", checklistId);
  const { data, error } = await supabase.from("move_checklists").delete().eq("id", checklistId).select("id");
  if (error) return fail(error);
  if (!data?.length) return fail("not_found");
  const photos = (items ?? []).map((i) => i.photo_path).filter((p): p is string => Boolean(p));
  if (photos.length) await supabase.storage.from("personal").remove(photos);
  refresh();
  return ok(undefined);
}

const itemPatch = z.object({
  isDone: z.boolean().optional(),
  note: z.string().trim().max(300).nullable().optional(),
  photoPath: z.string().max(300).nullable().optional(),
});

export async function updateChecklistItem(itemId: string, input: z.input<typeof itemPatch>): Promise<ActionResult> {
  const parsed = itemPatch.safeParse(input);
  if (!uuid.safeParse(itemId).success || !parsed.success) return fail("invalid_input");
  const v = parsed.data;
  const { supabase, userId } = await session();
  if (!userId) return fail("not_authenticated");
  if (v.photoPath && !v.photoPath.startsWith(`${userId}/move/`)) return fail("invalid_photo_path");
  const patch: { is_done?: boolean; note?: string | null; photo_path?: string | null } = {};
  if (v.isDone !== undefined) patch.is_done = v.isDone;
  if (v.note !== undefined) patch.note = v.note || null;
  let oldPhoto: string | null = null;
  if (v.photoPath !== undefined) {
    const { data: current } = await supabase.from("move_checklist_items").select("photo_path").eq("id", itemId).maybeSingle();
    oldPhoto = current?.photo_path ?? null;
    patch.photo_path = v.photoPath;
  }
  const { data, error } = await supabase.from("move_checklist_items").update(patch).eq("id", itemId).select("id");
  if (error) return fail(error);
  if (!data?.length) return fail("not_found");
  if (oldPhoto && oldPhoto !== v.photoPath) await supabase.storage.from("personal").remove([oldPhoto]);
  refresh();
  return ok(undefined);
}

export async function addChecklistItem(checklistId: string, label: string): Promise<ActionResult> {
  const text = label.trim();
  if (!uuid.safeParse(checklistId).success || text.length < 1 || text.length > 150) return fail("invalid_input");
  const { supabase } = await session();
  const { data: last } = await supabase
    .from("move_checklist_items")
    .select("sort_order")
    .eq("checklist_id", checklistId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("move_checklist_items")
    .insert({ checklist_id: checklistId, label: text, sort_order: (last?.sort_order ?? 0) + 1 });
  if (error) return fail(error);
  refresh();
  return ok(undefined);
}

export async function deleteChecklistItem(itemId: string): Promise<ActionResult> {
  if (!uuid.safeParse(itemId).success) return fail("invalid_input");
  const { supabase } = await session();
  const { data, error } = await supabase.from("move_checklist_items").delete().eq("id", itemId).select("photo_path");
  if (error) return fail(error);
  if (!data?.length) return fail("not_found");
  if (data[0].photo_path) await supabase.storage.from("personal").remove([data[0].photo_path]);
  refresh();
  return ok(undefined);
}

/** Meter readings, keys, deposit and notes; `complete` stamps the handover as done. */
export async function saveHandover(checklistId: string, input: HandoverInput, complete?: boolean): Promise<ActionResult> {
  const parsed = handoverSchema.safeParse(input);
  if (!uuid.safeParse(checklistId).success || !parsed.success) return fail("invalid_input");
  const v = parsed.data;
  const { supabase } = await session();
  const { data, error } = await supabase
    .from("move_checklists")
    .update({
      handover_to: v.handoverTo ?? null,
      handover_phone: v.handoverPhone ?? null,
      electricity_meter: v.electricityMeter ?? null,
      gas_meter: v.gasMeter ?? null,
      water_meter: v.waterMeter ?? null,
      keys_count: v.keysCount ?? null,
      deposit_amount: v.depositAmount ?? null,
      deposit_returned: v.depositReturned ?? null,
      handover_notes: v.handoverNotes ?? null,
      ...(complete === undefined ? {} : { completed_at: complete ? new Date().toISOString() : null }),
    })
    .eq("id", checklistId)
    .select("id");
  if (error) return fail(error);
  if (!data?.length) return fail("not_found");
  refresh();
  return ok(undefined);
}

"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import {
  billSchema,
  customSplitSchema,
  expenseSchema,
  mealSettingsSchema,
  messInfoSchema,
  paymentSchema,
  roomSchema,
  type BillInput,
  type ExpenseInput,
  type MealSettingsInput,
  type MessInfoInput,
  type PaymentInput,
  type RoomInput,
} from "@/lib/validations/manage";

// Manager actions. The client is never trusted: RLS only lets the active manager
// of a mess write its rows, and triggers / RPCs enforce month locks and money rules.

const uuid = z.uuid();
const bad = () => fail("invalid_input");

async function done<T>(result: { error: unknown }, data: T): Promise<ActionResult<T>> {
  if (result.error) return fail(result.error);
  refresh();
  return ok(data);
}

/** Supabase returns no error when RLS filters every row away; treat that as "not manager". */
function assertTouched(rows: unknown[] | null) {
  return rows && rows.length > 0 ? null : { message: "not_manager" };
}

// ------------------------------------------------------------------- members --
const memberPatch = z.object({
  membershipId: z.uuid(),
  role: z.enum(["manager", "member"]).optional(),
  status: z.enum(["active", "inactive", "left"]).optional(),
  roomId: z.uuid().nullable().optional(),
  seatLabel: z.string().trim().max(20).optional(),
});

export async function updateMember(input: z.input<typeof memberPatch>): Promise<ActionResult> {
  const parsed = memberPatch.safeParse(input);
  if (!parsed.success) return bad();
  const v = parsed.data;
  const supabase = await createClient();
  return done(
    await supabase.rpc("update_member", {
      p_membership_id: v.membershipId,
      p_role: v.role,
      p_status: v.status,
      p_room_id: v.roomId ?? undefined,
      p_seat_label: v.seatLabel,
      p_clear_room: v.roomId === null,
    }),
    undefined,
  );
}

export async function saveRoom(messId: string, input: RoomInput): Promise<ActionResult> {
  const parsed = roomSchema.safeParse(input);
  if (!parsed.success || !uuid.safeParse(messId).success) return bad();
  const v = parsed.data;
  const row = {
    mess_id: messId,
    building: v.building ?? null,
    flat: v.flat ?? null,
    room_label: v.roomLabel,
    room_type: v.roomType,
    capacity: v.capacity,
    monthly_rent: v.monthlyRent,
  };
  const supabase = await createClient();
  const result = v.id
    ? await supabase.from("mess_rooms").update(row).eq("id", v.id).select("id")
    : await supabase.from("mess_rooms").insert(row).select("id");
  return done({ error: result.error ?? assertTouched(result.data) }, undefined);
}

export async function deleteRoom(roomId: string): Promise<ActionResult> {
  if (!uuid.safeParse(roomId).success) return bad();
  const supabase = await createClient();
  const result = await supabase.from("mess_rooms").delete().eq("id", roomId).select("id");
  return done({ error: result.error ?? assertTouched(result.data) }, undefined);
}

// ------------------------------------------------------------------ settings --
export async function updateMessInfo(messId: string, input: MessInfoInput): Promise<ActionResult> {
  const parsed = messInfoSchema.safeParse(input);
  if (!parsed.success || !uuid.safeParse(messId).success) return bad();
  const v = parsed.data;
  const supabase = await createClient();
  const result = await supabase
    .from("messes")
    .update({
      name: v.name,
      area_id: v.areaId,
      address: v.address ?? null,
      building_name: v.buildingName ?? null,
      description: v.description ?? null,
      gender_policy: v.genderPolicy,
    })
    .eq("id", messId)
    .select("id");
  return done({ error: result.error ?? assertTouched(result.data) }, undefined);
}

export async function updateMealSettings(messId: string, input: MealSettingsInput): Promise<ActionResult> {
  const parsed = mealSettingsSchema.safeParse(input);
  if (!parsed.success || !uuid.safeParse(messId).success) return bad();
  const v = parsed.data;
  const supabase = await createClient();
  const result = await supabase
    .from("mess_settings")
    .update({
      meal_rate_mode: v.mealRateMode,
      breakfast_price: v.breakfastPrice,
      lunch_price: v.lunchPrice,
      dinner_price: v.dinnerPrice,
      breakfast_weight: v.breakfastWeight,
      lunch_weight: v.lunchWeight,
      dinner_weight: v.dinnerWeight,
      breakfast_cutoff: v.breakfastCutoff,
      breakfast_cutoff_prev_day: v.breakfastPrevDay,
      lunch_cutoff: v.lunchCutoff,
      lunch_cutoff_prev_day: v.lunchPrevDay,
      dinner_cutoff: v.dinnerCutoff,
      dinner_cutoff_prev_day: v.dinnerPrevDay,
      guest_meal_allowed: v.guestMealAllowed,
      max_guests_per_meal: v.maxGuests,
      credit_limit: v.creditLimit,
      low_balance_threshold: v.lowBalanceThreshold,
      split_shared_expenses: v.splitSharedExpenses,
      auto_close_enabled: v.autoCloseEnabled,
      auto_close_day: v.autoCloseDay,
    })
    .eq("mess_id", messId)
    .select("mess_id");
  return done({ error: result.error ?? assertTouched(result.data) }, undefined);
}

export async function updatePaymentNumbers(messId: string, input: PaymentInput): Promise<ActionResult> {
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success || !uuid.safeParse(messId).success) return bad();
  const v = parsed.data;
  const supabase = await createClient();
  const result = await supabase
    .from("mess_settings")
    .update({ bkash_number: v.bkash, nagad_number: v.nagad, rocket_number: v.rocket, payment_note: v.note ?? null })
    .eq("mess_id", messId)
    .select("mess_id");
  return done({ error: result.error ?? assertTouched(result.data) }, undefined);
}

// ------------------------------------------------------------------ expenses --
export async function saveExpense(messId: string, input: ExpenseInput, expenseId?: string): Promise<ActionResult> {
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success || !uuid.safeParse(messId).success) return bad();
  const v = parsed.data;
  const supabase = await createClient();
  const base = {
    category: v.category,
    amount: v.amount,
    expense_date: v.expenseDate,
    description: v.description ?? null,
    ...(v.receiptPath ? { receipt_path: v.receiptPath } : {}),
  };
  const result = expenseId
    ? await supabase.from("expenses").update(base).eq("id", expenseId).select("id")
    : await supabase
        .from("expenses")
        .insert({ ...base, mess_id: messId, paid_from: v.paidFrom, paid_by: v.paidFrom === "member" ? v.paidBy : null })
        .select("id");
  return done({ error: result.error ?? assertTouched(result.data) }, undefined);
}

export async function deleteExpense(expenseId: string): Promise<ActionResult> {
  if (!uuid.safeParse(expenseId).success) return bad();
  const supabase = await createClient();
  const result = await supabase.from("expenses").delete().eq("id", expenseId).select("id");
  return done({ error: result.error ?? assertTouched(result.data) }, undefined);
}

// --------------------------------------------------------------------- bills --
export async function createBill(messId: string, month: string, input: BillInput): Promise<ActionResult> {
  const parsed = billSchema.safeParse(input);
  if (!parsed.success || !uuid.safeParse(messId).success || !/^\d{4}-\d{2}-01$/.test(month)) return bad();
  const v = parsed.data;
  const supabase = await createClient();
  const result = await supabase
    .from("bills")
    .insert({
      mess_id: messId,
      bill_type: v.billType,
      period_month: month,
      split_mode: v.splitMode,
      total_amount: v.splitMode === "by_room" ? 0 : Number(v.totalAmount),
      due_date: v.dueDate || null,
      description: v.description ?? null,
    })
    .select("id");
  return done({ error: result.error ?? assertTouched(result.data) }, undefined);
}

export async function deleteBill(billId: string): Promise<ActionResult> {
  if (!uuid.safeParse(billId).success) return bad();
  const supabase = await createClient();
  const result = await supabase.from("bills").delete().eq("id", billId).select("id");
  return done({ error: result.error ?? assertTouched(result.data) }, undefined);
}

export async function postBill(billId: string, custom?: { user_id: string; amount: number }[]): Promise<ActionResult> {
  if (!uuid.safeParse(billId).success) return bad();
  if (custom && !customSplitSchema.safeParse(custom).success) return bad();
  const supabase = await createClient();
  return done(await supabase.rpc("post_bill", { p_bill_id: billId, p_custom: custom }), undefined);
}

export async function voidBill(billId: string, reason: string): Promise<ActionResult> {
  if (!uuid.safeParse(billId).success) return bad();
  const supabase = await createClient();
  return done(await supabase.rpc("void_bill", { p_bill_id: billId, p_reason: reason.trim() }), undefined);
}

// ------------------------------------------------------------------- closing --
export async function closeMonth(messId: string, month: string): Promise<ActionResult> {
  if (!uuid.safeParse(messId).success || !/^\d{4}-\d{2}-01$/.test(month)) return bad();
  const supabase = await createClient();
  return done(await supabase.rpc("close_month", { p_mess_id: messId, p_month: month }), undefined);
}

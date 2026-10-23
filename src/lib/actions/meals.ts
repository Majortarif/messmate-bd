"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { menuDraftSchema, type MenuDraft } from "@/lib/validations/meals";

export type OrderState = { status: "ordered" | "cancelled"; guestCount: number; charged: number; balance: number };

const setOrderSchema = z.object({
  menuId: z.uuid(),
  ordered: z.boolean(),
  guests: z.number().int().min(0).max(10),
  userId: z.uuid().optional(),
});

/** Order, cancel or change guests for one meal. Managers may pass userId to act for a member. */
export async function setMealOrder(input: z.input<typeof setOrderSchema>): Promise<ActionResult<OrderState>> {
  const parsed = setOrderSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const { menuId, ordered, guests, userId } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_meal_order", {
    p_menu_id: menuId,
    p_ordered: ordered,
    p_guest_count: guests,
    p_user_id: userId,
  });
  if (error || !data) return fail(error);
  const result = data as { status: "ordered" | "cancelled"; guest_count: number; charged_amount: number; balance: number };
  refresh();
  return ok({ status: result.status, guestCount: result.guest_count, charged: result.charged_amount, balance: result.balance });
}

/** Manager: create or update menus for a set of days/slots (one call per save). */
export async function saveMenus(messId: string, drafts: MenuDraft[]): Promise<ActionResult<{ saved: number }>> {
  const parsed = z.array(menuDraftSchema).max(21).safeParse(drafts);
  if (!parsed.success || !z.uuid().safeParse(messId).success) return fail("invalid_input");
  const supabase = await createClient();

  const toSave = parsed.data.filter((d) => d.items);
  const toDelete = parsed.data.filter((d) => !d.items && d.id);

  if (toSave.length) {
    const { error } = await supabase.from("menus").upsert(
      toSave.map((d) => ({
        mess_id: messId,
        menu_date: d.date,
        slot: d.slot,
        items: d.items!,
        price: d.price ?? null,
        is_locked: d.locked,
      })),
      { onConflict: "mess_id,menu_date,slot" },
    );
    if (error) return fail(error);
  }
  for (const d of toDelete) {
    const { error } = await supabase.from("menus").delete().eq("id", d.id!);
    if (error) return fail(error);
  }
  refresh();
  return ok({ saved: toSave.length + toDelete.length });
}

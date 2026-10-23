"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { depositSchema, managerEntrySchema, type DepositInput, type ManagerEntryInput } from "@/lib/validations/wallet";

/** Member: "I sent ৳X" — waits for the manager to check the TrxID. */
export async function submitDeposit(input: DepositInput): Promise<ActionResult<{ id: string }>> {
  const parsed = depositSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_deposit", {
    p_amount: v.amount,
    p_method: v.method,
    p_trx_id: v.method === "cash" ? undefined : v.trxId,
    p_sender_number: v.senderNumber || undefined,
    p_paid_at: v.paidAt || undefined,
    p_note: v.note || undefined,
    p_proof_path: v.proofPath || undefined,
  });
  if (error || !data) return fail(error);
  refresh();
  return ok({ id: data });
}

const reviewSchema = z.object({ requestId: z.uuid(), approve: z.boolean(), note: z.string().trim().max(300).optional() });

/** Manager: approve (credits the wallet) or reject a deposit request. */
export async function reviewDeposit(input: z.input<typeof reviewSchema>): Promise<ActionResult> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_deposit", {
    p_request_id: parsed.data.requestId,
    p_approve: parsed.data.approve,
    p_note: parsed.data.note || undefined,
  });
  if (error) return fail(error);
  refresh();
  return ok(undefined);
}

/** Manager: cash received in hand, a correction, or money paid back to a member. */
export async function managerLedgerEntry(input: ManagerEntryInput): Promise<ActionResult> {
  const parsed = managerEntrySchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const v = parsed.data;
  const amount = v.type === "adjustment" && v.direction === "debit" ? -v.amount : v.amount;
  const supabase = await createClient();
  const { error } = await supabase.rpc("manager_ledger_entry", {
    p_user_id: v.userId,
    p_type: v.type,
    p_amount: amount,
    p_note: v.note || undefined,
  });
  if (error) return fail(error);
  refresh();
  return ok(undefined);
}

/** Manager: undo a deposit / adjustment / payout / reimbursement with a reversal entry. */
export async function reverseLedgerEntry(entryId: string, reason: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(entryId).success) return fail("invalid_input");
  const supabase = await createClient();
  const { error } = await supabase.rpc("reverse_ledger_entry", { p_entry_id: entryId, p_reason: reason.trim() });
  if (error) return fail(error);
  refresh();
  return ok(undefined);
}

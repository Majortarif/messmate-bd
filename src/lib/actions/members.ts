"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { decideJoinSchema } from "@/lib/validations/mess";

// Every action re-checks the role inside Postgres (RPC or RLS), never trusting the client.

export async function decideJoinRequest(input: z.input<typeof decideJoinSchema>): Promise<ActionResult> {
  const parsed = decideJoinSchema.safeParse(input);
  if (!parsed.success) return fail("generic");
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_join_request", {
    p_membership_id: parsed.data.membershipId,
    p_approve: parsed.data.approve,
    p_note: parsed.data.note,
  });
  if (error) return fail(error);
  refresh();
  return ok(undefined);
}

export async function regenerateInviteCode(messId: string): Promise<ActionResult<{ code: string }>> {
  if (!z.uuid().safeParse(messId).success) return fail("generic");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("regenerate_invite_code", { p_mess_id: messId });
  if (error || !data) return fail(error);
  refresh();
  return ok({ code: data });
}

export async function setInviteEnabled(messId: string, enabled: boolean): Promise<ActionResult> {
  if (!z.uuid().safeParse(messId).success) return fail("generic");
  const supabase = await createClient();
  const { data, error } = await supabase.from("messes").update({ invite_enabled: enabled }).eq("id", messId).select("id");
  if (error) return fail(error);
  if (!data?.length) return fail("not_manager");
  refresh();
  return ok(undefined);
}

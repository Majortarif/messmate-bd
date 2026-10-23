"use server";

import { refresh } from "next/cache";
import { TERMS_VERSION } from "@/lib/constants";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { createMessSchema, inviteCodeField, joinMessSchema, type CreateMessInput, type JoinMessInput } from "@/lib/validations/mess";
import type { MessInvitePreview } from "@/types/app";

export async function acceptTerms(): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_legal", { p_version: TERMS_VERSION });
  if (error) return fail(error);
  refresh();
  return ok(undefined);
}

export async function createMess(input: CreateMessInput): Promise<ActionResult<{ messId: string }>> {
  const parsed = createMessSchema.safeParse(input);
  if (!parsed.success) return fail("generic");
  const v = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_mess", {
    p_name: v.name,
    p_area_id: v.areaId,
    p_address: v.address,
    p_building_name: v.buildingName,
    p_description: v.description,
    p_meal_rate_mode: v.mealRateMode,
    p_gender_policy: v.genderPolicy,
  });
  if (error || !data) return fail(error);
  refresh();
  return ok({ messId: data });
}

export async function previewInvite(code: string): Promise<ActionResult<MessInvitePreview | null>> {
  const parsed = inviteCodeField.safeParse(code);
  if (!parsed.success) return fail("invalid_invite");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_mess_by_invite", { p_code: parsed.data });
  if (error) return fail(error);
  return ok((data?.[0] as MessInvitePreview | undefined) ?? null);
}

export async function requestJoin(input: JoinMessInput): Promise<ActionResult> {
  const parsed = joinMessSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_invite");
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_join", { p_code: parsed.data.code, p_note: parsed.data.note });
  if (error) return fail(error);
  refresh();
  return ok(undefined);
}

export async function cancelJoinRequest(): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_join_request");
  if (error) return fail(error);
  refresh();
  return ok(undefined);
}

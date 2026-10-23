"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { ACTIVITY_CATEGORIES, type ActivityEntry, MODERATION_KINDS, PLATFORM_ROLES, type PlatformRole } from "@/types/app";

// Reads and moderation for managers (own mess) and super admins. Postgres
// re-checks the role inside every RPC and RLS policy.

const activitySchema = z.object({
  messId: z.uuid().nullable(),
  category: z.enum(ACTIVITY_CATEGORIES).nullable(),
  before: z.number().int().positive(),
});

/** Older activity log entries, for "Load more". */
export async function loadActivity(input: z.input<typeof activitySchema>): Promise<ActionResult<ActivityEntry[]>> {
  const parsed = activitySchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_activity_log", {
    p_mess_id: parsed.data.messId ?? undefined,
    p_category: parsed.data.category ?? undefined,
    p_before: parsed.data.before,
    p_limit: 40,
  });
  if (error) return fail(error);
  return ok((data ?? []) as unknown as ActivityEntry[]);
}

export async function setPlatformRole(userId: string, role: PlatformRole): Promise<ActionResult> {
  if (!z.uuid().safeParse(userId).success || !PLATFORM_ROLES.includes(role)) return fail("invalid_input");
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_platform_role", { p_user_id: userId, p_role: role });
  if (error) return fail(error);
  refresh();
  return ok(undefined);
}

export async function setMessActive(messId: string, active: boolean, reason?: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(messId).success) return fail("invalid_input");
  const note = z.string().trim().max(300).optional().safeParse(reason);
  if (!note.success) return fail("invalid_input");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_mess_active", {
    p_mess_id: messId,
    p_active: active,
    p_reason: note.data || undefined,
  });
  if (error) return fail(error);
  refresh();
  return ok(undefined);
}

const moderateSchema = z.object({
  kind: z.enum(MODERATION_KINDS),
  id: z.uuid(),
  status: z.enum(["approved", "rejected", "archived", "pending", "removed", "open", "closed", "available"]),
  reason: z.string().trim().max(300).optional(),
  verified: z.boolean().optional(),
});

/** Approve / reject / remove community content (listings, services, recipes, events, jobs, market items). */
export async function moderate(input: z.input<typeof moderateSchema>): Promise<ActionResult> {
  const parsed = moderateSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("moderate_content", {
    p_kind: v.kind,
    p_id: v.id,
    p_status: v.status,
    p_reason: v.reason || undefined,
    p_verified: v.verified,
  });
  if (error) return fail(error);
  refresh();
  return ok(undefined);
}

const feedbackSchema = z.object({
  id: z.uuid(),
  status: z.enum(["new", "reviewing", "resolved"]),
  note: z.string().trim().max(1000).optional(),
});

export async function updateFeedback(input: z.input<typeof feedbackSchema>): Promise<ActionResult> {
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feedback")
    .update({ status: parsed.data.status, admin_note: parsed.data.note || null })
    .eq("id", parsed.data.id)
    .select("id");
  if (error) return fail(error);
  if (!data?.length) return fail("not_super_admin");
  refresh();
  return ok(undefined);
}

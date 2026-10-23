"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import {
  type ComplaintInput,
  complaintSchema,
  type NoticeInput,
  noticeSchema,
  type PollInput,
  pollSchema,
  type ReplyInput,
  replySchema,
  type RosterInput,
  rosterSchema,
} from "@/lib/validations/mess-life";
import type { MyContext } from "@/types/app";

// Notices, complaints, polls and the duty roster. RLS + triggers decide who
// may do what (members vs manager); these actions validate and map errors.

const uuid = z.uuid();

async function context() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_my_context");
  const membership = (data as unknown as MyContext | null)?.membership ?? null;
  return { supabase, membership };
}

// ------------------------------------------------------------------- notices --
export async function saveNotice(input: NoticeInput, noticeId?: string): Promise<ActionResult> {
  const parsed = noticeSchema.safeParse(input);
  if (!parsed.success || (noticeId && !uuid.safeParse(noticeId).success)) return fail("invalid_input");
  const v = parsed.data;
  const { supabase, membership } = await context();
  if (!membership || membership.role !== "manager" || membership.status !== "active") return fail("not_manager");
  const row = {
    title: v.title,
    body: v.body,
    priority: v.priority,
    is_pinned: v.isPinned,
    // the notice disappears from members' boards at the end of that Dhaka day
    expires_at: v.expiresOn ? `${v.expiresOn}T23:59:59+06:00` : null,
  };
  const { data, error } = noticeId
    ? await supabase.from("notices").update(row).eq("id", noticeId).select("id")
    : await supabase.from("notices").insert({ ...row, mess_id: membership.mess_id }).select("id");
  if (error) return fail(error);
  if (!data?.length) return fail("not_manager");
  refresh();
  return ok(undefined);
}

export async function setNoticePinned(noticeId: string, pinned: boolean): Promise<ActionResult> {
  if (!uuid.safeParse(noticeId).success) return fail("invalid_input");
  const { supabase } = await context();
  const { data, error } = await supabase.from("notices").update({ is_pinned: pinned }).eq("id", noticeId).select("id");
  if (error) return fail(error);
  if (!data?.length) return fail("not_manager");
  refresh();
  return ok(undefined);
}

export async function deleteNotice(noticeId: string): Promise<ActionResult> {
  if (!uuid.safeParse(noticeId).success) return fail("invalid_input");
  const { supabase } = await context();
  const { data, error } = await supabase.from("notices").delete().eq("id", noticeId).select("id");
  if (error) return fail(error);
  if (!data?.length) return fail("not_manager");
  refresh();
  return ok(undefined);
}

// ---------------------------------------------------------------- complaints --
/** File a complaint, or edit your own while it is still open. */
export async function saveComplaint(input: ComplaintInput, complaintId?: string): Promise<ActionResult> {
  const parsed = complaintSchema.safeParse(input);
  if (!parsed.success || (complaintId && !uuid.safeParse(complaintId).success)) return fail("invalid_input");
  const v = parsed.data;
  const { supabase, membership } = await context();
  if (!membership || membership.status === "pending") return fail("not_member");
  if (v.photoPath && !v.photoPath.startsWith(`${membership.mess_id}/`)) return fail("invalid_photo_path");
  const row = {
    category: v.category,
    title: v.title,
    description: v.description ?? null,
    priority: v.priority,
    ...(v.photoPath !== undefined ? { photo_path: v.photoPath } : {}),
  };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return fail("not_authenticated");
  const { data, error } = complaintId
    ? await supabase.from("complaints").update(row).eq("id", complaintId).select("id")
    : await supabase.from("complaints").insert({ ...row, mess_id: membership.mess_id, created_by: auth.user.id }).select("id");
  if (error) return fail(error);
  if (!data?.length) return fail("not_found");
  refresh();
  return ok(undefined);
}

export async function deleteComplaint(complaintId: string): Promise<ActionResult> {
  if (!uuid.safeParse(complaintId).success) return fail("invalid_input");
  const { supabase } = await context();
  const { data, error } = await supabase.from("complaints").delete().eq("id", complaintId).select("photo_path");
  if (error) return fail(error);
  if (!data?.length) return fail("complaint_locked");
  if (data[0].photo_path) await supabase.storage.from("complaint-photos").remove([data[0].photo_path]);
  refresh();
  return ok(undefined);
}

/** A reply in the complaint thread; managers may change the status with it. */
export async function replyToComplaint(input: ReplyInput): Promise<ActionResult> {
  const parsed = replySchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const v = parsed.data;
  const { supabase, membership } = await context();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return fail("not_authenticated");
  if (!membership) return fail("not_member");
  const { error } = await supabase.from("complaint_updates").insert({
    complaint_id: v.complaintId,
    mess_id: membership.mess_id, // the trigger copies it from the complaint anyway
    author_id: auth.user.id,
    message: v.message,
    status_change: v.statusChange ?? null,
  });
  if (error) return fail(error);
  refresh();
  return ok(undefined);
}

// --------------------------------------------------------------------- polls --
export async function createPoll(input: PollInput): Promise<ActionResult> {
  const parsed = pollSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const v = parsed.data;
  const { supabase } = await context();
  const { error } = await supabase.rpc("create_poll", {
    p_question: v.question,
    p_options: v.options.map((o) => o.label).filter(Boolean),
    p_description: v.description ?? undefined,
    p_allow_multiple: v.allowMultiple,
    p_is_anonymous: v.isAnonymous,
    p_closes_at: v.closesAt ? `${v.closesAt}:00+06:00` : undefined,
  });
  if (error) return fail(error);
  refresh();
  return ok(undefined);
}

export async function castVote(pollId: string, optionIds: string[]): Promise<ActionResult> {
  if (!uuid.safeParse(pollId).success || !optionIds.every((id) => uuid.safeParse(id).success)) return fail("invalid_input");
  const { supabase } = await context();
  const { error } = await supabase.rpc("cast_vote", { p_poll_id: pollId, p_option_ids: optionIds });
  if (error) return fail(error);
  refresh();
  return ok(undefined);
}

export async function closePoll(pollId: string): Promise<ActionResult> {
  if (!uuid.safeParse(pollId).success) return fail("invalid_input");
  const { supabase } = await context();
  const { data, error } = await supabase.from("polls").update({ is_closed: true }).eq("id", pollId).select("id");
  if (error) return fail(error);
  if (!data?.length) return fail("not_manager");
  refresh();
  return ok(undefined);
}

export async function deletePoll(pollId: string): Promise<ActionResult> {
  if (!uuid.safeParse(pollId).success) return fail("invalid_input");
  const { supabase } = await context();
  const { data, error } = await supabase.from("polls").delete().eq("id", pollId).select("id");
  if (error) return fail(error);
  if (!data?.length) return fail("not_manager");
  refresh();
  return ok(undefined);
}

// -------------------------------------------------------------------- roster --
export async function generateRoster(input: RosterInput): Promise<ActionResult<{ count: number }>> {
  const parsed = rosterSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const v = parsed.data;
  const { supabase } = await context();
  const { data, error } = await supabase.rpc("generate_chore_roster", {
    p_chore_type: v.choreType,
    p_title: v.title,
    p_start: v.start,
    p_days: v.days,
    p_user_ids: v.userIds,
    p_every_days: v.everyDays,
  });
  if (error) return fail(error);
  refresh();
  return ok({ count: data ?? 0 });
}

export async function setChoreStatus(choreId: string, status: "pending" | "done" | "skipped"): Promise<ActionResult> {
  if (!uuid.safeParse(choreId).success || !["pending", "done", "skipped"].includes(status)) return fail("invalid_input");
  const { supabase } = await context();
  const { data, error } = await supabase.from("chores").update({ status }).eq("id", choreId).select("id");
  if (error) return fail(error);
  if (!data?.length) return fail("not_found");
  refresh();
  return ok(undefined);
}

export async function reassignChore(choreId: string, userId: string): Promise<ActionResult> {
  if (!uuid.safeParse(choreId).success || !uuid.safeParse(userId).success) return fail("invalid_input");
  const { supabase } = await context();
  const { data, error } = await supabase.from("chores").update({ assigned_to: userId }).eq("id", choreId).select("id");
  if (error) return fail(error);
  if (!data?.length) return fail("not_manager");
  refresh();
  return ok(undefined);
}

export async function deleteChore(choreId: string): Promise<ActionResult> {
  if (!uuid.safeParse(choreId).success) return fail("invalid_input");
  const { supabase } = await context();
  const { data, error } = await supabase.from("chores").delete().eq("id", choreId).select("id");
  if (error) return fail(error);
  if (!data?.length) return fail("not_manager");
  refresh();
  return ok(undefined);
}

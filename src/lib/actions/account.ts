"use server";

import { refresh } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { publicPhotoUrl } from "@/lib/links";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { DELETE_WORD, type FeedbackInput, feedbackSchema, type ProfileInput, profileSchema } from "@/lib/validations/account";

// Account settings, leaving a mess, deleting the account, and feedback.

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}

export async function saveProfile(input: ProfileInput): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const v = parsed.data;
  const { supabase, user } = await session();
  if (!user) return fail("not_authenticated");
  const { data, error } = await supabase
    .from("profiles")
    .update({
      full_name: v.fullName,
      phone: v.phone ?? null,
      gender: v.gender,
      occupation: v.occupation,
      institution: v.institution ?? null,
      home_district: v.homeDistrict ?? null,
      blood_group: v.bloodGroup,
      bio: v.bio ?? null,
      guardian_name: v.guardianName ?? null,
      guardian_phone: v.guardianPhone ?? null,
      preferred_locale: v.preferredLocale,
    })
    .eq("id", user.id)
    .select("id");
  if (error) return fail(error);
  if (!data?.length) return fail("not_found");
  refresh();
  return ok(undefined);
}

const AVATAR_PREFIX = "/storage/v1/object/public/avatars/";

/** Point the profile at a freshly uploaded avatar (or remove it) and tidy up the old file. */
export async function setAvatar(path: string | null): Promise<ActionResult> {
  const { supabase, user } = await session();
  if (!user) return fail("not_authenticated");
  if (path && (!path.startsWith(`${user.id}/`) || path.length > 300)) return fail("invalid_photo_path");
  const { data: current } = await supabase.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle();
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: path ? publicPhotoUrl("avatars", path) : null })
    .eq("id", user.id);
  if (error) return fail(error);
  // remove the previous upload (Google avatars live elsewhere and are left alone)
  const old = current?.avatar_url;
  if (old && old.includes(AVATAR_PREFIX)) {
    const oldPath = decodeURIComponent(old.slice(old.indexOf(AVATAR_PREFIX) + AVATAR_PREFIX.length));
    if (oldPath.startsWith(`${user.id}/`) && oldPath !== path) await supabase.storage.from("avatars").remove([oldPath]);
  }
  refresh();
  return ok(undefined);
}

export async function leaveMess(): Promise<ActionResult> {
  const { supabase } = await session();
  const { error } = await supabase.rpc("leave_mess");
  if (error) return fail(error);
  refresh();
  return ok(undefined);
}

/** Every file under {userId}/ in a bucket (folders are walked a few levels deep). */
async function listOwnFiles(supabase: Awaited<ReturnType<typeof createClient>>, bucket: string, prefix: string, depth = 0): Promise<string[]> {
  const { data } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  const paths: string[] = [];
  for (const item of data ?? []) {
    const full = `${prefix}/${item.name}`;
    // folders come back without an id
    if (item.id === null && depth < 3) paths.push(...(await listOwnFiles(supabase, bucket, full, depth + 1)));
    else if (item.id !== null) paths.push(full);
  }
  return paths;
}

/**
 * Delete my account: the database wipes personal and Care data and anonymises
 * the profile (mess money records stay, without the name); then the user's
 * own files are removed, the auth account is closed and the session ends.
 */
export async function deleteAccount(confirmation: string): Promise<ActionResult> {
  if (confirmation.trim().toUpperCase() !== DELETE_WORD) return fail("invalid_input");
  const { supabase, user } = await session();
  if (!user) return fail("not_authenticated");

  const { error } = await supabase.rpc("delete_my_account_data");
  if (error) return fail(error);

  for (const bucket of ["avatars", "listing-photos", "market-photos", "personal"]) {
    const files = await listOwnFiles(supabase, bucket, user.id);
    for (let i = 0; i < files.length; i += 100) await supabase.storage.from(bucket).remove(files.slice(i, i + 100));
  }

  // Soft-delete the auth user so the email can't sign in again (needs the server secret).
  const admin = createAdminClient();
  if (admin) await admin.auth.admin.deleteUser(user.id, true);

  await supabase.auth.signOut();
  return ok(undefined);
}

/** Contact / feedback / bug report; works signed in or not. */
export async function sendFeedback(input: FeedbackInput): Promise<ActionResult> {
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_feedback", {
    p_type: v.type,
    p_message: v.message,
    p_subject: v.subject ?? undefined,
    p_contact_email: v.contactEmail || undefined,
    p_page_url: v.pageUrl || undefined,
  });
  if (error) return fail(error);
  return ok(undefined);
}

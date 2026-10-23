"use server";

import { refresh } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_notifications_read", {});
  if (error) return fail(error);
  refresh();
  return ok(undefined);
}

/** Remove notifications that have already been read (RLS: own rows only). */
export async function clearReadNotifications(): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return fail("not_authenticated");
  const { error } = await supabase.from("notifications").delete().eq("user_id", auth.user.id).not("read_at", "is", null);
  if (error) return fail(error);
  refresh();
  return ok(undefined);
}

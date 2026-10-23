"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { type ReportInput, reportSchema } from "@/lib/validations/community";

// Small actions shared by housing, marketplace and services.

/** Save or un-save a listing (heart button). */
export async function setListingSaved(listingId: string, saved: boolean): Promise<ActionResult> {
  if (!z.uuid().safeParse(listingId).success) return fail("invalid_input");
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return fail("not_authenticated");
  const { error } = saved
    ? await supabase.from("saved_listings").upsert({ user_id: auth.user.id, listing_id: listingId }, { onConflict: "user_id,listing_id" })
    : await supabase.from("saved_listings").delete().eq("listing_id", listingId).eq("user_id", auth.user.id);
  if (error) return fail(error);
  refresh();
  return ok(undefined);
}

const REPORT_PATHS = { listing: "/housing", market: "/market", service: "/services" } as const;

/** "Report this post" goes to the super admin's feedback inbox as type `report`. */
export async function reportContent(input: ReportInput): Promise<ActionResult> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_feedback", {
    p_type: "report",
    p_subject: `${v.kind}: ${v.title}`.slice(0, 120),
    p_message: v.reason,
    p_page_url: `${REPORT_PATHS[v.kind]}/${v.id}`,
  });
  if (error) return fail(error);
  return ok(undefined);
}

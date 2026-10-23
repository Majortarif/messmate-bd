"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { dhakaToday } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import {
  type AlertInput,
  alertSchema,
  type BudgetEntryInput,
  budgetEntrySchema,
  type CheckinInput,
  checkinSchema,
  type ContactInput,
  contactSchema,
  type EventInput,
  eventSchema,
  type JobInput,
  jobSchema,
  type LoanInput,
  type LoanPaymentInput,
  loanPaymentSchema,
  loanSchema,
  MOODS,
  type MonthlyBudgetInput,
  monthlyBudgetSchema,
  type RecipeInput,
  recipeSchema,
  type ReminderInput,
  reminderSchema,
} from "@/lib/validations/care";

// Care actions. Personal data (mood, check-ins, money, reminders, contacts) is
// owner-only by RLS; alerts go through SECURITY DEFINER RPCs.

const uuid = z.uuid();

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, userId: data.user?.id ?? null };
}

/** Finish a write: map errors, treat "no row matched" as not_found, refresh. */
async function done(result: { error: unknown; data?: unknown }) {
  if (result.error) return fail(result.error);
  if (Array.isArray(result.data) && result.data.length === 0) return fail("not_found");
  refresh();
  return ok(undefined);
}

// ------------------------------------------------------------------- alerts --
export type RaisedAlert = { alertId: string; notifiedInApp: number; external: { name: string; phone: string; relation: string | null }[] };

export async function raiseAlert(input: AlertInput): Promise<ActionResult<RaisedAlert>> {
  const parsed = alertSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const v = parsed.data;
  const { supabase } = await session();
  const { data, error } = await supabase.rpc("raise_care_alert", {
    p_type: v.type,
    p_message: v.message ?? undefined,
    p_needs: v.needs,
    p_lat: v.lat ?? undefined,
    p_lng: v.lng ?? undefined,
    p_location_text: v.locationText ?? undefined,
    p_notify_mess: v.notifyMess,
  });
  if (error || !data) return fail(error);
  const r = data as { alert_id: string; notified_in_app: number; external_contacts: RaisedAlert["external"] };
  refresh();
  return ok({ alertId: r.alert_id, notifiedInApp: r.notified_in_app, external: r.external_contacts ?? [] });
}

export async function respondToAlert(alertId: string, response: "on_my_way" | "called" | "acknowledged"): Promise<ActionResult> {
  if (!uuid.safeParse(alertId).success || !["on_my_way", "called", "acknowledged"].includes(response)) return fail("invalid_input");
  const { supabase } = await session();
  return done(await supabase.rpc("respond_care_alert", { p_alert_id: alertId, p_response: response }));
}

export async function resolveAlert(alertId: string): Promise<ActionResult> {
  if (!uuid.safeParse(alertId).success) return fail("invalid_input");
  const { supabase } = await session();
  return done(await supabase.rpc("resolve_care_alert", { p_alert_id: alertId }));
}

// ---------------------------------------------------------- reached home ---
export async function startCheckin(input: CheckinInput): Promise<ActionResult> {
  const parsed = checkinSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const { supabase, userId } = await session();
  if (!userId) return fail("not_authenticated");
  const expectedBy = new Date(Date.now() + parsed.data.minutes * 60_000).toISOString();
  return done(await supabase.from("safety_checkins").insert({ user_id: userId, label: parsed.data.label, expected_by: expectedBy }).select("id"));
}

export async function finishCheckin(checkinId: string, outcome: "arrived" | "cancelled"): Promise<ActionResult> {
  if (!uuid.safeParse(checkinId).success || !["arrived", "cancelled"].includes(outcome)) return fail("invalid_input");
  const { supabase } = await session();
  return done(await supabase.from("safety_checkins").update({ status: outcome }).eq("id", checkinId).select("id"));
}

// ---------------------------------------------------- mood, water, family ---
export async function saveMood(mood: (typeof MOODS)[number], note?: string): Promise<ActionResult> {
  const text = (note ?? "").trim();
  if (!MOODS.includes(mood) || text.length > 300) return fail("invalid_input");
  const { supabase, userId } = await session();
  if (!userId) return fail("not_authenticated");
  return done(
    await supabase
      .from("mood_checkins")
      .upsert({ user_id: userId, checkin_date: dhakaToday(), mood, note: text || null }, { onConflict: "user_id,checkin_date" })
      .select("id"),
  );
}

export async function setWater(glasses: number, goal: number): Promise<ActionResult> {
  if (!Number.isInteger(glasses) || glasses < 0 || glasses > 30 || !Number.isInteger(goal) || goal < 1 || goal > 30) return fail("invalid_input");
  const { supabase, userId } = await session();
  if (!userId) return fail("not_authenticated");
  return done(
    await supabase
      .from("water_logs")
      .upsert({ user_id: userId, log_date: dhakaToday(), glasses, goal, updated_at: new Date().toISOString() }, { onConflict: "user_id,log_date" })
      .select("user_id"),
  );
}

export async function logFamilyCall(person?: string, note?: string): Promise<ActionResult> {
  const p = (person ?? "").trim();
  const n = (note ?? "").trim();
  if (p.length > 60 || n.length > 200) return fail("invalid_input");
  const { supabase, userId } = await session();
  if (!userId) return fail("not_authenticated");
  return done(await supabase.from("family_call_logs").insert({ user_id: userId, person: p || null, note: n || null }).select("id"));
}

// ----------------------------------------------------------------- contacts --
export async function saveContact(input: ContactInput, contactId?: string): Promise<ActionResult> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success || (contactId && !uuid.safeParse(contactId).success)) return fail("invalid_input");
  const v = parsed.data;
  const { supabase, userId } = await session();
  if (!userId) return fail("not_authenticated");
  const row = {
    name: v.name,
    relation: v.relation ?? null,
    phone: v.phone,
    contact_user_id: v.contactUserId,
    is_primary: v.isPrimary,
    notify_on_sos: v.notifyOnSos,
    notify_on_sick: v.notifyOnSick,
    notify_on_checkin: v.notifyOnCheckin,
  };
  // only one primary contact
  if (v.isPrimary) {
    const reset = supabase.from("emergency_contacts").update({ is_primary: false }).eq("user_id", userId);
    await (contactId ? reset.neq("id", contactId) : reset);
  }
  return done(
    contactId
      ? await supabase.from("emergency_contacts").update(row).eq("id", contactId).select("id")
      : await supabase.from("emergency_contacts").insert({ ...row, user_id: userId }).select("id"),
  );
}

export async function deleteContact(contactId: string): Promise<ActionResult> {
  if (!uuid.safeParse(contactId).success) return fail("invalid_input");
  const { supabase } = await session();
  return done(await supabase.from("emergency_contacts").delete().eq("id", contactId).select("id"));
}

// ---------------------------------------------------------------- reminders --
export async function saveReminder(input: ReminderInput, reminderId?: string): Promise<ActionResult> {
  const parsed = reminderSchema.safeParse(input);
  if (!parsed.success || (reminderId && !uuid.safeParse(reminderId).success)) return fail("invalid_input");
  const v = parsed.data;
  const { supabase, userId } = await session();
  if (!userId) return fail("not_authenticated");
  const row = {
    reminder_type: v.type,
    title: v.title,
    note: v.note ?? null,
    remind_at: v.remindAt,
    days_of_week: [...new Set(v.daysOfWeek)].sort(),
    is_active: v.isActive,
    // a changed time may fire again today
    last_sent_on: null,
  };
  return done(
    reminderId
      ? await supabase.from("reminders").update(row).eq("id", reminderId).select("id")
      : await supabase.from("reminders").insert({ ...row, user_id: userId }).select("id"),
  );
}

export async function setReminderActive(reminderId: string, active: boolean): Promise<ActionResult> {
  if (!uuid.safeParse(reminderId).success) return fail("invalid_input");
  const { supabase } = await session();
  return done(await supabase.from("reminders").update({ is_active: active }).eq("id", reminderId).select("id"));
}

export async function deleteReminder(reminderId: string): Promise<ActionResult> {
  if (!uuid.safeParse(reminderId).success) return fail("invalid_input");
  const { supabase } = await session();
  return done(await supabase.from("reminders").delete().eq("id", reminderId).select("id"));
}

// -------------------------------------------------------------------- money --
export async function saveMonthlyBudget(input: MonthlyBudgetInput): Promise<ActionResult> {
  const parsed = monthlyBudgetSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const v = parsed.data;
  const { supabase, userId } = await session();
  if (!userId) return fail("not_authenticated");
  return done(
    await supabase
      .from("monthly_budgets")
      .upsert(
        { user_id: userId, period_month: `${v.month}-01`, limit_amount: v.limitAmount, expected_income: v.expectedIncome ?? null },
        { onConflict: "user_id,period_month" },
      )
      .select("user_id"),
  );
}

export async function addBudgetEntry(input: BudgetEntryInput): Promise<ActionResult> {
  const parsed = budgetEntrySchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const v = parsed.data;
  const { supabase, userId } = await session();
  if (!userId) return fail("not_authenticated");
  return done(
    await supabase
      .from("budget_entries")
      .insert({ user_id: userId, entry_type: v.entryType, category: v.category, amount: v.amount, entry_date: v.entryDate, note: v.note ?? null })
      .select("id"),
  );
}

export async function deleteBudgetEntry(entryId: string): Promise<ActionResult> {
  if (!uuid.safeParse(entryId).success) return fail("invalid_input");
  const { supabase } = await session();
  return done(await supabase.from("budget_entries").delete().eq("id", entryId).select("id"));
}

export async function saveLoan(input: LoanInput, loanId?: string): Promise<ActionResult> {
  const parsed = loanSchema.safeParse(input);
  if (!parsed.success || (loanId && !uuid.safeParse(loanId).success)) return fail("invalid_input");
  const v = parsed.data;
  const { supabase, userId } = await session();
  if (!userId) return fail("not_authenticated");
  const row = {
    direction: v.direction,
    counterparty_name: v.counterpartyName,
    counterparty_phone: v.counterpartyPhone ?? null,
    amount: v.amount,
    due_date: v.dueDate ?? null,
    note: v.note ?? null,
  };
  return done(
    loanId
      ? await supabase.from("loans").update(row).eq("id", loanId).select("id")
      : await supabase.from("loans").insert({ ...row, user_id: userId }).select("id"),
  );
}

export async function deleteLoan(loanId: string): Promise<ActionResult> {
  if (!uuid.safeParse(loanId).success) return fail("invalid_input");
  const { supabase } = await session();
  return done(await supabase.from("loans").delete().eq("id", loanId).select("id"));
}

export async function addLoanPayment(input: LoanPaymentInput): Promise<ActionResult> {
  const parsed = loanPaymentSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const v = parsed.data;
  const { supabase, userId } = await session();
  if (!userId) return fail("not_authenticated");
  return done(
    await supabase
      .from("loan_payments")
      .insert({ loan_id: v.loanId, user_id: userId, amount: v.amount, paid_on: v.paidOn, note: v.note ?? null })
      .select("id"),
  );
}

export async function deleteLoanPayment(paymentId: string): Promise<ActionResult> {
  if (!uuid.safeParse(paymentId).success) return fail("invalid_input");
  const { supabase } = await session();
  return done(await supabase.from("loan_payments").delete().eq("id", paymentId).select("id"));
}

// -------------------------------------------------- recipes, events, jobs ---
export async function submitRecipe(input: RecipeInput): Promise<ActionResult> {
  const parsed = recipeSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const v = parsed.data;
  const { supabase } = await session();
  return done(
    await supabase
      .from("recipes")
      .insert({
        title_bn: v.titleBn,
        title_en: v.titleEn ?? null,
        description: v.description ?? null,
        ingredients: v.ingredients,
        steps: v.steps,
        equipment: v.equipment,
        cook_minutes: v.cookMinutes ?? null,
        servings: v.servings,
        cost_estimate: v.costEstimate ?? null,
        is_sick_friendly: v.isSickFriendly,
      })
      .select("id"),
  );
}

export async function saveEvent(input: EventInput, eventId?: string): Promise<ActionResult> {
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success || (eventId && !uuid.safeParse(eventId).success)) return fail("invalid_input");
  const v = parsed.data;
  const { supabase, userId } = await session();
  if (!userId) return fail("not_authenticated");
  const row = {
    event_type: v.eventType,
    title: v.title,
    description: v.description ?? null,
    area_id: v.areaId ?? null,
    venue: v.venue ?? null,
    starts_at: `${v.startsAt}:00+06:00`,
    ends_at: v.endsAt ? `${v.endsAt}:00+06:00` : null,
    max_people: v.maxPeople ?? null,
    contact_phone: v.contactPhone ?? null,
  };
  return done(
    eventId
      ? await supabase.from("community_events").update(row).eq("id", eventId).select("id")
      : await supabase.from("community_events").insert({ ...row, organizer_id: userId }).select("id"),
  );
}

export async function setRsvp(eventId: string, going: boolean): Promise<ActionResult> {
  if (!uuid.safeParse(eventId).success) return fail("invalid_input");
  const { supabase, userId } = await session();
  if (!userId) return fail("not_authenticated");
  const result = going
    ? await supabase.from("event_rsvps").insert({ event_id: eventId, user_id: userId }).select("event_id")
    : await supabase.from("event_rsvps").delete().eq("event_id", eventId).eq("user_id", userId).select("event_id");
  if (result.error) return fail(result.error);
  refresh();
  return ok(undefined);
}

export async function archiveEvent(eventId: string): Promise<ActionResult> {
  if (!uuid.safeParse(eventId).success) return fail("invalid_input");
  const { supabase } = await session();
  return done(await supabase.from("community_events").update({ status: "archived" }).eq("id", eventId).select("id"));
}

export async function saveJob(input: JobInput, jobId?: string): Promise<ActionResult> {
  const parsed = jobSchema.safeParse(input);
  if (!parsed.success || (jobId && !uuid.safeParse(jobId).success)) return fail("invalid_input");
  const v = parsed.data;
  const { supabase, userId } = await session();
  if (!userId) return fail("not_authenticated");
  const row = {
    job_type: v.jobType,
    title: v.title,
    description: v.description,
    area_id: v.areaId ?? null,
    salary_text: v.salaryText ?? null,
    schedule_text: v.scheduleText ?? null,
    contact_phone: v.contactPhone,
    expires_at: v.expiresAt ?? null,
  };
  return done(
    jobId
      ? await supabase.from("job_posts").update(row).eq("id", jobId).select("id")
      : await supabase.from("job_posts").insert({ ...row, posted_by: userId }).select("id"),
  );
}

export async function setJobStatus(jobId: string, status: "open" | "closed"): Promise<ActionResult> {
  if (!uuid.safeParse(jobId).success || !["open", "closed"].includes(status)) return fail("invalid_input");
  const { supabase } = await session();
  return done(await supabase.from("job_posts").update({ status }).eq("id", jobId).select("id"));
}

export async function deleteJob(jobId: string): Promise<ActionResult> {
  if (!uuid.safeParse(jobId).success) return fail("invalid_input");
  const { supabase } = await session();
  return done(await supabase.from("job_posts").delete().eq("id", jobId).select("id"));
}

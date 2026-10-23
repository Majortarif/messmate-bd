import { BellRing, Droplet, Moon, Phone, Pill, ReceiptText, StickyNote } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { CareNav } from "@/components/care/care-nav";
import { AddReminderButton, ReminderControls, WEEK_ORDER } from "@/components/care/reminders";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { requireOnboarded } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { ReminderInput } from "@/lib/validations/care";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("care.reminders");
  return { title: t("title") };
}

const ICONS = { medicine: Pill, water: Droplet, sleep: Moon, call_home: Phone, rent: ReceiptText, bill: ReceiptText, custom: StickyNote };

/** "21:30:00" -> localised clock time. */
function clock(time: string, locale: string) {
  const [h, m] = time.split(":").map(Number);
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-IN", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(new Date(Date.UTC(2000, 0, 1, h, m)));
}

export default async function RemindersPage() {
  await requireOnboarded();
  const supabase = await createClient();
  const [{ data, error }, t, tt, td, locale] = await Promise.all([
    supabase.from("reminders").select("*").order("remind_at"),
    getTranslations("care.reminders"),
    getTranslations("care.reminders.types"),
    getTranslations("weekdays"),
    getLocale(),
  ]);
  if (error) throw new Error(error.message);
  const reminders = data ?? [];

  return (
    <div className="grid gap-5">
      <PageHeader title={t("title")} description={t("subtitle")} actions={<AddReminderButton />} />
      <CareNav active="reminders" />
      {reminders.length === 0 ? (
        <EmptyState icon={BellRing} title={t("empty")} body={t("emptyBody")} action={<AddReminderButton />} className="rounded-2xl border bg-card py-12" />
      ) : (
        <ul className="grid gap-2">
          {reminders.map((r) => {
            const Icon = ICONS[r.reminder_type];
            const everyDay = r.days_of_week.length === 7;
            const initial: ReminderInput = {
              type: r.reminder_type,
              title: r.title,
              note: r.note ?? "",
              remindAt: r.remind_at.slice(0, 5),
              daysOfWeek: r.days_of_week,
              isActive: r.is_active,
            };
            return (
              <li key={r.id} className={cn("flex items-center gap-3 rounded-2xl border bg-card px-4 py-3", !r.is_active && "opacity-60")}>
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-soft text-sky">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.title}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    <span className="num">{clock(r.remind_at, locale)}</span> ·{" "}
                    {everyDay
                      ? t("everyDay")
                      : WEEK_ORDER.filter((d) => r.days_of_week.includes(d))
                          .map((d) => td(`short.${d}`))
                          .join(" ")}
                    {r.reminder_type !== "custom" && r.title !== tt(r.reminder_type) && ` · ${tt(r.reminder_type)}`}
                  </p>
                </div>
                <ReminderControls id={r.id} title={r.title} active={r.is_active} initial={initial} />
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">{t("howItWorks")}</p>
    </div>
  );
}

import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { MealPlanner, type MealCell } from "@/components/meals/meal-planner";
import { PageHeader } from "@/components/shared/states";
import { requireMember } from "@/lib/dal";
import { dhakaToday, formatDate, formatNumber, formatTaka } from "@/lib/format";
import { currentMonth, dayRange, shiftMonth } from "@/lib/month";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { MemberDashboard } from "@/types/app";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("meals") };
}

const SLOTS = ["breakfast", "lunch", "dinner"] as const;

export default async function MealsPage() {
  const member = await requireMember();
  const messId = member.membership.mess_id;
  const today = dhakaToday();
  const days = dayRange(today, 7);
  const month = currentMonth();
  const supabase = await createClient();

  const [menusRes, settingsRes, historyRes, dashboardRes, t, locale] = await Promise.all([
    supabase
      .from("menus")
      .select("id, menu_date, slot, items, price, cutoff_at, is_locked, meal_orders(status, guest_count, user_id)")
      .eq("mess_id", messId)
      .eq("meal_orders.user_id", member.id)
      .gte("menu_date", days[0])
      .lte("menu_date", days[days.length - 1])
      .order("menu_date")
      .order("slot"),
    supabase
      .from("mess_settings")
      .select("meal_rate_mode, guest_meal_allowed, max_guests_per_meal")
      .eq("mess_id", messId)
      .single(),
    supabase
      .from("menus")
      .select("menu_date, slot, meal_orders!inner(status, guest_count, user_id)")
      .eq("mess_id", messId)
      .eq("meal_orders.user_id", member.id)
      .eq("meal_orders.status", "ordered")
      .gte("menu_date", month)
      .lt("menu_date", shiftMonth(month, 1))
      .order("menu_date"),
    supabase.rpc("get_member_dashboard"),
    getTranslations("meals"),
    getLocale(),
  ]);

  const cells: MealCell[] = (menusRes.data ?? []).map((m) => {
    const order = m.meal_orders[0];
    return {
      id: m.id,
      date: m.menu_date,
      slot: m.slot,
      items: m.items,
      price: Number(m.price ?? 0),
      cutoffAt: m.cutoff_at ?? `${m.menu_date}T00:00:00Z`,
      locked: m.is_locked,
      ordered: order?.status === "ordered",
      guests: order?.status === "ordered" ? order.guest_count : 0,
    };
  });

  const settings = settingsRes.data;
  const meals = (dashboardRes.data as unknown as MemberDashboard | null)?.meals;

  // month history: date → which slots I ate (+ guests)
  const history = new Map<string, Record<string, number>>();
  for (const row of historyRes.data ?? []) {
    const entry = history.get(row.menu_date) ?? {};
    entry[row.slot] = 1 + (row.meal_orders[0]?.guest_count ?? 0);
    history.set(row.menu_date, entry);
  }
  const historyDays = [...history.keys()].sort().reverse();

  return (
    <div className="grid gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {meals && (
        <dl className="grid grid-cols-3 gap-3">
          {[
            { label: t("summary.myMeals"), value: formatNumber(meals.my_units, locale, 1) },
            { label: meals.is_estimate ? t("summary.costEstimate") : t("summary.cost"), value: formatTaka(meals.my_meal_cost, locale) },
            { label: t("summary.rate"), value: formatTaka(meals.meal_rate, locale) },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border bg-card px-3 py-3 sm:px-4">
              <dt className="text-[11px] text-muted-foreground sm:text-xs">{s.label}</dt>
              <dd className="num mt-0.5 text-lg font-bold sm:text-xl">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <MealPlanner
        days={days}
        cells={cells}
        serverNow={new Date().toISOString()}
        settings={{
          mode: settings?.meal_rate_mode ?? "auto",
          guestsAllowed: settings?.guest_meal_allowed ?? true,
          maxGuests: settings?.max_guests_per_meal ?? 3,
        }}
      />

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="mb-4 flex items-center gap-2 font-semibold">
          <CalendarDays className="size-[18px] text-muted-foreground" aria-hidden="true" />
          {t("history.title", { month: formatDate(month, locale, { month: "long" }) })}
        </h2>
        {historyDays.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("history.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">{t("history.date")}</th>
                  {SLOTS.map((s) => (
                    <th key={s} className="px-2 py-2 text-center font-medium">
                      {t(`history.short.${s}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historyDays.map((day) => {
                  const entry = history.get(day)!;
                  return (
                    <tr key={day} className={cn("border-b last:border-0", day === today && "bg-mint-soft")}>
                      <td className="py-2 pr-3">{formatDate(day, locale, { weekday: "short", day: "numeric", month: "short" })}</td>
                      {SLOTS.map((s) => (
                        <td key={s} className="num px-2 py-2 text-center">
                          {entry[s] ? (
                            <span className="inline-flex size-6 items-center justify-center rounded-full bg-marigold-soft text-xs font-semibold text-marigold">
                              {formatNumber(entry[s], locale)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">–</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

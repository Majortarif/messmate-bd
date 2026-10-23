import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MealSettingsForm, MessInfoForm, PaymentForm } from "@/components/manage/settings-forms";
import { PageHeader } from "@/components/shared/states";
import { requireManager } from "@/lib/dal";
import { shiftMonth } from "@/lib/month";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("manage.settings");
  return { title: t("title") };
}

const hhmm = (time: string) => time.slice(0, 5);

export default async function MessSettingsPage() {
  const manager = await requireManager();
  const messId = manager.membership.mess_id;
  const supabase = await createClient();

  const [messRes, settingsRes, areasRes, lastClosingRes, t] = await Promise.all([
    supabase.from("messes").select("name, area_id, address, building_name, description, gender_policy").eq("id", messId).single(),
    supabase.from("mess_settings").select("*").eq("mess_id", messId).single(),
    supabase.from("areas").select("id, name_bn, name_en").order("sort_order"),
    supabase.from("monthly_closings").select("period_month").eq("mess_id", messId).order("period_month", { ascending: false }).limit(1).maybeSingle(),
    getTranslations("manage.settings"),
  ]);
  if (messRes.error || settingsRes.error) throw new Error(messRes.error?.message ?? settingsRes.error?.message);
  const mess = messRes.data;
  const s = settingsRes.data;

  // The meal-rate mode can't change while an open month has orders (migration 0015).
  const firstOpenDay = lastClosingRes.data ? shiftMonth(lastClosingRes.data.period_month, 1) : "1900-01-01";
  const { count: openOrders } = await supabase
    .from("meal_orders")
    .select("id, menus!inner(menu_date)", { count: "exact", head: true })
    .eq("mess_id", messId)
    .eq("status", "ordered")
    .gte("menus.menu_date", firstOpenDay);
  const modeLocked = (openOrders ?? 0) > 0;

  return (
    <div className="grid gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <PaymentForm
        messId={messId}
        initial={{ bkash: s.bkash_number ?? "", nagad: s.nagad_number ?? "", rocket: s.rocket_number ?? "", note: s.payment_note ?? "" }}
      />
      <MealSettingsForm
        messId={messId}
        modeLocked={modeLocked}
        initial={{
          mealRateMode: s.meal_rate_mode,
          breakfastPrice: s.breakfast_price,
          lunchPrice: s.lunch_price,
          dinnerPrice: s.dinner_price,
          breakfastWeight: s.breakfast_weight,
          lunchWeight: s.lunch_weight,
          dinnerWeight: s.dinner_weight,
          breakfastCutoff: hhmm(s.breakfast_cutoff),
          breakfastPrevDay: s.breakfast_cutoff_prev_day,
          lunchCutoff: hhmm(s.lunch_cutoff),
          lunchPrevDay: s.lunch_cutoff_prev_day,
          dinnerCutoff: hhmm(s.dinner_cutoff),
          dinnerPrevDay: s.dinner_cutoff_prev_day,
          guestMealAllowed: s.guest_meal_allowed,
          maxGuests: s.max_guests_per_meal,
          creditLimit: s.credit_limit,
          lowBalanceThreshold: s.low_balance_threshold,
          splitSharedExpenses: s.split_shared_expenses,
          autoCloseEnabled: s.auto_close_enabled,
          autoCloseDay: s.auto_close_day,
        }}
      />
      <MessInfoForm
        messId={messId}
        areas={areasRes.data ?? []}
        initial={{
          name: mess.name,
          areaId: mess.area_id ?? 0,
          address: mess.address ?? "",
          buildingName: mess.building_name ?? "",
          description: mess.description ?? "",
          genderPolicy: mess.gender_policy,
        }}
      />
    </div>
  );
}

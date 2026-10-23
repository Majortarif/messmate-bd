import { CalendarCheck, Download, FileWarning } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { CloseMonthButton } from "@/components/manage/close-month";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { requireManager } from "@/lib/dal";
import { formatDate, formatNumber, formatTaka } from "@/lib/format";
import { currentMonth, monthParam, shiftMonth } from "@/lib/month";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("manage.closing");
  return { title: t("title") };
}

type ManagerTotals = {
  totals: { meal_units: number; meal_expense: number; meal_rate: number; shared_expense: number; bills_posted: number };
  balances: { user_id: string; full_name: string }[];
};

export default async function ClosingPage() {
  const manager = await requireManager();
  const messId = manager.membership.mess_id;
  const supabase = await createClient();
  const previous = shiftMonth(currentMonth(), -1);

  const [closingsRes, settingsRes, previewRes, draftsRes, t, locale] = await Promise.all([
    supabase.from("monthly_closings").select("*").eq("mess_id", messId).order("period_month", { ascending: false }).limit(12),
    supabase.from("mess_settings").select("auto_close_enabled, auto_close_day, meal_rate_mode").eq("mess_id", messId).single(),
    supabase.rpc("get_manager_dashboard", { p_month: previous }),
    supabase.from("bills").select("id", { count: "exact", head: true }).eq("mess_id", messId).eq("period_month", previous).eq("status", "draft"),
    getTranslations("manage.closing"),
    getLocale(),
  ]);

  const closings = closingsRes.data ?? [];
  const previousClosed = closings.some((c) => c.period_month === previous);
  const preview = (previewRes.data as unknown as ManagerTotals | null)?.totals;
  const settings = settingsRes.data;
  const prevLabel = formatDate(previous, locale, { month: "long", year: "numeric" });

  // statements of the most recent closing, for a quick look
  const latest = closings[0];
  const statements = latest
    ? (
        await supabase
          .from("member_statements")
          .select("user_id, meal_units, meal_cost, bill_cost, deposits, closing_balance, member:profiles!member_statements_user_id_fkey(full_name)")
          .eq("closing_id", latest.id)
          .order("closing_balance")
      ).data ?? []
    : [];

  return (
    <div className="grid gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {!previousClosed && (
        <section className="rounded-3xl border border-marigold/30 bg-marigold-soft p-5 sm:p-6">
          <h2 className="text-lg font-semibold">{t("readyTitle", { month: prevLabel })}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {settings?.auto_close_enabled
              ? t("autoNote", { day: formatNumber(settings.auto_close_day, locale) })
              : t("manualNote")}
          </p>
          {preview && (
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: t("preview.units"), value: formatNumber(preview.meal_units, locale, 1) },
                { label: t("preview.bazar"), value: formatTaka(preview.meal_expense, locale) },
                { label: settings?.meal_rate_mode === "fixed" ? t("preview.rateInfo") : t("preview.rate"), value: formatTaka(preview.meal_rate, locale) },
                { label: t("preview.shared"), value: formatTaka(preview.shared_expense, locale) },
              ].map((s) => (
                <div key={s.label} className="rounded-xl bg-background/60 px-3 py-2.5">
                  <dt className="text-xs text-muted-foreground">{s.label}</dt>
                  <dd className="num mt-0.5 font-semibold">{s.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {(draftsRes.count ?? 0) > 0 && (
            <p className="mt-3 flex items-center gap-2 text-sm text-coral">
              <FileWarning className="size-4" aria-hidden="true" />
              {t("draftWarning", { count: formatNumber(draftsRes.count ?? 0, locale) })}
            </p>
          )}
          <ul className="mt-4 grid gap-1 text-xs text-muted-foreground">
            <li>• {t("effects.meal")}</li>
            <li>• {t("effects.shared")}</li>
            <li>• {t("effects.lock")}</li>
          </ul>
          <div className="mt-5">
            <CloseMonthButton messId={messId} month={previous} monthLabel={prevLabel} />
          </div>
        </section>
      )}

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <CalendarCheck className="size-[18px] text-muted-foreground" aria-hidden="true" />
          {t("history")}
        </h2>
        {closings.length === 0 ? (
          <EmptyState icon={CalendarCheck} title={t("historyEmpty")} className="py-4" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">{t("table.month")}</th>
                  <th className="px-2 py-2 text-right font-medium">{t("table.units")}</th>
                  <th className="px-2 py-2 text-right font-medium">{t("table.bazar")}</th>
                  <th className="px-2 py-2 text-right font-medium">{t("table.rate")}</th>
                  <th className="px-2 py-2 text-right font-medium">{t("table.deposits")}</th>
                  <th className="py-2 pl-2 text-right font-medium">CSV</th>
                </tr>
              </thead>
              <tbody>
                {closings.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-2.5 pr-3 font-medium">{formatDate(c.period_month, locale, { month: "long", year: "numeric" })}</td>
                    <td className="num px-2 py-2.5 text-right">{formatNumber(c.total_meal_units, locale, 1)}</td>
                    <td className="num px-2 py-2.5 text-right">{formatTaka(c.total_meal_expense, locale)}</td>
                    <td className="num px-2 py-2.5 text-right">{formatTaka(c.meal_rate, locale)}</td>
                    <td className="num px-2 py-2.5 text-right">{formatTaka(c.total_deposits, locale)}</td>
                    <td className="py-1.5 pl-2 text-right">
                      <Button asChild variant="ghost" size="icon-sm" aria-label={t("csv")}>
                        <a href={`/api/export/statements?month=${monthParam(c.period_month)}&locale=${locale}`} download>
                          <Download className="size-4" />
                        </a>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {latest && statements.length > 0 && (
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="mb-3 font-semibold">{t("latestStatements", { month: formatDate(latest.period_month, locale, { month: "long" }) })}</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">{t("table.member")}</th>
                  <th className="px-2 py-2 text-right font-medium">{t("table.units")}</th>
                  <th className="px-2 py-2 text-right font-medium">{t("table.mealCost")}</th>
                  <th className="px-2 py-2 text-right font-medium">{t("table.bills")}</th>
                  <th className="py-2 pl-2 text-right font-medium">{t("table.closing")}</th>
                </tr>
              </thead>
              <tbody>
                {statements.map((s) => (
                  <tr key={s.user_id} className="border-b last:border-0">
                    <td className="py-2.5 pr-3">{s.member?.full_name}</td>
                    <td className="num px-2 py-2.5 text-right">{formatNumber(s.meal_units, locale, 1)}</td>
                    <td className="num px-2 py-2.5 text-right">{formatTaka(s.meal_cost, locale)}</td>
                    <td className="num px-2 py-2.5 text-right">{formatTaka(s.bill_cost, locale)}</td>
                    <td className={cn("num py-2.5 pl-2 text-right font-semibold", Number(s.closing_balance) < 0 ? "text-coral" : "text-mint")}>
                      {formatTaka(s.closing_balance, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

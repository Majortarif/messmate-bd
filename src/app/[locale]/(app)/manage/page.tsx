import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  type LucideIcon,
  Phone,
  Receipt,
  Scale,
  UserPlus,
  Users,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { BalanceChart, DailyMealsChart, MoneyTrendChart, RankedBarChart } from "@/components/charts/viz";
import { MonthNav } from "@/components/shared/month-nav";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { Link } from "@/i18n/navigation";
import { requireManager } from "@/lib/dal";
import { formatNumber, formatTaka, initials } from "@/lib/format";
import { parseMonth } from "@/lib/month";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { ManagerDashboard } from "@/types/app";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("manage.overview");
  return { title: t("title") };
}

/** Short label for chart axes: first two words, at most 16 characters. */
function shortName(name: string) {
  const short = name.split(/\s+/).slice(0, 2).join(" ");
  return short.length > 16 ? `${short.slice(0, 15)}…` : short || "—";
}

export default async function ManageOverviewPage({ searchParams }: PageProps<"/[locale]/manage">) {
  const manager = await requireManager();
  const month = parseMonth((await searchParams).month);
  const supabase = await createClient();
  const [result, t, tc, locale] = await Promise.all([
    supabase.rpc("get_manager_dashboard", { p_month: month }),
    getTranslations("manage.overview"),
    getTranslations("expenseCategories"),
    getLocale(),
  ]);
  if (result.error) throw new Error(result.error.message);
  const d = result.data as unknown as ManagerDashboard;

  const defaulterIds = d.top_defaulters.map((m) => m.user_id);
  const phones = new Map(
    defaulterIds.length > 0
      ? ((await supabase.from("profiles").select("id, phone").in("id", defaulterIds)).data ?? []).map((p) => [p.id, p.phone])
      : [],
  );

  const inDue = d.balances.filter((b) => Number(b.balance) < 0).length;
  const queue = [
    { count: d.counts.pending_deposits, label: t("queue.deposits", { count: d.counts.pending_deposits }), href: "/manage/approvals", icon: BadgeCheck },
    { count: d.counts.pending_requests, label: t("queue.requests", { count: d.counts.pending_requests }), href: "/manage/members", icon: UserPlus },
    { count: d.counts.draft_bills, label: t("queue.drafts", { count: d.counts.draft_bills }), href: "/manage/bills", icon: Receipt },
  ].filter((q) => q.count > 0);

  const rateNote = d.month_closed ? t("rate.final") : d.meal_rate_mode === "auto" ? t("rate.estimate") : t("rate.fixed");

  return (
    <div className="grid gap-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle", { mess: manager.membership.mess_name })}
        actions={<MonthNav month={month} path="/manage" />}
      />

      {queue.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label={t("queue.label")}>
          {queue.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group inline-flex min-h-11 items-center gap-2 rounded-xl border border-marigold/30 bg-marigold-soft px-3.5 text-sm transition-colors hover:border-marigold/60"
            >
              <Icon className="size-4 text-marigold" aria-hidden="true" />
              {label}
              <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile
          icon={Users}
          label={t("kpi.members")}
          value={formatNumber(d.counts.active_members, locale)}
          note={d.counts.inactive_members > 0 ? t("kpi.inactive", { count: formatNumber(d.counts.inactive_members, locale) }) : t("kpi.allActive")}
        />
        <StatTile
          icon={UtensilsCrossed}
          label={t("kpi.meals")}
          value={formatNumber(d.totals.meal_units, locale)}
          note={t("kpi.mealCost", { amount: formatTaka(d.totals.meal_expense, locale) })}
        />
        <StatTile icon={Scale} label={t("kpi.rate")} value={formatTaka(d.totals.meal_rate, locale)} note={rateNote} />
        <StatTile
          icon={Wallet}
          label={t("kpi.collected")}
          value={formatTaka(d.collection.deposits, locale)}
          note={
            Number(d.collection.pending_amount) > 0
              ? t("kpi.pendingAmount", { amount: formatTaka(d.collection.pending_amount, locale) })
              : t("kpi.noPending")
          }
        />
        <StatTile
          icon={Receipt}
          label={t("kpi.due")}
          value={formatTaka(d.collection.total_due, locale)}
          valueClassName={Number(d.collection.total_due) > 0 ? "text-coral" : undefined}
          note={inDue > 0 ? t("kpi.dueMembers", { count: formatNumber(inDue, locale) }) : t("kpi.noDue")}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <DailyMealsChart data={d.daily_meals} title={t("charts.daily")} description={t("charts.dailyBody")} />

      <div className="grid gap-4 lg:grid-cols-2">
        <MoneyTrendChart
          data={d.trend.map((m) => ({
            month: m.month,
            collected: Number(m.deposits),
            spent: Number(m.expenses) + Number(m.bills),
          }))}
          title={t("charts.money")}
          description={t("charts.moneyBody")}
        />
        {d.expense_breakdown.length > 0 ? (
          <RankedBarChart
            money
            title={t("charts.expenses")}
            description={t("charts.expensesBody", { total: formatTaka(d.totals.meal_expense + d.totals.shared_expense, locale) })}
            columnLabel={t("charts.amount")}
            data={d.expense_breakdown.map((e) => ({ key: e.category, label: tc(e.category), value: Number(e.amount) }))}
          />
        ) : (
          <section className="rounded-2xl border bg-card p-5">
            <h2 className="font-semibold">{t("charts.expenses")}</h2>
            <EmptyState icon={Receipt} title={t("charts.noExpenses")} body={t("charts.noExpensesBody")} />
          </section>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        {d.balances.length > 0 ? (
          <BalanceChart
            title={t("charts.balances")}
            description={t("charts.balancesBody", {
              due: formatTaka(d.collection.total_due, locale),
              advance: formatTaka(d.collection.total_advance, locale),
            })}
            data={[...d.balances]
              .sort((a, b) => Number(b.balance) - Number(a.balance))
              .map((b) => ({ id: b.user_id, name: shortName(b.full_name), balance: Number(b.balance) }))}
          />
        ) : (
          <section className="rounded-2xl border bg-card p-5">
            <EmptyState icon={Users} title={t("charts.noMembers")} />
          </section>
        )}

        <section className="rounded-2xl border bg-card p-4 sm:p-5">
          <h2 className="font-semibold">{t("defaulters.title")}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("defaulters.body")}</p>
          {d.top_defaulters.length === 0 ? (
            <EmptyState icon={CheckCircle2} title={t("defaulters.none")} body={t("defaulters.noneBody")} className="py-6" />
          ) : (
            <ol className="mt-4 grid gap-2">
              {d.top_defaulters.map((m) => {
                const phone = phones.get(m.user_id);
                return (
                  <li key={m.user_id} className="flex items-center gap-3 rounded-xl border px-3 py-2.5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-coral-soft text-sm font-semibold text-coral">
                      {initials(m.full_name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{m.full_name || "—"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {m.room_label ? t("defaulters.room", { room: m.room_label }) : t("defaulters.noRoom")}
                      </p>
                    </div>
                    <span className="num shrink-0 font-semibold text-coral">{formatTaka(m.balance, locale)}</span>
                    {phone && (
                      <a
                        href={`tel:${phone}`}
                        className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                        aria-label={t("defaulters.call", { name: m.full_name })}
                      >
                        <Phone className="size-4" />
                      </a>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          <Link href="/manage/reports" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            {t("defaulters.fullReport")}
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </section>
      </div>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  note,
  valueClassName,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  note: ReactNode;
  valueClassName?: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 rounded-2xl border bg-card p-4", className)}>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </p>
      <p className={cn("mt-1.5 truncate text-2xl font-semibold", valueClassName)}>{value}</p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

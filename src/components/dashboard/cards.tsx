import {
  ArrowRight,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  Megaphone,
  Moon,
  Pin,
  ReceiptText,
  ShoppingBasket,
  Sun,
  Sunrise,
  TriangleAlert,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { formatDate, formatNumber, formatTaka, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MemberDashboard, UpcomingMenu } from "@/types/app";

function Card({ title, icon: Icon, action, children, className }: {
  title: ReactNode;
  icon: typeof Wallet;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border bg-card p-5", className)}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <Icon className="size-[18px] text-muted-foreground" aria-hidden="true" />
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function WalletCard({ data }: { data: MemberDashboard }) {
  const t = useTranslations("dashboard.wallet");
  const locale = useLocale();
  const { wallet, meals, settings } = data;
  const used = wallet.total_deposits > 0 ? Math.min(100, Math.max(0, (wallet.total_spent / wallet.total_deposits) * 100)) : 0;
  const negative = wallet.balance < 0;

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border p-5 sm:p-6",
        negative ? "border-coral/30 bg-coral-soft" : "border-primary/25 bg-mint-soft",
      )}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/10 blur-2xl" aria-hidden="true" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Wallet className="size-4" aria-hidden="true" />
            {t("title")}
          </p>
          <p className={cn("num mt-1 text-4xl font-bold tracking-tight", negative ? "text-coral" : "text-mint")}>
            {formatTaka(wallet.balance, locale)}
          </p>
        </div>
        {wallet.is_low && (
          <Badge className="gap-1 bg-coral text-white">
            <TriangleAlert className="size-3" aria-hidden="true" />
            {t("low")}
          </Badge>
        )}
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-background/50 px-3 py-2">
          <p className="text-xs text-muted-foreground">{t("deposits")}</p>
          <p className="num font-semibold">{formatTaka(wallet.total_deposits, locale)}</p>
        </div>
        <div className="rounded-xl bg-background/50 px-3 py-2">
          <p className="text-xs text-muted-foreground">{t("spent")}</p>
          <p className="num font-semibold">{formatTaka(wallet.total_spent, locale)}</p>
        </div>
      </div>
      <div
        className="relative mt-3 h-2 overflow-hidden rounded-full bg-background/60"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(used)}
        aria-label={t("usedLabel")}
      >
        <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${used}%` }} />
      </div>

      <div className="relative mt-3 grid gap-1 text-xs text-muted-foreground">
        {meals.is_estimate && settings.meal_rate_mode === "auto" && (
          <p>{t("estimated", { amount: formatTaka(wallet.estimated_balance, locale) })}</p>
        )}
        {wallet.pending_count > 0 && <p>{t("pending", { amount: formatTaka(wallet.pending_amount, locale) })}</p>}
      </div>
      <div className="relative mt-4 flex flex-wrap gap-2">
        <Button asChild size="sm">
          <Link href="/wallet?add=1">{t("addMoney")}</Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="bg-background/40">
          <Link href="/wallet">{t("history")}</Link>
        </Button>
      </div>
    </section>
  );
}

export function MonthCard({ data }: { data: MemberDashboard }) {
  const t = useTranslations("dashboard.month");
  const locale = useLocale();
  const { meals } = data;
  const stats = [
    { label: t("myMeals"), value: formatNumber(meals.my_units, locale, 1) },
    { label: t("mealCost"), value: formatTaka(meals.my_meal_cost, locale) },
    { label: t("mealRate"), value: formatTaka(meals.meal_rate, locale) },
    { label: t("messMeals"), value: formatNumber(meals.mess_total_units, locale, 1) },
  ];
  return (
    <Card
      title={t("title", { month: formatDate(data.month, locale, { month: "long" }) })}
      icon={CalendarClock}
      action={
        <Badge variant={meals.is_estimate ? "secondary" : "default"} className="font-normal">
          {meals.is_estimate ? t("estimate") : t("final")}
        </Badge>
      }
    >
      <dl className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-muted/60 px-3 py-2.5">
            <dt className="text-xs text-muted-foreground">{s.label}</dt>
            <dd className="num mt-0.5 text-lg font-semibold">{s.value}</dd>
          </div>
        ))}
      </dl>
      {meals.is_estimate && <p className="mt-3 text-xs text-muted-foreground">{t("estimateHelp")}</p>}
    </Card>
  );
}

const SLOT_ICON = { breakfast: Sunrise, lunch: Sun, dinner: Moon } as const;

function MealRow({ menu }: { menu: UpcomingMenu }) {
  const t = useTranslations("dashboard.meals");
  const ts = useTranslations("slots");
  const locale = useLocale();
  const Icon = SLOT_ICON[menu.slot];
  const status = menu.my_status === "ordered" ? "ordered" : menu.my_status === "cancelled" ? "cancelled" : "notOrdered";
  return (
    <li className="flex items-center gap-3 py-3">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          status === "ordered" ? "bg-marigold-soft text-marigold" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {ts(menu.slot)}
          <span className="num ml-2 text-xs font-normal text-muted-foreground">{formatTaka(menu.price, locale)}</span>
        </p>
        <p className="truncate text-xs text-muted-foreground">{menu.items}</p>
      </div>
      <div className="grid justify-items-end gap-1 text-right">
        <Badge
          variant="outline"
          className={cn(
            "font-normal",
            status === "ordered" && "border-marigold/40 bg-marigold-soft text-marigold",
            status === "notOrdered" && "border-dashed",
          )}
        >
          {t(status)}
          {menu.my_guests > 0 && ` · ${t("guests", { count: menu.my_guests })}`}
        </Badge>
        <span className="text-[11px] text-muted-foreground">
          {menu.is_open ? t("openUntil", { time: formatTime(menu.cutoff_at, locale) }) : t("closed")}
        </span>
      </div>
    </li>
  );
}

export function MealsCard({ data }: { data: MemberDashboard }) {
  const t = useTranslations("dashboard.meals");
  const locale = useLocale();
  const days = [...new Set(data.upcoming_menus.map((m) => m.date))];
  return (
    <Card
      title={t("title")}
      icon={UtensilsCrossed}
      action={
        <Button asChild variant="ghost" size="sm" className="text-primary">
          <Link href="/meals">
            {t("manage")}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      }
    >
      {days.length === 0 ? (
        <EmptyState icon={UtensilsCrossed} title={t("empty")} body={t("emptyBody")} className="py-4" />
      ) : (
        <div className="grid gap-4">
          {days.map((day) => (
            <div key={day}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {day === data.today ? t("today") : t("tomorrow")} · {formatDate(day, locale, { weekday: "long", day: "numeric", month: "short" })}
              </p>
              <ul className="divide-y">
                {data.upcoming_menus
                  .filter((m) => m.date === day)
                  .map((m) => (
                    <MealRow key={m.menu_id} menu={m} />
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function NoticesCard({ data }: { data: MemberDashboard }) {
  const t = useTranslations("dashboard.notices");
  const locale = useLocale();
  return (
    <Card
      title={t("title")}
      icon={Megaphone}
      action={
        <Button asChild size="sm" variant="ghost" className="-mr-2">
          <Link href="/mess">
            {t("all")}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      }
    >
      {data.notices.length === 0 ? (
        <EmptyState icon={Megaphone} title={t("empty")} className="py-4" />
      ) : (
        <ul className="grid gap-2">
          {data.notices.map((n) => (
            <li
              key={n.id}
              className={cn(
                "rounded-xl border px-3 py-2.5",
                n.priority === "urgent" ? "border-coral/40 bg-coral-soft" : n.priority === "high" ? "border-marigold/30" : "",
              )}
            >
              <p className="flex items-center gap-1.5 text-sm font-medium">
                {n.is_pinned && <Pin className="size-3.5 text-primary" aria-label={t("pinned")} />}
                {n.priority === "urgent" && <TriangleAlert className="size-3.5 text-coral" aria-label={t("urgent")} />}
                <span className="truncate">{n.title}</span>
              </p>
              <p className="text-[11px] text-muted-foreground">{formatDate(n.created_at, locale)}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function ChoresCard({ data }: { data: MemberDashboard }) {
  const t = useTranslations("dashboard.chores");
  const tc = useTranslations("choreTypes");
  const locale = useLocale();
  return (
    <Card
      title={t("title")}
      icon={ShoppingBasket}
      action={
        <Button asChild size="sm" variant="ghost" className="-mr-2">
          <Link href="/mess/roster">
            {t("roster")}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      }
    >
      {data.my_chores.length === 0 ? (
        <EmptyState icon={ShoppingBasket} title={t("empty")} className="py-4" />
      ) : (
        <ul className="grid gap-2">
          {data.my_chores.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 rounded-xl bg-muted/60 px-3 py-2.5">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{c.title}</span>
                <span className="text-[11px] text-muted-foreground">{tc(c.chore_type)}</span>
              </span>
              <Badge variant={c.due_date === data.today ? "default" : "secondary"} className="shrink-0 font-normal">
                {c.due_date === data.today ? t("today") : formatDate(c.due_date, locale, { weekday: "short", day: "numeric" })}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function TransactionsCard({ data }: { data: MemberDashboard }) {
  const t = useTranslations("dashboard.transactions");
  const tl = useTranslations("ledgerTypes");
  const locale = useLocale();
  return (
    <Card title={t("title")} icon={ReceiptText}>
      {data.recent_transactions.length === 0 ? (
        <EmptyState icon={ReceiptText} title={t("empty")} className="py-4" />
      ) : (
        <ul className="divide-y">
          {data.recent_transactions.map((tx) => {
            const credit = tx.amount > 0;
            return (
              <li key={tx.id} className="flex items-center gap-3 py-2.5">
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full",
                    credit ? "bg-mint-soft text-mint" : "bg-coral-soft text-coral",
                  )}
                >
                  {credit ? <ArrowDownLeft className="size-4" aria-hidden="true" /> : <ArrowUpRight className="size-4" aria-hidden="true" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{tl(tx.entry_type)}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {tx.description ? `${tx.description} · ` : ""}
                    {formatDate(tx.created_at, locale)}
                  </span>
                </span>
                <span className={cn("num shrink-0 text-sm font-semibold", credit ? "text-mint" : "text-coral")}>
                  {credit ? "+" : ""}
                  {formatTaka(tx.amount, locale)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

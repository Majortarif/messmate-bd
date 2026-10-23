import { AlarmClock, ArrowDownLeft, ArrowUpRight, CookingPot, LifeBuoy, MessageCircle, Phone, PiggyBank, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { CareNav } from "@/components/care/care-nav";
import { AddEntryButton, AddLoanButton, BudgetButton, DeleteEntryButton, LoanMenu, LoanPaymentButton } from "@/components/care/money";
import { RankedBarChart } from "@/components/charts/viz";
import { MonthNav } from "@/components/shared/month-nav";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { ToneBadge } from "@/components/shared/tone-badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requireOnboarded } from "@/lib/dal";
import { dhakaToday, formatDate, formatNumber, formatTaka } from "@/lib/format";
import { whatsappHref } from "@/lib/links";
import { currentMonth, parseMonth, shiftMonth } from "@/lib/month";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("care.money");
  return { title: t("title") };
}

export default async function MoneyPage({ searchParams }: PageProps<"/[locale]/care/money">) {
  await requireOnboarded();
  const month = parseMonth((await searchParams).month);
  const next = shiftMonth(month, 1);
  const today = dhakaToday();
  const isCurrent = month === currentMonth();
  const supabase = await createClient();
  const [budgetRes, entriesRes, loansRes, t, tc, locale] = await Promise.all([
    supabase.from("monthly_budgets").select("limit_amount, expected_income").eq("period_month", month).maybeSingle(),
    supabase.from("budget_entries").select("id, entry_type, category, amount, entry_date, note").gte("entry_date", month).lt("entry_date", next).order("entry_date", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("loans").select("*, payments:loan_payments(id, amount, paid_on, created_at)").order("status").order("created_at", { ascending: false }),
    getTranslations("care.money"),
    getTranslations("budgetCategories"),
    getLocale(),
  ]);
  const entries = entriesRes.data ?? [];
  const loans = loansRes.data ?? [];
  const limit = budgetRes.data ? Number(budgetRes.data.limit_amount) : null;
  const spent = entries.filter((e) => e.entry_type === "expense").reduce((s, e) => s + Number(e.amount), 0);
  const income = entries.filter((e) => e.entry_type === "income").reduce((s, e) => s + Number(e.amount), 0);
  // day 0 of the next month = the last day of this one
  const daysInMonth = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const dayOfMonth = isCurrent ? Number(today.slice(8, 10)) : daysInMonth;
  const daysLeft = isCurrent ? daysInMonth - dayOfMonth + 1 : 0;
  const remaining = limit !== null ? limit - spent : null;
  const perDay = remaining !== null && daysLeft > 0 ? Math.max(0, Math.floor(remaining / daysLeft)) : null;
  const projected = isCurrent && dayOfMonth > 0 ? Math.round((spent / dayOfMonth) * daysInMonth) : spent;
  const survival = isCurrent && limit !== null && (remaining! <= limit * 0.25 || projected > limit);
  const byCategory = Object.entries(
    entries.filter((e) => e.entry_type === "expense").reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.category]: (acc[e.category] ?? 0) + Number(e.amount) }), {}),
  ).sort((a, b) => b[1] - a[1]);

  const openLoans = loans.filter((l) => l.status === "open");
  const owedToMe = openLoans.filter((l) => l.direction === "lent").reduce((s, l) => s + Number(l.amount) - Number(l.repaid_amount), 0);
  const iOwe = openLoans.filter((l) => l.direction === "borrowed").reduce((s, l) => s + Number(l.amount) - Number(l.repaid_amount), 0);
  const taka = (v: number) => formatTaka(v, locale);

  return (
    <div className="grid gap-5">
      <PageHeader title={t("title")} description={t("subtitle")} actions={<MonthNav month={month} path="/care/money" />} />
      <CareNav active="money" />

      {survival && (
        <section className="grid gap-3 rounded-2xl border border-marigold/40 bg-marigold-soft p-4 sm:p-5">
          <p className="flex items-center gap-2 text-lg font-semibold">
            <LifeBuoy className="size-5 text-marigold" aria-hidden="true" />
            {t("survival.title")}
          </p>
          <p className="text-sm">
            {remaining! > 0
              ? t("survival.body", { perDay: taka(perDay ?? 0), days: formatNumber(daysLeft, locale) })
              : t("survival.over", { amount: taka(-remaining!) })}
          </p>
          <ul className="grid gap-1 text-sm text-muted-foreground">
            <li>• {t("survival.tip1")}</li>
            <li>• {t("survival.tip2")}</li>
            <li>• {t("survival.tip3")}</li>
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href="/care/food?budget=1">
                <CookingPot className="size-4" aria-hidden="true" />
                {t("survival.recipes")}
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/care/jobs">{t("survival.tuitions")}</Link>
            </Button>
          </div>
        </section>
      )}

      <section className="grid gap-4 rounded-2xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold">
            <PiggyBank className="size-[18px] text-muted-foreground" aria-hidden="true" />
            {t("budgetTitle", { month: formatDate(month, locale, { month: "long" }) })}
          </h2>
          <div className="flex gap-2">
            <BudgetButton month={month.slice(0, 7)} initial={{ limit, income: budgetRes.data?.expected_income ? Number(budgetRes.data.expected_income) : null }} />
            <AddEntryButton today={isCurrent ? today : `${month.slice(0, 7)}-${String(daysInMonth).padStart(2, "0")}`} />
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Fact label={t("spent")} value={taka(spent)} />
          <Fact label={t("limit")} value={limit !== null ? taka(limit) : t("noLimit")} />
          <Fact
            label={t("left")}
            value={remaining !== null ? taka(remaining) : "—"}
            tone={remaining !== null && remaining < 0 ? "text-coral" : undefined}
          />
          <Fact label={isCurrent ? t("perDay") : t("income")} value={isCurrent ? (perDay !== null ? taka(perDay) : "—") : taka(income)} />
        </dl>
        {limit !== null && (
          <div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={spent} aria-valuemin={0} aria-valuemax={limit} aria-label={t("spent")}>
              <div
                className={cn("h-full rounded-full transition-[width] duration-700", spent > limit ? "bg-coral" : spent > limit * 0.75 ? "bg-marigold" : "bg-primary")}
                style={{ width: `${Math.min(100, (spent / limit) * 100)}%` }}
              />
            </div>
            {isCurrent && <p className="mt-1.5 text-xs text-muted-foreground">{t("projected", { amount: taka(projected) })}</p>}
          </div>
        )}
      </section>

      {byCategory.length > 0 && (
        <RankedBarChart
          money
          title={t("whereWent")}
          columnLabel={t("amount")}
          data={byCategory.map(([k, v]) => ({ key: k, label: tc(k as "food"), value: v }))}
        />
      )}

      <section className="grid gap-2">
        <h2 className="font-semibold">{t("entries")}</h2>
        {entries.length === 0 ? (
          <EmptyState icon={Wallet} title={t("noEntries")} body={t("noEntriesBody")} className="rounded-2xl border bg-card py-8" />
        ) : (
          <ul className="grid gap-1 rounded-2xl border bg-card p-2">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/50">
                <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", e.entry_type === "income" ? "bg-mint-soft text-mint" : "bg-coral-soft text-coral")}>
                  {e.entry_type === "income" ? <ArrowDownLeft className="size-4" aria-hidden="true" /> : <ArrowUpRight className="size-4" aria-hidden="true" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.note || tc(e.category)}</p>
                  <p className="text-xs text-muted-foreground">
                    {tc(e.category)} · {formatDate(e.entry_date, locale, { day: "numeric", month: "short" })}
                  </p>
                </div>
                <span className={cn("num text-sm font-semibold", e.entry_type === "income" ? "text-mint" : "")}>
                  {e.entry_type === "income" ? "+" : "−"}
                  {taka(Number(e.amount))}
                </span>
                <DeleteEntryButton id={e.id} label={t("removeEntry")} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-3 rounded-2xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">{t("loansTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("loansBody")}</p>
          </div>
          <AddLoanButton />
        </div>
        <dl className="grid grid-cols-2 gap-2">
          <Fact label={t("owedToMe")} value={taka(owedToMe)} tone={owedToMe > 0 ? "text-mint" : undefined} />
          <Fact label={t("iOwe")} value={taka(iOwe)} tone={iOwe > 0 ? "text-coral" : undefined} />
        </dl>
        {loans.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noLoans")}</p>
        ) : (
          <ul className="grid gap-2">
            {loans.map((l) => {
              const left = Number(l.amount) - Number(l.repaid_amount);
              const overdue = l.status === "open" && l.due_date !== null && l.due_date < today;
              const payments = [...(l.payments ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
              const reminder =
                l.direction === "lent" ? t("reminderText", { name: l.counterparty_name, amount: taka(left) }) : undefined;
              return (
                <li key={l.id} className={cn("rounded-xl border px-3 py-3", l.status === "settled" && "opacity-60")}>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-1.5 font-medium">
                        {l.direction === "lent" ? t("theyOwe", { name: l.counterparty_name }) : t("youOwe", { name: l.counterparty_name })}
                        {l.status === "settled" && <ToneBadge tone="mint">{t("settled")}</ToneBadge>}
                        {overdue && (
                          <ToneBadge tone="coral">
                            <AlarmClock className="size-3" aria-hidden="true" />
                            {t("overdue")}
                          </ToneBadge>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t("progress", { paid: taka(Number(l.repaid_amount)), total: taka(Number(l.amount)) })}
                        {l.due_date && ` · ${t("due", { date: formatDate(l.due_date, locale, { day: "numeric", month: "short" }) })}`}
                      </p>
                      {l.note && <p className="mt-0.5 text-xs text-muted-foreground">{l.note}</p>}
                    </div>
                    <LoanMenu
                      id={l.id}
                      name={l.counterparty_name}
                      lastPaymentId={payments[0]?.id ?? null}
                      initial={{
                        direction: l.direction,
                        counterpartyName: l.counterparty_name,
                        counterpartyPhone: l.counterparty_phone ?? "",
                        amount: Number(l.amount),
                        dueDate: l.due_date ?? "",
                        note: l.note ?? "",
                      }}
                    />
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(Number(l.repaid_amount) / Number(l.amount)) * 100}%` }} />
                  </div>
                  {l.status === "open" && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <LoanPaymentButton
                        loanId={l.id}
                        remaining={left}
                        today={today}
                        label={l.direction === "lent" ? t("gotBack") : t("paidBack")}
                      />
                      {l.counterparty_phone && (
                        <>
                          <Button asChild size="sm" variant="ghost">
                            <a href={`tel:${l.counterparty_phone}`} aria-label={t("callName", { name: l.counterparty_name })}>
                              <Phone className="size-4" aria-hidden="true" />
                            </a>
                          </Button>
                          {reminder && (
                            <Button asChild size="sm" variant="ghost">
                              <a href={whatsappHref(l.counterparty_phone, reminder)} target="_blank" rel="noreferrer">
                                <MessageCircle className="size-4" aria-hidden="true" />
                                {t("remind")}
                              </a>
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">{t("loansPrivate")}</p>
      </section>
    </div>
  );
}

function Fact({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-muted/50 px-3 py-2.5">
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 truncate text-lg font-semibold", tone)}>{value}</dd>
    </div>
  );
}

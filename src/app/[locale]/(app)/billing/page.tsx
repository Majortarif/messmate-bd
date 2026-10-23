import { Download, FileText, Lock, Printer, Receipt, ShoppingCart } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { MonthNav } from "@/components/shared/month-nav";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { billTone, ToneBadge } from "@/components/shared/tone-badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requireMember } from "@/lib/dal";
import { formatDate, formatNumber, formatTaka } from "@/lib/format";
import { monthParam, parseMonth, shiftMonth } from "@/lib/month";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { MemberDashboard } from "@/types/app";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("billing") };
}

const MEAL_CATEGORIES = new Set(["bazar", "cooking_gas"]);

export default async function BillingPage({ searchParams }: PageProps<"/[locale]/billing">) {
  const member = await requireMember();
  const messId = member.membership.mess_id;
  const month = parseMonth((await searchParams).month);
  const next = shiftMonth(month, 1);
  const supabase = await createClient();

  const [closingRes, statementRes, sharesRes, billsRes, expensesRes, dashRes, t, tb, tc, locale] = await Promise.all([
    supabase.from("monthly_closings").select("*").eq("mess_id", messId).eq("period_month", month).maybeSingle(),
    supabase.from("member_statements").select("*").eq("user_id", member.id).eq("period_month", month).maybeSingle(),
    supabase
      .from("bill_shares")
      .select("id, amount, bill:bills!inner(id, bill_type, period_month, total_amount, split_mode, due_date, description, status)")
      .eq("user_id", member.id)
      .eq("bill.period_month", month),
    supabase
      .from("bills")
      .select("id, bill_type, total_amount, split_mode, due_date, status")
      .eq("mess_id", messId)
      .eq("period_month", month)
      .neq("status", "draft")
      .order("created_at"),
    supabase
      .from("expenses")
      .select("id, category, amount, expense_date, description, receipt_path, paid_from")
      .eq("mess_id", messId)
      .gte("expense_date", month)
      .lt("expense_date", next)
      .order("expense_date", { ascending: false }),
    supabase.rpc("get_member_dashboard", { p_month: month }),
    getTranslations("billing"),
    getTranslations("billTypes"),
    getTranslations("expenseCategories"),
    getLocale(),
  ]);

  const closing = closingRes.data;
  const statement = statementRes.data;
  const meals = (dashRes.data as unknown as MemberDashboard | null)?.meals;
  const expenses = expensesRes.data ?? [];

  // receipts live in a private bucket: short-lived signed links (members of this mess only)
  const receiptPaths = expenses.map((e) => e.receipt_path).filter((p): p is string => Boolean(p));
  const signed = receiptPaths.length
    ? (await supabase.storage.from("receipts").createSignedUrls(receiptPaths, 3600)).data ?? []
    : [];
  const receiptUrl = new Map(signed.filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl]));

  const byCategory = new Map<string, number>();
  for (const e of expenses) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + Number(e.amount));
  const expenseTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const mealExpense = expenses.filter((e) => MEAL_CATEGORIES.has(e.category)).reduce((s, e) => s + Number(e.amount), 0);

  const statementRows = statement
    ? [
        { label: t("statement.opening"), value: statement.opening_balance },
        { label: t("statement.deposits"), value: statement.deposits, sign: "+" },
        {
          label: t("statement.meals", { units: formatNumber(statement.meal_units, locale, 2), rate: formatTaka(closing?.meal_rate ?? 0, locale) }),
          value: -statement.meal_cost,
        },
        { label: t("statement.bills"), value: -statement.bill_cost },
        { label: t("statement.other"), value: statement.other_net },
      ]
    : [];

  return (
    <div className="grid gap-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={<MonthNav month={month} path="/billing" />}
      />

      {closing && statement ? (
        <section className="rounded-3xl border bg-card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lock className="size-4" aria-hidden="true" />
                {t("closedOn", { date: formatDate(closing.closed_at, locale, { day: "numeric", month: "long" }) })}
              </p>
              <h2 className="mt-1 text-xl font-semibold">{t("statement.title", { month: formatDate(month, locale, { month: "long", year: "numeric" }) })}</h2>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/statement/${monthParam(month)}`}>
                  <Printer className="size-4" aria-hidden="true" />
                  {t("print")}
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={`/api/export/ledger?month=${monthParam(month)}&locale=${locale}`} download>
                  <Download className="size-4" aria-hidden="true" />
                  CSV
                </a>
              </Button>
            </div>
          </div>
          <dl className="mt-5 divide-y rounded-2xl border">
            {statementRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className={cn("num font-medium", Number(row.value) < 0 && "text-coral")}>
                  {row.sign && Number(row.value) > 0 ? "+" : ""}
                  {formatTaka(row.value, locale)}
                </dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 bg-muted/50 px-4 py-3.5">
              <dt className="font-semibold">{t("statement.closing")}</dt>
              <dd className={cn("num text-lg font-bold", statement.closing_balance < 0 ? "text-coral" : "text-mint")}>
                {formatTaka(statement.closing_balance, locale)}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            {statement.closing_balance < 0 ? t("statement.due") : t("statement.carry")}
          </p>
        </section>
      ) : (
        <section className="rounded-3xl border border-dashed bg-card p-5 sm:p-6">
          <p className="text-sm text-muted-foreground">{closing ? t("notMember") : t("openMonth")}</p>
          {meals && !closing && (
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: t("estimate.myMeals"), value: formatNumber(meals.my_units, locale, 1) },
                { label: t("estimate.rate"), value: formatTaka(meals.meal_rate, locale) },
                { label: t("estimate.mealCost"), value: formatTaka(meals.my_meal_cost, locale) },
                { label: t("estimate.messBazar"), value: formatTaka(meals.mess_meal_expense, locale) },
              ].map((s) => (
                <div key={s.label} className="rounded-xl bg-muted/60 px-3 py-2.5">
                  <dt className="text-xs text-muted-foreground">{s.label}</dt>
                  <dd className="num mt-0.5 font-semibold">{s.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <FileText className="size-[18px] text-muted-foreground" aria-hidden="true" />
            {t("myBills")}
          </h2>
          {(sharesRes.data ?? []).length === 0 ? (
            <EmptyState icon={FileText} title={t("noBills")} className="py-4" />
          ) : (
            <ul className="divide-y">
              {sharesRes.data!.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium">
                      {tb(s.bill.bill_type)}
                      <ToneBadge tone={billTone[s.bill.status]}>{t(`billStatus.${s.bill.status}`)}</ToneBadge>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("ofTotal", { total: formatTaka(s.bill.total_amount, locale), split: t(`split.${s.bill.split_mode}`) })}
                      {s.bill.due_date ? ` · ${t("due", { date: formatDate(s.bill.due_date, locale) })}` : ""}
                    </p>
                  </div>
                  <span className={cn("num font-semibold", s.bill.status === "void" && "line-through text-muted-foreground")}>
                    {formatTaka(s.amount, locale)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {(billsRes.data ?? []).length > 0 && (
            <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
              {t("messBills", {
                count: billsRes.data!.filter((b) => b.status === "posted").length,
                total: formatTaka(
                  billsRes.data!.filter((b) => b.status === "posted").reduce((sum, b) => sum + Number(b.total_amount), 0),
                  locale,
                ),
              })}
            </p>
          )}
        </section>

        <section className="rounded-2xl border bg-card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <ShoppingCart className="size-[18px] text-muted-foreground" aria-hidden="true" />
            {t("expenses.title")}
          </h2>
          {expenses.length === 0 ? (
            <EmptyState icon={ShoppingCart} title={t("expenses.empty")} className="py-4" />
          ) : (
            <>
              <div className="grid gap-2">
                {[...byCategory].sort((a, b) => b[1] - a[1]).map(([cat, amount]) => (
                  <div key={cat} className="grid gap-1">
                    <div className="flex justify-between text-xs">
                      <span>{tc(cat as "bazar")}</span>
                      <span className="num text-muted-foreground">{formatTaka(amount, locale)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", MEAL_CATEGORIES.has(cat) ? "bg-marigold" : "bg-sky")}
                        style={{ width: `${(amount / expenseTotal) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {t("expenses.summary", { total: formatTaka(expenseTotal, locale), meal: formatTaka(mealExpense, locale) })}
              </p>
              <ul className="mt-3 max-h-80 divide-y overflow-y-auto border-t">
                {expenses.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{e.description || tc(e.category)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(e.expense_date, locale)} · {tc(e.category)}
                        {e.paid_from === "member" ? ` · ${t("expenses.memberPaid")}` : ""}
                      </p>
                    </div>
                    {e.receipt_path && receiptUrl.get(e.receipt_path) && (
                      <a
                        href={receiptUrl.get(e.receipt_path)!}
                        target="_blank"
                        rel="noreferrer"
                        className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                        aria-label={t("expenses.receipt")}
                      >
                        <Receipt className="size-4" />
                      </a>
                    )}
                    <span className="num text-sm font-medium">{formatTaka(e.amount, locale)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

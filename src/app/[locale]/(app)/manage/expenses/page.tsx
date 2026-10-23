import { Lock } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { ExpenseManager, type ExpenseRow } from "@/components/manage/expenses";
import { MonthNav } from "@/components/shared/month-nav";
import { PageHeader } from "@/components/shared/states";
import { requireManager } from "@/lib/dal";
import { formatTaka } from "@/lib/format";
import { parseMonth, shiftMonth } from "@/lib/month";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("manage.expenses");
  return { title: t("title") };
}

const MEAL = new Set(["bazar", "cooking_gas"]);

export default async function ExpensesPage({ searchParams }: PageProps<"/[locale]/manage/expenses">) {
  const manager = await requireManager();
  const messId = manager.membership.mess_id;
  const month = parseMonth((await searchParams).month);
  const supabase = await createClient();

  const [expRes, membersRes, closingRes, t, locale] = await Promise.all([
    supabase
      .from("expenses")
      .select("id, category, amount, expense_date, description, paid_from, paid_by, receipt_path, reimbursement_entry_id, payer:profiles!expenses_paid_by_fkey(full_name)")
      .eq("mess_id", messId)
      .gte("expense_date", month)
      .lt("expense_date", shiftMonth(month, 1))
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("mess_members")
      .select("user_id, profile:profiles!mess_members_user_id_fkey(full_name)")
      .eq("mess_id", messId)
      .in("status", ["active", "inactive"])
      .order("joined_at"),
    supabase.from("monthly_closings").select("id").eq("mess_id", messId).eq("period_month", month).maybeSingle(),
    getTranslations("manage.expenses"),
    getLocale(),
  ]);

  const data = expRes.data ?? [];
  const paths = data.map((e) => e.receipt_path).filter((p): p is string => Boolean(p));
  const signed = paths.length ? (await supabase.storage.from("receipts").createSignedUrls(paths, 3600)).data ?? [] : [];
  const urls = new Map(signed.filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl]));

  const rows: ExpenseRow[] = data.map((e) => ({
    id: e.id,
    category: e.category,
    amount: Number(e.amount),
    date: e.expense_date,
    description: e.description,
    paidFrom: e.paid_from,
    payerId: e.paid_by,
    payerName: e.payer?.full_name ?? null,
    reimbursed: Boolean(e.reimbursement_entry_id),
    receiptUrl: e.receipt_path ? urls.get(e.receipt_path) ?? null : null,
  }));
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const meal = rows.filter((r) => MEAL.has(r.category)).reduce((s, r) => s + r.amount, 0);
  const closed = Boolean(closingRes.data);

  return (
    <div className="grid gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} actions={<MonthNav month={month} path="/manage/expenses" />} />

      <dl className="grid grid-cols-3 gap-3">
        {[
          { label: t("total"), value: total },
          { label: t("mealTotal"), value: meal },
          { label: t("sharedTotal"), value: total - meal },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border bg-card px-3 py-3 sm:px-4">
            <dt className="text-[11px] text-muted-foreground sm:text-xs">{s.label}</dt>
            <dd className="num mt-0.5 text-lg font-bold">{formatTaka(s.value, locale)}</dd>
          </div>
        ))}
      </dl>

      {closed && (
        <p className="flex items-center gap-2 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          <Lock className="size-4" aria-hidden="true" />
          {t("closed")}
        </p>
      )}

      <ExpenseManager
        messId={messId}
        rows={rows}
        closed={closed}
        members={(membersRes.data ?? []).map((m) => ({ userId: m.user_id, name: m.profile?.full_name || "—" }))}
      />
    </div>
  );
}

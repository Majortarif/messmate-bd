import { Clock, Download, History, ShieldCheck, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { MonthNav } from "@/components/shared/month-nav";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { requestTone, ToneBadge } from "@/components/shared/tone-badge";
import { Button } from "@/components/ui/button";
import { AddMoneyButton } from "@/components/wallet/add-money";
import { LedgerList, type LedgerRow } from "@/components/wallet/ledger-list";
import { requireMember } from "@/lib/dal";
import { formatDate, formatTaka } from "@/lib/format";
import { monthParam, parseMonth } from "@/lib/month";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("wallet") };
}

type Summary = { balance: number; total_deposits: number; total_spent: number; pending_count: number; pending_amount: number };

export default async function WalletPage({ searchParams }: PageProps<"/[locale]/wallet">) {
  const member = await requireMember();
  const messId = member.membership.mess_id;
  const query = await searchParams;
  const month = parseMonth(query.month);
  const supabase = await createClient();

  const [summaryRes, settingsRes, requestsRes, ledgerRes, t, tm, locale] = await Promise.all([
    supabase.rpc("get_wallet_summary", {}),
    supabase
      .from("mess_settings")
      .select("bkash_number, nagad_number, rocket_number, payment_note, low_balance_threshold")
      .eq("mess_id", messId)
      .single(),
    supabase
      .from("deposit_requests")
      .select("id, amount, method, trx_id, status, created_at, review_note")
      .eq("user_id", member.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("ledger_entries")
      .select("id, entry_type, amount, description, created_at")
      .eq("user_id", member.id)
      .eq("mess_id", messId)
      .eq("period_month", month)
      .order("created_at", { ascending: false }),
    getTranslations("wallet"),
    getTranslations("wallet.add.methods"),
    getLocale(),
  ]);

  const summary = (summaryRes.data ?? { balance: 0, total_deposits: 0, total_spent: 0, pending_count: 0, pending_amount: 0 }) as Summary;
  const settings = settingsRes.data;
  const negative = summary.balance < 0;
  const low = summary.balance < Number(settings?.low_balance_threshold ?? 0);

  return (
    <div className="grid gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <section
        className={cn(
          "relative overflow-hidden rounded-3xl border p-6",
          negative ? "border-coral/30 bg-coral-soft" : "border-primary/25 bg-mint-soft",
        )}
      >
        <div className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full bg-primary/10" aria-hidden="true" />
        <p className="relative flex items-center gap-2 text-sm text-muted-foreground">
          <Wallet className="size-4" aria-hidden="true" />
          {t("balance")}
          {low && <ToneBadge tone="coral">{t("low")}</ToneBadge>}
        </p>
        <p className={cn("num relative mt-1 text-5xl font-bold tracking-tight", negative ? "text-coral" : "text-mint")}>
          {formatTaka(summary.balance, locale)}
        </p>
        <div className="relative mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-background/50 px-3 py-2">
            <p className="text-xs text-muted-foreground">{t("deposits")}</p>
            <p className="num font-semibold">{formatTaka(summary.total_deposits, locale)}</p>
          </div>
          <div className="rounded-xl bg-background/50 px-3 py-2">
            <p className="text-xs text-muted-foreground">{t("spent")}</p>
            <p className="num font-semibold">{formatTaka(summary.total_spent, locale)}</p>
          </div>
          {summary.pending_count > 0 && (
            <div className="col-span-2 rounded-xl bg-background/50 px-3 py-2 sm:col-span-1">
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3" aria-hidden="true" />
                {t("pending")}
              </p>
              <p className="num font-semibold text-marigold">{formatTaka(summary.pending_amount, locale)}</p>
            </div>
          )}
        </div>
        <div className="relative mt-5 flex flex-wrap items-center gap-3">
          <AddMoneyButton
            messId={messId}
            userId={member.id}
            defaultOpen={query.add === "1"}
            className="h-11 px-5"
            numbers={{
              bkash: settings?.bkash_number ?? null,
              nagad: settings?.nagad_number ?? null,
              rocket: settings?.rocket_number ?? null,
              note: settings?.payment_note ?? null,
            }}
          />
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
            {t("ledgerNote")}
          </p>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <History className="size-[18px] text-muted-foreground" aria-hidden="true" />
            {t("requests.title")}
          </h2>
          {(requestsRes.data ?? []).length === 0 ? (
            <EmptyState icon={History} title={t("requests.empty")} body={t("requests.emptyBody")} className="py-4" />
          ) : (
            <ul className="divide-y">
              {requestsRes.data!.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="num font-semibold">{formatTaka(r.amount, locale)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {tm(r.method === "bank" ? "cash" : r.method)}
                      {r.trx_id ? ` · ${r.trx_id}` : ""} · {formatDate(r.created_at, locale)}
                    </p>
                    {r.status === "rejected" && r.review_note && <p className="mt-1 text-xs text-coral">{r.review_note}</p>}
                  </div>
                  <ToneBadge tone={requestTone[r.status]}>{t(`requests.status.${r.status}`)}</ToneBadge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border bg-card p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">{t("ledger.title")}</h2>
            <div className="flex items-center gap-2">
              <MonthNav month={month} path="/wallet" />
              <Button asChild variant="outline" size="icon" aria-label={t("ledger.csv")} title={t("ledger.csv")}>
                <a href={`/api/export/ledger?month=${monthParam(month)}&locale=${locale}`} download>
                  <Download className="size-4" />
                </a>
              </Button>
            </div>
          </div>
          <LedgerList
            rows={(ledgerRes.data ?? []) as LedgerRow[]}
            emptyTitle={t("ledger.empty", { month: formatDate(month, locale, { month: "long" }) })}
          />
        </section>
      </div>
    </div>
  );
}

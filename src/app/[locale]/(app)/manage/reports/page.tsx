import { CalendarCheck, Download, FileSpreadsheet, Info, Users } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { MonthNav } from "@/components/shared/month-nav";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { ToneBadge } from "@/components/shared/tone-badge";
import { Button } from "@/components/ui/button";
import { requireManager } from "@/lib/dal";
import { MESS_EXPORTS } from "@/lib/csv";
import { formatDate, formatNumber, formatTaka } from "@/lib/format";
import { monthParam, parseMonth } from "@/lib/month";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { MessReport } from "@/types/app";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("manage.reports");
  return { title: t("title") };
}

export default async function ReportsPage({ searchParams }: PageProps<"/[locale]/manage/reports">) {
  await requireManager();
  const month = parseMonth((await searchParams).month);
  const supabase = await createClient();
  const [result, t, locale] = await Promise.all([
    supabase.rpc("get_mess_report", { p_month: month }),
    getTranslations("manage.reports"),
    getLocale(),
  ]);
  if (result.error) throw new Error(result.error.message);
  const r = result.data as unknown as MessReport;

  const monthLabel = formatDate(month, locale, { month: "long", year: "numeric" });
  const taka = (v: number) => formatTaka(v, locale);
  const est = r.estimated;
  const rows = r.members.map((m) => ({
    ...m,
    mealTotal: Number(m.meal_cost) + Number(m.est_meal_cost),
    closingShown: Number(m.closing) - Number(m.est_meal_cost),
  }));
  const sum = (pick: (row: (typeof rows)[number]) => number) => rows.reduce((s, row) => s + pick(row), 0);
  const exportHref = (dataset: string, scope: string) => `/api/export/mess?dataset=${dataset}&month=${scope}&locale=${locale}`;

  return (
    <div className="grid gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} actions={<MonthNav month={month} path="/manage/reports" />} />

      <div
        className={cn(
          "flex items-start gap-3 rounded-2xl border p-4 text-sm",
          r.closed ? "border-mint/30 bg-mint-soft" : "border-marigold/30 bg-marigold-soft",
        )}
      >
        {r.closed ? (
          <CalendarCheck className="mt-0.5 size-4 shrink-0 text-mint" aria-hidden="true" />
        ) : (
          <Info className="mt-0.5 size-4 shrink-0 text-marigold" aria-hidden="true" />
        )}
        <p>
          {r.closed && r.closed_at
            ? t("closedNote", { month: monthLabel, date: formatDate(r.closed_at, locale, { day: "numeric", month: "long" }) })
            : est
              ? t("estimateNote", { month: monthLabel })
              : t("openNote", { month: monthLabel })}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Total label={t("totals.meals")} value={formatNumber(r.totals.meal_units, locale)} />
        <Total label={t("totals.bazar")} value={taka(r.totals.meal_expense)} />
        <Total
          label={r.closed ? t("totals.rate") : t("totals.rateSoFar")}
          value={r.meal_rate === null ? t("totals.fixed") : taka(r.meal_rate)}
        />
        <Total label={t("totals.shared")} value={taka(r.totals.shared_expense)} />
        <Total label={t("totals.bills")} value={taka(r.totals.bills)} />
        <Total label={t("totals.deposits")} value={taka(r.totals.deposits)} />
      </dl>

      <section className="rounded-2xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 p-4 sm:p-5">
          <div>
            <h2 className="font-semibold">{t("table.title", { month: monthLabel })}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{t("table.body")}</p>
          </div>
          {r.closed && (
            <Button asChild size="sm" variant="outline">
              <a href={`/api/export/statements?month=${monthParam(month)}&locale=${locale}`} download>
                <Download className="size-4" aria-hidden="true" />
                {t("statementsCsv")}
              </a>
            </Button>
          )}
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={Users} title={t("table.empty")} className="pb-8" />
        ) : (
          <div className="overflow-x-auto border-t">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-4 py-2.5 font-medium">{t("table.member")}</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">{t("table.opening")}</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">{t("table.deposits")}</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">{t("table.meals")}</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">{est ? t("table.mealCostEst") : t("table.mealCost")}</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">{t("table.bills")}</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">{t("table.other")}</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">{est ? t("table.closingEst") : t("table.closing")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.user_id} className="border-b last:border-0">
                    <th scope="row" className="px-4 py-2.5 text-left font-normal">
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{m.full_name || "—"}</span>
                        {m.status === "left" && <ToneBadge tone="muted">{t("table.left")}</ToneBadge>}
                      </span>
                      <span className="text-xs text-muted-foreground">{m.room ? t("table.room", { room: m.room }) : t("table.noRoom")}</span>
                    </th>
                    <td className="num px-3 py-2.5 text-right">{taka(m.opening)}</td>
                    <td className="num px-3 py-2.5 text-right">{taka(m.deposits)}</td>
                    <td className="num px-3 py-2.5 text-right">{formatNumber(m.meal_units, locale)}</td>
                    <td className="num px-3 py-2.5 text-right">{taka(m.mealTotal)}</td>
                    <td className="num px-3 py-2.5 text-right">{taka(m.bill_cost)}</td>
                    <td className="num px-3 py-2.5 text-right">{taka(m.other_net)}</td>
                    <td className={cn("num px-4 py-2.5 text-right font-semibold", m.closingShown < 0 ? "text-coral" : "text-mint")}>
                      {taka(m.closingShown)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/40 font-semibold">
                  <th scope="row" className="px-4 py-2.5 text-left">{t("table.total")}</th>
                  <td className="num px-3 py-2.5 text-right">{taka(sum((m) => Number(m.opening)))}</td>
                  <td className="num px-3 py-2.5 text-right">{taka(sum((m) => Number(m.deposits)))}</td>
                  <td className="num px-3 py-2.5 text-right">{formatNumber(sum((m) => Number(m.meal_units)), locale)}</td>
                  <td className="num px-3 py-2.5 text-right">{taka(sum((m) => m.mealTotal))}</td>
                  <td className="num px-3 py-2.5 text-right">{taka(sum((m) => Number(m.bill_cost)))}</td>
                  <td className="num px-3 py-2.5 text-right">{taka(sum((m) => Number(m.other_net)))}</td>
                  <td className="num px-4 py-2.5 text-right">{taka(sum((m) => m.closingShown))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <FileSpreadsheet className="size-[18px] text-muted-foreground" aria-hidden="true" />
          {t("downloads.title")}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("downloads.body")}</p>
        <ul className="mt-4 grid gap-2 md:grid-cols-2">
          {MESS_EXPORTS.map((dataset) => (
            <li key={dataset} className="flex flex-wrap items-center gap-3 rounded-xl border px-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{t(`downloads.${dataset}.title`)}</p>
                <p className="text-xs text-muted-foreground">{t(`downloads.${dataset}.body`)}</p>
              </div>
              <div className="flex gap-1.5">
                {dataset !== "members" && (
                  <Button asChild size="sm" variant="outline">
                    <a href={exportHref(dataset, monthParam(month))} download aria-label={t("downloads.monthAria", { what: t(`downloads.${dataset}.title`), month: monthLabel })}>
                      <Download className="size-3.5" aria-hidden="true" />
                      {formatDate(month, locale, { month: "short" })}
                    </a>
                  </Button>
                )}
                <Button asChild size="sm" variant="outline">
                  <a href={exportHref(dataset, "all")} download aria-label={t("downloads.allAria", { what: t(`downloads.${dataset}.title`) })}>
                    <Download className="size-3.5" aria-hidden="true" />
                    {dataset === "members" ? t("downloads.now") : t("downloads.all")}
                  </a>
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">{t("downloads.note")}</p>
      </section>
    </div>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border bg-card px-4 py-3">
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate text-lg font-semibold">{value}</dd>
    </div>
  );
}

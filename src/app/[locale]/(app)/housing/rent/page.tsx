import { AlarmClock, BellRing, CalendarClock, CheckCircle2, FileText, Phone, ReceiptText } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { HousingTabs } from "@/components/housing/housing-tabs";
import { AddRentRecordButton, DeletePaymentButton, PayRentButton, RentRecordMenu } from "@/components/housing/rent-tracker";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { ToneBadge } from "@/components/shared/tone-badge";
import { requireOnboarded } from "@/lib/dal";
import { dhakaToday, formatDate, formatNumber, formatTaka } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("housing.rent");
  return { title: t("title") };
}

const DAY = 86_400_000;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY);

export default async function RentPage() {
  await requireOnboarded();
  const supabase = await createClient();
  const [{ data, error }, t, tm, locale] = await Promise.all([
    supabase
      .from("rent_records")
      .select("*, payments:rent_payments(id, period_month, amount, paid_on, method, note)")
      .order("is_active", { ascending: false })
      .order("created_at", { ascending: false }),
    getTranslations("housing.rent"),
    getTranslations("wallet.add.methods"),
    getLocale(),
  ]);
  if (error) throw new Error(error.message);
  const records = data ?? [];
  const today = dhakaToday();
  const month = today.slice(0, 7);
  const monthLabel = formatDate(`${month}-01`, locale, { month: "long" });
  const year = today.slice(0, 4);

  return (
    <div className="grid gap-5">
      <PageHeader title={t("title")} description={t("subtitle")} actions={<AddRentRecordButton />} />
      <HousingTabs active="rent" />

      {records.length === 0 ? (
        <EmptyState icon={ReceiptText} title={t("empty")} body={t("emptyBody")} action={<AddRentRecordButton />} className="rounded-2xl border bg-card py-12" />
      ) : (
        <ul className="grid gap-4">
          {records.map((r) => {
            const payments = [...(r.payments ?? [])].sort((a, b) => b.period_month.localeCompare(a.period_month));
            const thisMonth = payments.find((p) => p.period_month.startsWith(month));
            const dueDate = `${month}-${String(r.rent_due_day).padStart(2, "0")}`;
            const daysLeft = daysBetween(today, dueDate);
            const paidThisYear = payments.filter((p) => p.period_month.startsWith(year)).reduce((s, p) => s + Number(p.amount), 0);
            const endsIn = r.agreement_end ? daysBetween(today, r.agreement_end) : null;
            const status = thisMonth ? "paid" : daysLeft < 0 ? "overdue" : daysLeft <= 3 ? "soon" : "upcoming";
            return (
              <li key={r.id} className={cn("rounded-2xl border bg-card", !r.is_active && "opacity-70")}>
                <div className="flex items-start gap-3 p-4 sm:p-5">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {r.title}
                      {!r.is_active && <ToneBadge tone="muted">{t("inactive")}</ToneBadge>}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t("rentLine", { amount: formatTaka(r.monthly_rent, locale), day: formatNumber(r.rent_due_day, locale) })}
                    </p>
                  </div>
                  <RentRecordMenu
                    recordId={r.id}
                    title={r.title}
                    initial={{
                      title: r.title,
                      landlordName: r.landlord_name ?? "",
                      landlordPhone: r.landlord_phone ?? "",
                      propertyAddress: r.property_address ?? "",
                      monthlyRent: Number(r.monthly_rent),
                      advancePaid: Number(r.advance_paid),
                      securityDeposit: Number(r.security_deposit),
                      rentDueDay: r.rent_due_day,
                      agreementStart: r.agreement_start ?? "",
                      agreementEnd: r.agreement_end ?? "",
                      noticePeriodDays: r.notice_period_days ?? "",
                      agreementNotes: r.agreement_notes ?? "",
                      isActive: r.is_active,
                    }}
                  />
                </div>

                {r.is_active && (
                  <div
                    className={cn(
                      "mx-4 flex flex-wrap items-center gap-3 rounded-xl border px-3 py-3 sm:mx-5",
                      status === "paid" && "border-mint/30 bg-mint-soft",
                      status === "overdue" && "border-coral/30 bg-coral-soft",
                      status === "soon" && "border-marigold/30 bg-marigold-soft",
                    )}
                  >
                    {status === "paid" ? (
                      <CheckCircle2 className="size-5 shrink-0 text-mint" aria-hidden="true" />
                    ) : status === "overdue" ? (
                      <AlarmClock className="size-5 shrink-0 text-coral" aria-hidden="true" />
                    ) : (
                      <CalendarClock className="size-5 shrink-0 text-marigold" aria-hidden="true" />
                    )}
                    <p className="min-w-0 flex-1 text-sm">
                      {status === "paid" && thisMonth
                        ? t("paidOn", {
                            month: monthLabel,
                            amount: formatTaka(thisMonth.amount, locale),
                            date: formatDate(thisMonth.paid_on, locale, { day: "numeric", month: "short" }),
                          })
                        : status === "overdue"
                          ? t("overdue", { month: monthLabel, days: formatNumber(-daysLeft, locale) })
                          : daysLeft === 0
                            ? t("dueToday", { month: monthLabel })
                            : t("dueIn", { month: monthLabel, days: formatNumber(daysLeft, locale) })}
                    </p>
                    {!thisMonth && (
                      <PayRentButton recordId={r.id} month={month} monthLabel={monthLabel} amount={Number(r.monthly_rent)} today={today} />
                    )}
                  </div>
                )}

                <dl className="grid grid-cols-2 gap-2 p-4 text-sm sm:grid-cols-4 sm:p-5">
                  <Fact label={t("advance")} value={formatTaka(r.advance_paid, locale)} />
                  <Fact label={t("deposit")} value={formatTaka(r.security_deposit, locale)} />
                  <Fact label={t("paidThisYear", { year: formatDate(today, locale, { year: "numeric" }) })} value={formatTaka(paidThisYear, locale)} />
                  <Fact
                    label={t("agreement")}
                    value={
                      r.agreement_end
                        ? t("until", { date: formatDate(r.agreement_end, locale, { day: "numeric", month: "short", year: "numeric" }) })
                        : t("noEnd")
                    }
                  />
                </dl>

                {endsIn !== null && endsIn >= 0 && endsIn <= 60 && (
                  <p className="mx-4 mb-4 flex items-start gap-2 rounded-xl bg-marigold-soft px-3 py-2 text-sm sm:mx-5">
                    <BellRing className="mt-0.5 size-4 shrink-0 text-marigold" aria-hidden="true" />
                    {t("endsSoon", {
                      days: formatNumber(endsIn, locale),
                      notice: r.notice_period_days ? formatNumber(r.notice_period_days, locale) : "—",
                    })}
                  </p>
                )}

                <div className="grid gap-3 border-t p-4 sm:p-5">
                  {(r.landlord_name || r.landlord_phone || r.property_address) && (
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      {r.landlord_name && <span>{t("landlord", { name: r.landlord_name })}</span>}
                      {r.landlord_phone && (
                        <a href={`tel:${r.landlord_phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
                          <Phone className="size-3.5" aria-hidden="true" />
                          {r.landlord_phone}
                        </a>
                      )}
                      {r.property_address && <span>{r.property_address}</span>}
                    </p>
                  )}
                  {r.agreement_notes && (
                    <details className="rounded-xl bg-muted/50 p-3 text-sm">
                      <summary className="flex cursor-pointer items-center gap-2 font-medium">
                        <FileText className="size-4" aria-hidden="true" />
                        {t("notes")}
                      </summary>
                      <p className="mt-2 whitespace-pre-line text-muted-foreground">{r.agreement_notes}</p>
                    </details>
                  )}
                  <div>
                    <h3 className="mb-2 text-sm font-medium">{t("history")}</h3>
                    {payments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t("noPayments")}</p>
                    ) : (
                      <ul className="grid gap-1">
                        {payments.slice(0, 12).map((p) => {
                          const label = formatDate(p.period_month, locale, { month: "long", year: "numeric" });
                          return (
                            <li key={p.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/50">
                              <span className="min-w-0 flex-1 truncate">{label}</span>
                              <span className="text-xs text-muted-foreground">
                                {tm(p.method)} · {formatDate(p.paid_on, locale, { day: "numeric", month: "short" })}
                              </span>
                              <span className="num font-medium">{formatTaka(p.amount, locale)}</span>
                              <DeletePaymentButton paymentId={p.id} label={t("removePayment", { month: label })} />
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <BellRing className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        {t("reminderNote")}
      </p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-muted/50 px-3 py-2.5">
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate font-medium">{value}</dd>
    </div>
  );
}

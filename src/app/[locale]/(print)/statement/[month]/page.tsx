import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { LogoMark } from "@/components/brand/logo";
import { PrintButton } from "@/components/shared/print-button";
import { Link } from "@/i18n/navigation";
import { requireMember } from "@/lib/dal";
import { formatDate, formatNumber, formatTaka } from "@/lib/format";
import { monthParam, parseMonth } from "@/lib/month";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("statementPage");
  return { title: t("metaTitle"), robots: { index: false } };
}

/**
 * Printable monthly statement. "Save as PDF" in the browser's print dialog keeps
 * Bangla conjuncts intact (PDF libraries break them).
 */
export default async function StatementPage({ params }: PageProps<"/[locale]/statement/[month]">) {
  const member = await requireMember();
  const month = parseMonth((await params).month);
  const messId = member.membership.mess_id;
  const supabase = await createClient();

  const [messRes, closingRes, statementRes, ledgerRes, roomRes, t, tl, locale] = await Promise.all([
    supabase.from("messes").select("name, address").eq("id", messId).single(),
    supabase.from("monthly_closings").select("*").eq("mess_id", messId).eq("period_month", month).maybeSingle(),
    supabase.from("member_statements").select("*").eq("user_id", member.id).eq("period_month", month).maybeSingle(),
    supabase
      .from("ledger_entries")
      .select("id, entry_type, amount, description, created_at")
      .eq("user_id", member.id)
      .eq("mess_id", messId)
      .eq("period_month", month)
      .order("created_at"),
    supabase.from("mess_members").select("seat_label, room:mess_rooms(room_label)").eq("id", member.membership.id).single(),
    getTranslations("statementPage"),
    getTranslations("ledgerTypes"),
    getLocale(),
  ]);

  const mess = messRes.data;
  const closing = closingRes.data;
  const s = statementRes.data;
  const monthLabel = formatDate(month, locale, { month: "long", year: "numeric" });

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 print:max-w-none print:p-0">
      <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
        <Link href={`/billing?month=${monthParam(month)}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("back")}
        </Link>
        {s && <PrintButton />}
      </div>

      <article className="rounded-2xl border bg-card p-6 sm:p-8 print:rounded-none print:border-0 print:p-0">
        <header className="flex items-start justify-between gap-4 border-b pb-5">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{t("heading")}</p>
            <h1 className="mt-1 text-2xl font-bold">{monthLabel}</h1>
            <p className="mt-1 text-sm">{mess?.name}</p>
            {mess?.address && <p className="text-xs text-muted-foreground">{mess.address}</p>}
          </div>
          <div className="flex items-center gap-2">
            <LogoMark className="size-9" />
            <span className="text-sm font-semibold">MessMate BD</span>
          </div>
        </header>

        <section className="grid gap-1 border-b py-4 text-sm sm:grid-cols-2">
          <p>
            <span className="text-muted-foreground">{t("member")}: </span>
            <span className="font-medium">{member.context.profile?.full_name}</span>
          </p>
          {member.context.profile?.phone && (
            <p>
              <span className="text-muted-foreground">{t("phone")}: </span>
              {member.context.profile.phone}
            </p>
          )}
          {roomRes.data?.room?.room_label && (
            <p>
              <span className="text-muted-foreground">{t("room")}: </span>
              {roomRes.data.room.room_label}
              {roomRes.data.seat_label ? ` · ${roomRes.data.seat_label}` : ""}
            </p>
          )}
          {closing && (
            <p>
              <span className="text-muted-foreground">{t("closedOn")}: </span>
              {formatDate(closing.closed_at, locale, { day: "numeric", month: "long", year: "numeric" })}
            </p>
          )}
        </section>

        {!s || !closing ? (
          <p className="py-10 text-center text-muted-foreground">{t("notAvailable")}</p>
        ) : (
          <>
            <table className="mt-5 w-full text-sm">
              <tbody>
                {[
                  [t("opening"), s.opening_balance],
                  [t("deposits"), s.deposits],
                  [t("meals", { units: formatNumber(s.meal_units, locale, 2), rate: formatTaka(closing.meal_rate, locale) }), -s.meal_cost],
                  [t("bills"), -s.bill_cost],
                  [t("other"), s.other_net],
                ].map(([label, value]) => (
                  <tr key={String(label)} className="border-b">
                    <td className="py-2.5 pr-4">{label}</td>
                    <td className="num py-2.5 text-right">{formatTaka(Number(value), locale)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="py-3 pr-4 font-semibold">{t("closing")}</td>
                  <td className="num py-3 text-right text-lg font-bold">{formatTaka(s.closing_balance, locale)}</td>
                </tr>
              </tbody>
            </table>

            <section className="mt-6 rounded-xl bg-muted/60 p-4 text-xs leading-relaxed print:bg-transparent print:p-0">
              <p className="mb-1 font-semibold">{t("messSummary")}</p>
              <p>
                {t("messLine", {
                  units: formatNumber(closing.total_meal_units, locale, 2),
                  bazar: formatTaka(closing.total_meal_expense, locale),
                  rate: formatTaka(closing.meal_rate, locale),
                  shared: formatTaka(closing.total_shared_expense, locale),
                  members: formatNumber(closing.member_count, locale),
                })}
              </p>
            </section>

            <h2 className="mb-2 mt-8 font-semibold">{t("transactions")}</h2>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-2 font-medium">{t("date")}</th>
                  <th className="py-2 pr-2 font-medium">{t("type")}</th>
                  <th className="py-2 pr-2 font-medium">{t("details")}</th>
                  <th className="py-2 text-right font-medium">{t("amount")}</th>
                </tr>
              </thead>
              <tbody>
                {(ledgerRes.data ?? []).map((row) => (
                  <tr key={row.id} className="border-b align-top">
                    <td className="py-1.5 pr-2 whitespace-nowrap">{formatDate(row.created_at, locale)}</td>
                    <td className="py-1.5 pr-2">{tl(row.entry_type)}</td>
                    <td className="py-1.5 pr-2">{row.description}</td>
                    <td className="num py-1.5 text-right whitespace-nowrap">{formatTaka(row.amount, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <footer className="mt-8 border-t pt-4 text-[11px] text-muted-foreground">{t("footer")}</footer>
      </article>
    </main>
  );
}

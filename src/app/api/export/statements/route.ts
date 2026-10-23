import { getTranslations } from "next-intl/server";
import type { NextRequest } from "next/server";
import { csvResponse, toCsv } from "@/lib/csv";
import { monthParam, parseMonth } from "@/lib/month";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/export/statements?month=2026-09[&locale=bn|en]
 * Every member's closed statement for one month (managers; RLS hides other
 * members' rows from everyone else, so a member just gets their own line).
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const month = parseMonth(params.get("month"));
  const locale = params.get("locale") === "en" ? "en" : "bn";

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new Response("Unauthorized", { status: 401 });

  const { data, error } = await supabase
    .from("member_statements")
    .select("opening_balance, deposits, meal_units, meal_cost, bill_cost, other_net, closing_balance, member:profiles!member_statements_user_id_fkey(full_name, phone)")
    .eq("period_month", month)
    .order("closing_balance");
  if (error) return new Response("Could not export", { status: 500 });

  const t = await getTranslations({ locale, namespace: "export" });
  const money = (v: number | string) => Number(v).toFixed(2);
  const csv = toCsv([
    [t("member"), t("phone"), t("opening"), t("deposits"), t("mealUnits"), t("mealCost"), t("bills"), t("other"), t("closing")],
    ...(data ?? []).map((s) => [
      s.member?.full_name,
      s.member?.phone,
      money(s.opening_balance),
      money(s.deposits),
      Number(s.meal_units).toFixed(2),
      money(s.meal_cost),
      money(s.bill_cost),
      money(s.other_net),
      money(s.closing_balance),
    ]),
  ]);
  return csvResponse(csv, `messmate-statements-${monthParam(month)}.csv`);
}

import { getTranslations } from "next-intl/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { csvResponse, toCsv } from "@/lib/csv";
import { formatDate } from "@/lib/format";
import { monthParam, parseMonth } from "@/lib/month";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/export/ledger?month=2026-10[&user=<uuid>][&locale=bn|en]
 * Your own ledger for a month as CSV. Managers may pass ?user= for a member of
 * their mess; RLS returns nothing for anyone else.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const month = parseMonth(params.get("month"));
  const locale = params.get("locale") === "en" ? "en" : "bn";

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new Response("Unauthorized", { status: 401 });

  const requested = params.get("user");
  const userId = requested && z.uuid().safeParse(requested).success ? requested : auth.user.id;

  const { data, error } = await supabase
    .from("ledger_entries")
    .select("created_at, entry_type, description, amount")
    .eq("user_id", userId)
    .eq("period_month", month)
    .order("created_at");
  if (error) return new Response("Could not export", { status: 500 });

  const t = await getTranslations({ locale, namespace: "export" });
  const types = await getTranslations({ locale, namespace: "ledgerTypes" });
  const rows = (data ?? []).map((r) => [
    formatDate(r.created_at, "en", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }),
    types(r.entry_type),
    r.description,
    Number(r.amount).toFixed(2),
  ]);
  const total = (data ?? []).reduce((sum, r) => sum + Number(r.amount), 0);

  const csv = toCsv([
    [t("date"), t("type"), t("description"), t("amount")],
    ...rows,
    [],
    ["", "", t("net"), total.toFixed(2)],
  ]);
  return csvResponse(csv, `messmate-ledger-${monthParam(month)}.csv`);
}

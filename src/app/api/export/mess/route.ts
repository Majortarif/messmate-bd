import { getTranslations } from "next-intl/server";
import type { NextRequest } from "next/server";
import { csvResponse, MESS_EXPORTS, type MessExport, toCsv } from "@/lib/csv";
import { formatDate } from "@/lib/format";
import { monthParam, parseMonth, shiftMonth } from "@/lib/month";
import { createClient } from "@/lib/supabase/server";
import type { MyContext } from "@/types/app";

type Cell = string | number | null | undefined;

const PAGE = 1000; // PostgREST returns at most this many rows per request

/** Read every page of a query (an "all time" backup can pass 1,000 rows). */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

const stamp = (v: string | null | undefined) =>
  v ? formatDate(v, "en", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }) : "";
const day = (v: string | null | undefined) => (v ? formatDate(v, "en", { year: "numeric", month: "2-digit", day: "2-digit" }) : "");
const money = (v: number | string | null | undefined) => Number(v ?? 0).toFixed(2);

/**
 * GET /api/export/mess?dataset=ledger&month=2026-10|all[&locale=bn|en]
 * A manager's backup of their mess's records as CSV, one dataset at a time.
 * RLS already limits every query to the caller's own mess; the manager check
 * here just gives everyone else a clear 403 instead of an empty file.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const dataset = params.get("dataset") as MessExport;
  if (!MESS_EXPORTS.includes(dataset)) return new Response("Unknown dataset", { status: 400 });
  const all = params.get("month") === "all";
  const month = parseMonth(params.get("month"));
  const next = shiftMonth(month, 1);
  const locale = params.get("locale") === "en" ? "en" : "bn";

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new Response("Unauthorized", { status: 401 });
  const { data: ctx } = await supabase.rpc("get_my_context");
  const membership = (ctx as unknown as MyContext | null)?.membership;
  if (!membership || membership.role !== "manager" || membership.status !== "active") {
    return new Response("Forbidden", { status: 403 });
  }
  const messId = membership.mess_id;
  // Dhaka midnight boundaries for timestamp columns
  const from = `${month}T00:00:00+06:00`;
  const to = `${next}T00:00:00+06:00`;

  const [t, tl, tb, te, ts, tr, tm, tst, tsp, tpay, tbs, trq] = await Promise.all([
    getTranslations({ locale, namespace: "export" }),
    getTranslations({ locale, namespace: "ledgerTypes" }),
    getTranslations({ locale, namespace: "billTypes" }),
    getTranslations({ locale, namespace: "expenseCategories" }),
    getTranslations({ locale, namespace: "slots" }),
    getTranslations({ locale, namespace: "roles" }),
    getTranslations({ locale, namespace: "wallet.add.methods" }),
    getTranslations({ locale, namespace: "memberStatus" }),
    getTranslations({ locale, namespace: "billing.split" }),
    getTranslations({ locale, namespace: "manage.expenses.payer" }),
    getTranslations({ locale, namespace: "manage.bills.status" }),
    getTranslations({ locale, namespace: "manage.approvals.status" }),
  ]);

  let rows: Cell[][];
  try {
    switch (dataset) {
      case "members": {
        const [members, balances] = await Promise.all([
          fetchAll((a, b) =>
            supabase
              .from("mess_members")
              .select(
                "role, status, seat_label, joined_at, left_at, room:mess_rooms(room_label), profile:profiles!mess_members_user_id_fkey(full_name, phone, email), user_id",
              )
              .eq("mess_id", messId)
              .in("status", ["active", "inactive", "left"])
              .order("created_at")
              .range(a, b),
          ),
          supabase.from("member_balances").select("user_id, balance").eq("mess_id", messId),
        ]);
        const balance = new Map((balances.data ?? []).map((r) => [r.user_id, r.balance]));
        rows = [
          [t("member"), t("phone"), t("email"), t("room"), t("seat"), t("role"), t("status"), t("joined"), t("left"), t("balance")],
          ...members.map((m) => [
            m.profile?.full_name,
            m.profile?.phone,
            m.profile?.email,
            m.room?.room_label,
            m.seat_label,
            tr(m.role),
            tst(m.status),
            day(m.joined_at),
            day(m.left_at),
            money(balance.get(m.user_id)),
          ]),
        ];
        break;
      }
      case "ledger": {
        const entries = await fetchAll((a, b) => {
          let q = supabase
            .from("ledger_entries")
            .select("created_at, period_month, entry_type, description, amount, member:profiles!ledger_entries_user_id_fkey(full_name)")
            .eq("mess_id", messId);
          if (!all) q = q.eq("period_month", month);
          return q.order("created_at").range(a, b);
        });
        const total = entries.reduce((sum, e) => sum + Number(e.amount), 0);
        rows = [
          [t("date"), t("month"), t("member"), t("type"), t("description"), t("amount")],
          ...entries.map((e) => [stamp(e.created_at), monthParam(e.period_month), e.member?.full_name, tl(e.entry_type), e.description, money(e.amount)]),
          [],
          ["", "", "", "", t("net"), money(total)],
        ];
        break;
      }
      case "deposits": {
        const requests = await fetchAll((a, b) => {
          let q = supabase
            .from("deposit_requests")
            .select(
              "created_at, amount, method, trx_id, sender_number, paid_at, note, status, reviewed_at, review_note, member:profiles!deposit_requests_user_id_fkey(full_name)",
            )
            .eq("mess_id", messId);
          if (!all) q = q.gte("created_at", from).lt("created_at", to);
          return q.order("created_at").range(a, b);
        });
        rows = [
          [t("date"), t("member"), t("method"), t("trxId"), t("sender"), t("paidAt"), t("amount"), t("status"), t("reviewedAt"), t("note")],
          ...requests.map((r) => [
            stamp(r.created_at),
            r.member?.full_name,
            tm(r.method),
            r.trx_id,
            r.sender_number,
            stamp(r.paid_at),
            money(r.amount),
            trq(r.status),
            stamp(r.reviewed_at),
            [r.note, r.review_note].filter(Boolean).join(" · "),
          ]),
        ];
        break;
      }
      case "expenses": {
        const expenses = await fetchAll((a, b) => {
          let q = supabase
            .from("expenses")
            .select("expense_date, category, description, amount, paid_from, receipt_path, payer:profiles!expenses_paid_by_fkey(full_name)")
            .eq("mess_id", messId);
          if (!all) q = q.gte("expense_date", month).lt("expense_date", next);
          return q.order("expense_date").range(a, b);
        });
        const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
        rows = [
          [t("date"), t("category"), t("description"), t("amount"), t("paidFrom"), t("paidBy"), t("receipt")],
          ...expenses.map((e) => [
            day(e.expense_date),
            te(e.category),
            e.description,
            money(e.amount),
            tpay(`${e.paid_from}.title`),
            e.payer?.full_name,
            e.receipt_path ? t("yes") : t("no"),
          ]),
          [],
          ["", "", t("net"), money(total)],
        ];
        break;
      }
      case "bills": {
        const bills = await fetchAll((a, b) => {
          let q = supabase
            .from("bills")
            .select(
              "period_month, bill_type, description, total_amount, split_mode, status, due_date, posted_at, void_reason, shares:bill_shares(amount, member:profiles!bill_shares_user_id_fkey(full_name))",
            )
            .eq("mess_id", messId);
          if (!all) q = q.eq("period_month", month);
          return q.order("period_month").order("created_at").range(a, b);
        });
        rows = [
          [t("month"), t("billType"), t("description"), t("total"), t("split"), t("status"), t("dueDate"), t("postedAt"), t("shares")],
          ...bills.map((b) => [
            monthParam(b.period_month),
            tb(b.bill_type),
            [b.description, b.void_reason].filter(Boolean).join(" · "),
            money(b.total_amount),
            tsp(b.split_mode),
            tbs(b.status),
            day(b.due_date),
            stamp(b.posted_at),
            (b.shares ?? []).map((s) => `${s.member?.full_name ?? "—"}: ${money(s.amount)}`).join("; "),
          ]),
        ];
        break;
      }
      case "meals": {
        const orders = await fetchAll((a, b) => {
          let q = supabase
            .from("meal_orders")
            .select(
              "status, guest_count, charged_amount, created_at, menu:menus!meal_orders_menu_id_mess_id_fkey!inner(menu_date, slot, price), member:profiles!meal_orders_user_id_fkey(full_name)",
            )
            .eq("mess_id", messId);
          if (!all) q = q.gte("menu.menu_date", month).lt("menu.menu_date", next);
          return q.order("created_at").range(a, b);
        });
        orders.sort((x, y) => (x.menu.menu_date + x.menu.slot).localeCompare(y.menu.menu_date + y.menu.slot));
        rows = [
          [t("date"), t("slot"), t("member"), t("status"), t("guests"), t("price"), t("charged")],
          ...orders.map((o) => [
            day(o.menu.menu_date),
            ts(o.menu.slot),
            o.member?.full_name,
            t(o.status),
            o.guest_count,
            money(o.menu.price),
            o.charged_amount === null ? "" : money(o.charged_amount),
          ]),
        ];
        break;
      }
    }
  } catch {
    return new Response("Could not export", { status: 500 });
  }

  return csvResponse(toCsv(rows), `messmate-${dataset}-${all ? "all" : monthParam(month)}.csv`);
}

import { Lock } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BillManager, type BillRow } from "@/components/manage/bills";
import { MonthNav } from "@/components/shared/month-nav";
import { PageHeader } from "@/components/shared/states";
import { requireManager } from "@/lib/dal";
import { parseMonth } from "@/lib/month";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("manage.bills");
  return { title: t("title") };
}

export default async function BillsPage({ searchParams }: PageProps<"/[locale]/manage/bills">) {
  const manager = await requireManager();
  const messId = manager.membership.mess_id;
  const month = parseMonth((await searchParams).month);
  const supabase = await createClient();

  const [billsRes, membersRes, roomsRes, closingRes, t] = await Promise.all([
    supabase
      .from("bills")
      .select(
        "id, bill_type, total_amount, split_mode, due_date, description, status, void_reason, bill_shares(user_id, amount, member:profiles!bill_shares_user_id_fkey(full_name))",
      )
      .eq("mess_id", messId)
      .eq("period_month", month)
      .order("created_at"),
    supabase
      .from("mess_members")
      .select("user_id, room_id, profile:profiles!mess_members_user_id_fkey(full_name)")
      .eq("mess_id", messId)
      .in("status", ["active", "inactive"])
      .order("joined_at"),
    supabase.from("mess_rooms").select("id, monthly_rent").eq("mess_id", messId),
    supabase.from("monthly_closings").select("id").eq("mess_id", messId).eq("period_month", month).maybeSingle(),
    getTranslations("manage.bills"),
  ]);

  const bills: BillRow[] = (billsRes.data ?? []).map((b) => ({
    id: b.id,
    type: b.bill_type,
    total: Number(b.total_amount),
    split: b.split_mode,
    dueDate: b.due_date,
    description: b.description,
    status: b.status,
    voidReason: b.void_reason,
    shares: b.bill_shares.map((s) => ({ userId: s.user_id, name: s.member?.full_name || "—", amount: Number(s.amount) })),
  }));
  const members = membersRes.data ?? [];
  // rent of rooms that currently have someone in them (what a by-room bill will charge)
  const occupied = new Set(members.map((m) => m.room_id).filter(Boolean));
  const roomRentTotal = (roomsRes.data ?? []).filter((r) => occupied.has(r.id)).reduce((s, r) => s + Number(r.monthly_rent), 0);
  const closed = Boolean(closingRes.data);

  return (
    <div className="grid gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} actions={<MonthNav month={month} path="/manage/bills" allowFuture />} />
      {closed && (
        <p className="flex items-center gap-2 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          <Lock className="size-4" aria-hidden="true" />
          {t("closed")}
        </p>
      )}
      <BillManager
        messId={messId}
        month={month}
        bills={bills}
        closed={closed}
        roomRentTotal={roomRentTotal}
        members={members.map((m) => ({ userId: m.user_id, name: m.profile?.full_name || "—" }))}
      />
    </div>
  );
}

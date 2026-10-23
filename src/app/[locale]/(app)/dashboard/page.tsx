import { ArrowRight, BellRing, Home } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { ChoresCard, MealsCard, MonthCard, NoticesCard, TransactionsCard, WalletCard } from "@/components/dashboard/cards";
import { InviteCard } from "@/components/manage/invite-card";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requireMember } from "@/lib/dal";
import { dhakaHour, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { MemberDashboard } from "@/types/app";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("dashboard") };
}

function greetingKey(hour: number) {
  if (hour < 5) return "night";
  if (hour < 12) return "morning";
  if (hour < 15) return "noon";
  if (hour < 18) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}

export default async function DashboardPage() {
  const member = await requireMember();
  const isManager = member.membership.role === "manager" && member.membership.status === "active";
  const supabase = await createClient();
  const [dashboard, t, locale, managerInfo] = await Promise.all([
    supabase.rpc("get_member_dashboard"),
    getTranslations("dashboard"),
    getLocale(),
    isManager
      ? Promise.all([
          supabase.from("mess_members").select("id", { count: "exact", head: true }).eq("status", "pending"),
          supabase.from("deposit_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
          supabase.from("messes").select("id, name, invite_code, invite_enabled").eq("id", member.membership.mess_id).single(),
          supabase.from("mess_members").select("id", { count: "exact", head: true }).eq("status", "active"),
        ])
      : null,
  ]);

  if (dashboard.error) throw new Error(dashboard.error.message);
  const data = dashboard.data as unknown as MemberDashboard;
  const firstName = member.context.profile?.full_name?.split(" ")[0] ?? "";
  const room = data.membership.room;
  const [pendingRequests, pendingDeposits, mess, activeMembers] = managerInfo ?? [];

  return (
    <div className="grid gap-6">
      <div className="animate-fade-up">
        <p className="text-sm text-muted-foreground">{formatDate(data.today, locale, { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{t(`greeting.${greetingKey(dhakaHour())}`, { name: firstName })}</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Home className="size-4" aria-hidden="true" />
          {room ? t("roomLine", { room: room.label, mess: data.mess.name }) : data.mess.name}
        </p>
      </div>

      {isManager && ((pendingRequests?.count ?? 0) > 0 || (pendingDeposits?.count ?? 0) > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-marigold/30 bg-marigold-soft px-4 py-3">
          <p className="flex items-center gap-2 text-sm">
            <BellRing className="size-4 text-marigold" aria-hidden="true" />
            {t("manager.pending", { requests: pendingRequests?.count ?? 0, deposits: pendingDeposits?.count ?? 0 })}
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href={(pendingDeposits?.count ?? 0) > 0 ? "/manage/approvals" : "/manage/members"}>
              {t("manager.review")}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid gap-4 lg:col-span-2">
          <WalletCard data={data} />
          <MealsCard data={data} />
        </div>
        <div className="grid content-start gap-4">
          <MonthCard data={data} />
          {isManager && mess?.data && (activeMembers?.count ?? 0) < 4 && (
            <InviteCard
              compact
              messId={mess.data.id}
              messName={mess.data.name}
              code={mess.data.invite_code}
              enabled={mess.data.invite_enabled}
            />
          )}
          <NoticesCard data={data} />
          <ChoresCard data={data} />
        </div>
      </div>

      <TransactionsCard data={data} />
    </div>
  );
}

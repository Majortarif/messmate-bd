import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { MenuBoard, type BoardMenu } from "@/components/manage/menu-board";
import { PageHeader } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requireManager } from "@/lib/dal";
import { dhakaToday, formatDate } from "@/lib/format";
import { addDays, dayRange, parseDate, weekStart } from "@/lib/month";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("manage.menu");
  return { title: t("title") };
}

export default async function ManageMenuPage({ searchParams }: PageProps<"/[locale]/manage/menu">) {
  const manager = await requireManager();
  const messId = manager.membership.mess_id;
  const start = weekStart(parseDate((await searchParams).week));
  const days = dayRange(start, 7);
  const supabase = await createClient();

  const [menusRes, prevRes, settingsRes, membersRes, t, locale] = await Promise.all([
    supabase
      .from("menus")
      .select("id, menu_date, slot, items, price, cutoff_at, is_locked, meal_orders(user_id, status, guest_count)")
      .eq("mess_id", messId)
      .gte("menu_date", days[0])
      .lte("menu_date", days[6]),
    supabase
      .from("menus")
      .select("menu_date, slot, items")
      .eq("mess_id", messId)
      .gte("menu_date", addDays(start, -7))
      .lt("menu_date", start),
    supabase.from("mess_settings").select("breakfast_price, lunch_price, dinner_price").eq("mess_id", messId).single(),
    supabase
      .from("mess_members")
      .select("user_id, profile:profiles!mess_members_user_id_fkey(full_name)")
      .eq("mess_id", messId)
      .eq("status", "active")
      .order("joined_at"),
    getTranslations("manage.menu"),
    getLocale(),
  ]);

  const menus: BoardMenu[] = (menusRes.data ?? []).map((m) => ({
    id: m.id,
    date: m.menu_date,
    slot: m.slot,
    items: m.items,
    price: Number(m.price ?? 0),
    cutoffAt: m.cutoff_at,
    locked: m.is_locked,
    orders: m.meal_orders.map((o) => ({ userId: o.user_id, status: o.status, guests: o.guest_count })),
  }));
  const settings = settingsRes.data;
  const thisWeek = weekStart(dhakaToday()) === start;

  return (
    <div className="grid gap-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <div className="flex items-center gap-1 rounded-xl border bg-card p-1">
            <Button asChild variant="ghost" size="icon-sm" aria-label={t("prevWeek")}>
              <Link href={`/manage/menu?week=${addDays(start, -7)}`}>
                <ChevronLeft className="size-4" />
              </Link>
            </Button>
            <span className="min-w-36 text-center text-sm font-semibold">
              {thisWeek
                ? t("thisWeek")
                : `${formatDate(days[0], locale, { day: "numeric", month: "short" })} – ${formatDate(days[6], locale, { day: "numeric", month: "short" })}`}
            </span>
            <Button asChild variant="ghost" size="icon-sm" aria-label={t("nextWeek")}>
              <Link href={`/manage/menu?week=${addDays(start, 7)}`}>
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          </div>
        }
      />
      <MenuBoard
        key={start}
        messId={messId}
        days={days}
        menus={menus}
        previousWeek={(prevRes.data ?? []).map((p) => ({ offsetDate: addDays(p.menu_date, 7), slot: p.slot, items: p.items }))}
        defaultPrices={{
          breakfast: Number(settings?.breakfast_price ?? 0),
          lunch: Number(settings?.lunch_price ?? 0),
          dinner: Number(settings?.dinner_price ?? 0),
        }}
        members={(membersRes.data ?? []).map((m) => ({ userId: m.user_id, name: m.profile?.full_name || "—" }))}
      />
    </div>
  );
}

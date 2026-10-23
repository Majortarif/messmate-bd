import { Bell, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { NotificationActions } from "@/components/app/notification-actions";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { Link } from "@/i18n/navigation";
import { requireViewer } from "@/lib/dal";
import { dhakaToday, formatDate, formatTime, toDhakaDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notifications");
  return { title: t("title") };
}

export default async function NotificationsPage() {
  await requireViewer();
  const supabase = await createClient();
  const [{ data, error }, t, locale] = await Promise.all([
    supabase.from("notifications").select("id, title, body, link, read_at, created_at").order("created_at", { ascending: false }).limit(100),
    getTranslations("notifications"),
    getLocale(),
  ]);
  if (error) throw new Error(error.message);
  const items = data ?? [];
  const unread = items.filter((n) => !n.read_at).length;
  const today = dhakaToday();

  // group by Dhaka day
  const groups: { day: string; items: typeof items }[] = [];
  for (const n of items) {
    const day = toDhakaDate(n.created_at);
    const last = groups.at(-1);
    if (last?.day === day) last.items.push(n);
    else groups.push({ day, items: [n] });
  }

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-5">
      <PageHeader
        title={t("title")}
        description={unread > 0 ? t("unreadCount", { count: unread }) : t("allRead")}
        actions={<NotificationActions unread={unread} read={items.length - unread} />}
      />
      {items.length === 0 ? (
        <EmptyState icon={Bell} title={t("empty")} body={t("emptyBody")} className="rounded-2xl border bg-card py-12" />
      ) : (
        groups.map((g) => (
          <section key={g.day} className="grid gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {g.day === today ? t("today") : formatDate(g.items[0].created_at, locale, { weekday: "long", day: "numeric", month: "long" })}
            </h2>
            <ul className="grid gap-1.5">
              {g.items.map((n) => {
                const content = (
                  <>
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-primary")} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm", !n.read_at && "font-semibold")}>{n.title}</span>
                      {n.body && <span className="block text-sm text-muted-foreground">{n.body}</span>}
                      <span className="mt-0.5 block text-xs text-muted-foreground">{formatTime(n.created_at, locale)}</span>
                    </span>
                    {n.link && <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                  </>
                );
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link href={n.link} className={cn("flex gap-3 rounded-xl border bg-card px-3 py-3 hover:bg-accent/50", !n.read_at && "border-primary/30")}>
                        {content}
                      </Link>
                    ) : (
                      <div className={cn("flex gap-3 rounded-xl border bg-card px-3 py-3", !n.read_at && "border-primary/30")}>{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
      <p className="text-center text-xs text-muted-foreground">{t("retention")}</p>
    </div>
  );
}

"use client";

import { Bell, BellOff, CheckCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { isReadyRoute } from "@/components/app/nav";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

type Notification = Pick<Tables<"notifications">, "id" | "title" | "body" | "link" | "type" | "read_at" | "created_at">;

/** Bell with unread badge; new notifications arrive live through Supabase Realtime (RLS applies). */
export function NotificationBell({ userId, initialUnread }: { userId: string; initialUnread: number }) {
  const t = useTranslations("notifications");
  const locale = useLocale();
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<Notification[] | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("notifications")
      .select("id, title, body, link, type, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    setItems(data ?? []);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          setUnread((n) => n + 1);
          setItems((list) => (list ? [payload.new as Notification, ...list].slice(0, 20) : list));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const markAllRead = async () => {
    setUnread(0);
    setItems((list) => list?.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })) ?? list);
    await createClient().rpc("mark_notifications_read", {});
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void load();
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={t("open", { count: unread })}>
          <Bell className="size-[19px]" />
          {unread > 0 && (
            <span className="num absolute right-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-coral px-1 text-[10px] font-bold leading-4 text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,380px)] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="font-semibold">{t("title")}</p>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead} className="h-8 text-xs text-primary">
              <CheckCheck className="size-4" aria-hidden="true" />
              {t("markAllRead")}
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[60dvh]">
          {items === null ? (
            <div className="grid gap-3 p-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <BellOff className="size-8 text-muted-foreground" aria-hidden="true" />
              <p className="font-medium">{t("empty")}</p>
              <p className="text-sm text-muted-foreground">{t("emptyBody")}</p>
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => {
                const content = (
                  <>
                    <span
                      className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-primary")}
                      aria-hidden="true"
                    />
                    <span className="grid min-w-0 gap-0.5">
                      <span className={cn("text-sm", !n.read_at && "font-semibold")}>{n.title}</span>
                      {n.body && <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>}
                      <span className="text-[11px] text-muted-foreground">
                        {formatDate(n.created_at, locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                      </span>
                    </span>
                  </>
                );
                return (
                  <li key={n.id}>
                    {n.link && isReadyRoute(n.link) ? (
                      <Link href={n.link} onClick={() => setOpen(false)} className="flex gap-3 px-4 py-3 hover:bg-accent/60">
                        {content}
                      </Link>
                    ) : (
                      <div className="flex gap-3 px-4 py-3">{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
        <Link
          href="/notifications"
          onClick={() => setOpen(false)}
          className="block border-t px-4 py-2.5 text-center text-sm font-medium text-primary hover:bg-accent/60"
        >
          {t("seeAll")}
        </Link>
      </PopoverContent>
    </Popover>
  );
}

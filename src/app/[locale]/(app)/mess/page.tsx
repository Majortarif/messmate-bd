import { Megaphone, Pin, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { MessTabs } from "@/components/mess/mess-tabs";
import { NewNoticeButton, NoticeMenu } from "@/components/mess/notices";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { ToneBadge } from "@/components/shared/tone-badge";
import { requireMember } from "@/lib/dal";
import { dhakaToday, formatDate, formatTime, toDhakaDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("mess.notices");
  return { title: t("title") };
}

/** Mess notice board; also served at /mess/notices (notification links). */
export default async function NoticeBoardPage() {
  const member = await requireMember();
  const isManager = member.membership.role === "manager" && member.membership.status === "active";
  const supabase = await createClient();
  const today = dhakaToday();
  const now = new Date().toISOString();
  const head = { count: "exact" as const, head: true };
  const [notices, openComplaints, openPolls, myDuties, t, tp, locale] = await Promise.all([
    supabase
      .from("notices")
      .select("id, title, body, priority, is_pinned, expires_at, created_at, author:profiles!notices_created_by_fkey(full_name)")
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(60),
    supabase.from("complaints").select("id", head).in("status", ["open", "in_progress"]),
    supabase.from("polls").select("id", head).eq("is_closed", false).or(`closes_at.is.null,closes_at.gt."${now}"`),
    supabase.from("chores").select("id", head).eq("assigned_to", member.id).eq("status", "pending").gte("due_date", today).lte("due_date", today),
    getTranslations("mess.notices"),
    getTranslations("priorities"),
    getLocale(),
  ]);
  if (notices.error) throw new Error(notices.error.message);
  const list = (notices.data ?? []).filter((n) => isManager || !n.expires_at || n.expires_at > now);

  return (
    <div className="grid gap-5">
      <PageHeader title={t("title")} description={t("subtitle", { mess: member.membership.mess_name })} actions={isManager ? <NewNoticeButton /> : null} />
      <MessTabs
        active="notices"
        counts={{ complaints: openComplaints.count ?? 0, polls: openPolls.count ?? 0, roster: myDuties.count ?? 0 }}
      />

      {list.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={t("empty")}
          body={isManager ? t("emptyManager") : t("emptyMember")}
          action={isManager ? <NewNoticeButton /> : undefined}
          className="rounded-2xl border bg-card py-12"
        />
      ) : (
        <ul className="grid gap-3">
          {list.map((n) => {
            const expired = Boolean(n.expires_at && n.expires_at <= now);
            return (
              <li
                key={n.id}
                className={cn(
                  "rounded-2xl border bg-card p-4 sm:p-5",
                  n.priority === "urgent" && "border-coral/40 bg-coral-soft",
                  n.priority === "high" && "border-marigold/40",
                  expired && "opacity-60",
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {n.is_pinned && (
                        <ToneBadge tone="mint">
                          <Pin className="size-3" aria-hidden="true" />
                          {t("pinnedBadge")}
                        </ToneBadge>
                      )}
                      {n.priority === "urgent" && (
                        <ToneBadge tone="coral">
                          <TriangleAlert className="size-3" aria-hidden="true" />
                          {tp("urgent")}
                        </ToneBadge>
                      )}
                      {n.priority === "high" && <ToneBadge tone="marigold">{tp("high")}</ToneBadge>}
                      {expired && <ToneBadge tone="muted">{t("expired")}</ToneBadge>}
                    </div>
                    <h2 className="mt-1.5 text-lg font-semibold leading-snug">{n.title}</h2>
                  </div>
                  {isManager && (
                    <NoticeMenu
                      id={n.id}
                      title={n.title}
                      initial={{
                        title: n.title,
                        body: n.body,
                        priority: n.priority,
                        isPinned: n.is_pinned,
                        expiresOn: n.expires_at ? toDhakaDate(n.expires_at) : "",
                      }}
                    />
                  )}
                </div>
                <p className="mt-2 whitespace-pre-line leading-relaxed">{n.body}</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {t("byline", {
                    name: n.author?.full_name || t("manager"),
                    date: `${formatDate(n.created_at, locale, { day: "numeric", month: "short" })}, ${formatTime(n.created_at, locale)}`,
                  })}
                  {n.expires_at && !expired && ` · ${t("until", { date: formatDate(n.expires_at, locale, { day: "numeric", month: "short" }) })}`}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

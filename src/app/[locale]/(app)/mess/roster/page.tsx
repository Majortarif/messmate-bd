import { Brush, ClipboardList, Droplets, ShoppingBasket, Trash, UtensilsCrossed, Wrench } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { MessTabs } from "@/components/mess/mess-tabs";
import { ChoreActions, RosterGenerator } from "@/components/mess/roster";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { ToneBadge } from "@/components/shared/tone-badge";
import { Link } from "@/i18n/navigation";
import { requireMember } from "@/lib/dal";
import { dhakaToday, formatDate } from "@/lib/format";
import { addDays, parseDate } from "@/lib/month";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("mess.roster");
  return { title: t("title") };
}

const ICONS = { bazar: ShoppingBasket, cleaning: Brush, cooking_help: UtensilsCrossed, garbage: Trash, water_filter: Droplets, other: Wrench };
const SPAN = 14;

export default async function RosterPage({ searchParams }: PageProps<"/[locale]/mess/roster">) {
  const member = await requireMember();
  const isManager = member.membership.role === "manager" && member.membership.status === "active";
  const sp = await searchParams;
  const today = dhakaToday();
  const from = sp.from ? parseDate(sp.from) : addDays(today, -1);
  const to = addDays(from, SPAN - 1);
  const mineOnly = sp.mine === "1";
  const supabase = await createClient();

  let query = supabase
    .from("chores")
    .select("id, chore_type, title, assigned_to, due_date, status, done_at, assignee:profiles!chores_assigned_to_fkey(full_name)")
    .gte("due_date", from)
    .lte("due_date", to)
    .order("due_date")
    .order("chore_type");
  if (mineOnly) query = query.eq("assigned_to", member.id);

  const [{ data, error }, membersRes, t, tc, ts, locale] = await Promise.all([
    query,
    supabase
      .from("mess_members")
      .select("user_id, profile:profiles!mess_members_user_id_fkey(full_name)")
      .eq("mess_id", member.membership.mess_id)
      .eq("status", "active")
      .order("joined_at"),
    getTranslations("mess.roster"),
    getTranslations("choreTypes"),
    getTranslations("choreStatus"),
    getLocale(),
  ]);
  if (error) throw new Error(error.message);
  const chores = data ?? [];
  const members = (membersRes.data ?? []).map((m) => ({ id: m.user_id, name: m.profile?.full_name || "—" }));

  const days: { date: string; items: typeof chores }[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push({ date: d, items: chores.filter((c) => c.due_date === d) });
  const shown = days.filter((d) => d.items.length > 0 || d.date === today);
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ from: sp.from as string | undefined, mine: mineOnly ? "1" : undefined, ...patch }).filter((e): e is [string, string] => Boolean(e[1])));
    return p.size ? `/mess/roster?${p}` : "/mess/roster";
  };

  return (
    <div className="grid gap-5">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={isManager && members.length > 0 ? <RosterGenerator members={members} today={today} /> : null}
      />
      <MessTabs active="roster" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-xl border bg-card p-1 text-sm">
          <Link href={qs({ from: addDays(from, -SPAN) })} className="rounded-lg px-3 py-1.5 hover:bg-accent">
            {t("earlier")}
          </Link>
          <span className="px-2 font-medium">
            {formatDate(from, locale, { day: "numeric", month: "short" })} – {formatDate(to, locale, { day: "numeric", month: "short" })}
          </span>
          <Link href={qs({ from: addDays(from, SPAN) })} className="rounded-lg px-3 py-1.5 hover:bg-accent">
            {t("later")}
          </Link>
        </div>
        <Link
          href={qs({ mine: mineOnly ? undefined : "1" })}
          aria-pressed={mineOnly}
          className={cn(
            "inline-flex h-10 items-center rounded-full border px-4 text-sm",
            mineOnly ? "border-primary/50 bg-mint-soft font-medium" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t("onlyMine")}
        </Link>
      </div>

      {chores.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={t("empty")}
          body={isManager ? t("emptyManager") : t("emptyMember")}
          action={isManager && members.length > 0 ? <RosterGenerator members={members} today={today} /> : undefined}
          className="rounded-2xl border bg-card py-12"
        />
      ) : (
        <ol className="grid gap-4">
          {shown.map((day) => (
            <li key={day.date}>
              <h2 className={cn("mb-2 text-sm font-semibold", day.date === today ? "text-primary" : "text-muted-foreground")}>
                {day.date === today ? `${t("today")} · ` : ""}
                {formatDate(day.date, locale, { weekday: "long", day: "numeric", month: "long" })}
              </h2>
              {day.items.length === 0 ? (
                <p className="rounded-xl border border-dashed px-3 py-3 text-sm text-muted-foreground">{t("nothingToday")}</p>
              ) : (
                <ul className="grid gap-2">
                  {day.items.map((c) => {
                    const Icon = ICONS[c.chore_type];
                    const mine = c.assigned_to === member.id;
                    return (
                      <li
                        key={c.id}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5",
                          mine && c.status === "pending" && "border-primary/40",
                          c.status !== "pending" && "opacity-70",
                        )}
                      >
                        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", mine ? "bg-mint-soft text-mint" : "bg-muted text-muted-foreground")}>
                          <Icon className="size-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={cn("truncate text-sm font-medium", c.status === "done" && "line-through")}>{c.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {tc(c.chore_type)} · {mine ? t("you") : c.assignee?.full_name || "—"}
                          </p>
                        </div>
                        {c.status !== "pending" && <ToneBadge tone={c.status === "done" ? "mint" : "muted"}>{ts(c.status)}</ToneBadge>}
                        <ChoreActions id={c.id} title={c.title} status={c.status} isAssignee={mine} isManager={isManager} members={members} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

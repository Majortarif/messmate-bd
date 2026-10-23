"use client";

import {
  Building2,
  CalendarCheck,
  ChevronDown,
  History,
  type LucideIcon,
  Receipt,
  Settings2,
  ShoppingCart,
  UserCog,
  Wallet,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { LoadingButton } from "@/components/shared/form";
import { EmptyState } from "@/components/shared/states";
import { loadActivity } from "@/lib/actions/admin";
import { formatDate, formatTaka, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ActivityCategory, ActivityEntry } from "@/types/app";

const ICONS: Record<string, LucideIcon> = {
  ledger_entries: Wallet,
  deposit_requests: Wallet,
  mess_members: UserCog,
  expenses: ShoppingCart,
  bills: Receipt,
  monthly_closings: CalendarCheck,
  mess_settings: Settings2,
  messes: Settings2,
  listings: Building2,
};

type Described = { key: string; values: Record<string, string> };
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

/** Turn one audit row into a sentence key + values (see messages: activity.events). */
function describe(e: ActivityEntry): Described {
  const d = e.data ?? {};
  const ch = e.changes ?? {};
  const changed = (field: string) => field in ch;
  const to = (field: string) => str(ch[field]?.[1]);
  const from = (field: string) => str(ch[field]?.[0]);

  switch (e.table) {
    case "ledger_entries":
      return { key: "ledger", values: { type: str(d.entry_type) } };
    case "deposit_requests":
      if (e.action === "INSERT") return { key: "depositRequested", values: { method: str(d.method) } };
      if (changed("status") && to("status") === "approved") return { key: "depositApproved", values: {} };
      if (changed("status") && to("status") === "rejected") return { key: "depositRejected", values: {} };
      return { key: "depositUpdated", values: {} };
    case "mess_members":
      if (e.action === "INSERT") return { key: str(d.status) === "pending" ? "memberRequested" : "memberJoined", values: {} };
      if (e.action === "DELETE") return { key: "memberDeleted", values: {} };
      if (changed("status")) {
        const next = to("status");
        if (from("status") === "pending") return { key: next === "active" ? "memberApproved" : "memberRejected", values: {} };
        if (next === "inactive") return { key: "memberPaused", values: {} };
        if (next === "active") return { key: "memberResumed", values: {} };
        if (next === "left") return { key: e.actor_id && e.actor_id === e.subject_id ? "memberLeft" : "memberRemoved", values: {} };
      }
      if (changed("role")) return { key: to("role") === "manager" ? "memberPromoted" : "memberDemoted", values: {} };
      if (changed("room_id") || changed("seat_label")) return { key: "memberRoom", values: {} };
      return { key: "memberUpdated", values: {} };
    case "expenses":
      return {
        key: e.action === "INSERT" ? "expenseAdded" : e.action === "DELETE" ? "expenseDeleted" : "expenseUpdated",
        values: { category: str(d.category) },
      };
    case "bills":
      if (e.action === "INSERT") return { key: "billCreated", values: { type: str(d.bill_type) } };
      if (e.action === "DELETE") return { key: "billDeleted", values: { type: str(d.bill_type) } };
      if (changed("status") && to("status") === "posted") return { key: "billPosted", values: { type: str(d.bill_type) } };
      if (changed("status") && to("status") === "void") return { key: "billVoided", values: { type: str(d.bill_type) } };
      return { key: "billUpdated", values: { type: str(d.bill_type) } };
    case "monthly_closings":
      return { key: "monthClosed", values: {} };
    case "mess_settings":
      return { key: e.action === "INSERT" ? "settingsCreated" : "settingsUpdated", values: {} };
    case "messes":
      if (e.action === "INSERT") return { key: "messCreated", values: {} };
      if (changed("is_active")) return { key: to("is_active") === "true" ? "messActivated" : "messDeactivated", values: {} };
      if (changed("invite_code")) return { key: "messInvite", values: {} };
      if (changed("invite_enabled")) return { key: to("invite_enabled") === "true" ? "inviteOn" : "inviteOff", values: {} };
      return { key: "messUpdated", values: {} };
    case "listings":
      return { key: "listingStatus", values: { status: to("status") || str(d.status), title: str(d.title) } };
    default:
      return { key: "other", values: {} };
  }
}

/** Short display of a changed value in the details panel. */
function shown(v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return s.length > 60 ? `${s.slice(0, 57)}…` : s;
}

export function ActivityLog({
  initial,
  messId,
  category,
  showMess = false,
}: {
  initial: ActivityEntry[];
  messId: string | null;
  category: ActivityCategory | null;
  showMess?: boolean;
}) {
  const t = useTranslations("activity");
  const te = useTranslations("errors");
  const locale = useLocale();
  const [entries, setEntries] = useState(initial);
  const [done, setDone] = useState(initial.length < 40);
  const [pending, startTransition] = useTransition();

  const loadMore = () =>
    startTransition(async () => {
      const last = entries.at(-1);
      if (!last) return;
      const result = await loadActivity({ messId, category, before: last.id });
      if (!result.ok) return void toast.error(te(result.error));
      setEntries((prev) => [...prev, ...result.data]);
      if (result.data.length < 40) setDone(true);
    });

  if (entries.length === 0) {
    return <EmptyState icon={History} title={t("empty")} body={t("emptyBody")} className="rounded-2xl border bg-card py-10" />;
  }

  // group by Dhaka day
  const groups: { day: string; items: ActivityEntry[] }[] = [];
  for (const e of entries) {
    const day = formatDate(e.created_at, "en-CA", { year: "numeric", month: "2-digit", day: "2-digit" });
    const group = groups.at(-1);
    if (group?.day === day) group.items.push(e);
    else groups.push({ day, items: [e] });
  }

  return (
    <div className="grid gap-5">
      {groups.map((g) => (
        <section key={g.day} aria-label={formatDate(g.items[0].created_at, locale, { weekday: "long", day: "numeric", month: "long" })}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {formatDate(g.items[0].created_at, locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </h2>
          <ol className="grid gap-2">
            {g.items.map((e) => (
              <ActivityItem key={e.id} entry={e} showMess={showMess} />
            ))}
          </ol>
        </section>
      ))}
      {done ? (
        <p className="py-2 text-center text-sm text-muted-foreground">{t("end")}</p>
      ) : (
        <LoadingButton variant="outline" loading={pending} onClick={loadMore} className="mx-auto w-fit">
          {t("loadMore")}
        </LoadingButton>
      )}
    </div>
  );
}

function ActivityItem({ entry: e, showMess }: { entry: ActivityEntry; showMess: boolean }) {
  const t = useTranslations("activity");
  const tl = useTranslations("ledgerTypes");
  const tm = useTranslations("wallet.add.methods");
  const tc = useTranslations("expenseCategories");
  const tb = useTranslations("billTypes");
  const tmod = useTranslations("moderationStatus");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const Icon = ICONS[e.table] ?? History;
  const d = e.data ?? {};
  const { key, values } = describe(e);
  // event keys are picked at runtime; every event message takes a subset of `labels`
  const sentence = t as unknown as (key: string, values: Record<string, string>) => string;

  const actor = e.actor_name ?? (e.actor_id ? t("someone") : t("system"));
  const subject = e.subject_name ?? t("someone");
  const amount = d.amount ?? d.total_amount;
  const labels: Record<string, string> = {
    actor,
    subject,
    amount: amount === undefined ? "" : formatTaka(Number(amount), locale),
    month: d.period_month ? formatDate(String(d.period_month), locale, { month: "long", year: "numeric" }) : "",
    rate: d.meal_rate !== undefined ? formatTaka(Number(d.meal_rate), locale) : "",
    type: values.type ? (e.table === "bills" ? tb(values.type as never) : tl(values.type as never)) : "",
    method: values.method ? tm(values.method as never) : "",
    category: values.category ? tc(values.category as never) : "",
    status: values.status ? tmod(values.status as never) : "",
    title: values.title ?? "",
  };
  const fields = Object.entries(e.changes ?? {});
  const tone =
    e.table === "ledger_entries" || e.table === "deposit_requests"
      ? "bg-sky-soft text-sky"
      : e.table === "mess_members"
        ? "bg-mint-soft text-mint"
        : e.table === "expenses" || e.table === "bills" || e.table === "monthly_closings"
          ? "bg-marigold-soft text-marigold"
          : "bg-muted text-muted-foreground";

  return (
    <li className="rounded-xl border bg-card px-3 py-2.5">
      <div className="flex items-start gap-3">
        <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg", tone)}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug">{sentence(`events.${key}`, labels)}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <time dateTime={e.created_at}>{formatTime(e.created_at, locale)}</time>
            {showMess && e.mess_name && <span className="truncate">· {e.mess_name}</span>}
            {d.description ? <span className="truncate">· {String(d.description)}</span> : null}
          </p>
        </div>
        {fields.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {t("details")}
            <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden="true" />
          </button>
        )}
      </div>
      {open && (
        <dl className="mt-2 grid gap-1 rounded-lg bg-muted/50 p-2.5 text-xs">
          {fields.map(([field, [before, after]]) => (
            <div key={field} className="grid grid-cols-[minmax(0,9rem)_1fr] gap-2">
              <dt className="truncate font-mono text-muted-foreground">{field}</dt>
              <dd className="min-w-0 break-words">
                <span className="text-muted-foreground line-through">{shown(before)}</span> → <span>{shown(after)}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  );
}

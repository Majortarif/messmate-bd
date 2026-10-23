"use client";

import { ClipboardCopy, Lock, LockOpen, Moon, Save, Sun, Sunrise, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { LoadingButton } from "@/components/shared/form";
import { ResponsiveDialog } from "@/components/shared/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { saveMenus, setMealOrder } from "@/lib/actions/meals";
import { formatDate, formatNumber, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Slot = "breakfast" | "lunch" | "dinner";
const SLOTS: Slot[] = ["breakfast", "lunch", "dinner"];
const SLOT_ICON = { breakfast: Sunrise, lunch: Sun, dinner: Moon } as const;

export type BoardOrder = { userId: string; status: "ordered" | "cancelled"; guests: number };
export type BoardMenu = {
  id: string;
  date: string;
  slot: Slot;
  items: string;
  price: number;
  cutoffAt: string | null;
  locked: boolean;
  orders: BoardOrder[];
};
export type BoardMember = { userId: string; name: string };

type Draft = { items: string; price: string; locked: boolean };
const key = (date: string, slot: Slot) => `${date}|${slot}`;

export function MenuBoard({
  messId,
  days,
  menus,
  previousWeek,
  defaultPrices,
  members,
}: {
  messId: string;
  days: string[];
  menus: BoardMenu[];
  previousWeek: { offsetDate: string; slot: Slot; items: string }[];
  defaultPrices: Record<Slot, number>;
  members: BoardMember[];
}) {
  const t = useTranslations("manage.menu");
  const ts = useTranslations("slots");
  const te = useTranslations("errors");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [attendanceFor, setAttendanceFor] = useState<BoardMenu | null>(null);

  const byKey = useMemo(() => new Map(menus.map((m) => [key(m.date, m.slot), m])), [menus]);
  const initial = useMemo(() => {
    const map: Record<string, Draft> = {};
    for (const day of days) {
      for (const slot of SLOTS) {
        const m = byKey.get(key(day, slot));
        map[key(day, slot)] = { items: m?.items ?? "", price: String(m?.price ?? defaultPrices[slot]), locked: m?.locked ?? false };
      }
    }
    return map;
  }, [days, byKey, defaultPrices]);
  const [drafts, setDrafts] = useState(initial);
  const dirty = Object.keys(drafts).filter(
    (k) => drafts[k].items !== initial[k].items || drafts[k].price !== initial[k].price || drafts[k].locked !== initial[k].locked,
  );

  const set = (k: string, patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [k]: { ...d[k], ...patch } }));

  const copyPrevious = () => {
    const next = { ...drafts };
    let filled = 0;
    for (const p of previousWeek) {
      const k = key(p.offsetDate, p.slot);
      if (next[k] && !next[k].items.trim()) {
        next[k] = { ...next[k], items: p.items };
        filled += 1;
      }
    }
    setDrafts(next);
    toast.success(t("copied", { count: filled }));
  };

  const save = () =>
    startTransition(async () => {
      const result = await saveMenus(
        messId,
        dirty.map((k) => {
          const [date, slot] = k.split("|") as [string, Slot];
          return {
            id: byKey.get(k)?.id,
            date,
            slot,
            items: drafts[k].items,
            price: Number(drafts[k].price) || 0,
            locked: drafts[k].locked,
          };
        }),
      );
      if (result.ok) toast.success(t("saved"));
      else toast.error(te(result.error));
    });

  const headcount = (m?: BoardMenu) =>
    m ? m.orders.filter((o) => o.status === "ordered").reduce((sum, o) => sum + 1 + o.guests, 0) : 0;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
        <Button variant="outline" size="sm" onClick={copyPrevious} disabled={previousWeek.length === 0}>
          <ClipboardCopy className="size-4" aria-hidden="true" />
          {t("copyLastWeek")}
        </Button>
      </div>

      <div className="grid gap-3">
        {days.map((day) => (
          <section key={day} className="rounded-2xl border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">{formatDate(day, locale, { weekday: "long", day: "numeric", month: "short" })}</h3>
            <div className="grid gap-3 md:grid-cols-3">
              {SLOTS.map((slot) => {
                const k = key(day, slot);
                const menu = byKey.get(k);
                const draft = drafts[k];
                const Icon = SLOT_ICON[slot];
                const count = headcount(menu);
                return (
                  <div key={slot} className={cn("grid gap-2 rounded-xl border p-3", dirty.includes(k) && "border-primary/50 bg-mint-soft/40")}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                        {ts(slot)}
                      </span>
                      <div className="flex items-center gap-1">
                        {menu && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 px-2 text-xs"
                            onClick={() => setAttendanceFor(menu)}
                            aria-label={t("attendance", { slot: ts(slot) })}
                          >
                            <Users className="size-3.5" aria-hidden="true" />
                            {formatNumber(count, locale)}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="size-7"
                          onClick={() => set(k, { locked: !draft.locked })}
                          aria-label={draft.locked ? t("unlock") : t("lock")}
                          aria-pressed={draft.locked}
                        >
                          {draft.locked ? <Lock className="size-3.5 text-coral" /> : <LockOpen className="size-3.5 text-muted-foreground" />}
                        </Button>
                      </div>
                    </div>
                    <Input
                      value={draft.items}
                      onChange={(e) => set(k, { items: e.target.value })}
                      placeholder={t("itemsPlaceholder")}
                      aria-label={t("items", { slot: ts(slot) })}
                      className="h-10"
                      maxLength={200}
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">৳</span>
                      <Input
                        value={draft.price}
                        onChange={(e) => set(k, { price: e.target.value.replace(/[^\d.]/g, "") })}
                        inputMode="decimal"
                        aria-label={t("price", { slot: ts(slot) })}
                        className="num h-9 w-24"
                      />
                      {menu?.cutoffAt && (
                        <span className="ml-auto text-[11px] text-muted-foreground">
                          {t("cutoff", { time: formatTime(menu.cutoffAt, locale) })}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {dirty.length > 0 && (
        <div className="sticky bottom-24 z-20 flex items-center justify-between gap-3 rounded-2xl border bg-popover/95 p-3 shadow-lg backdrop-blur lg:bottom-4">
          <p className="text-sm">{t("unsaved", { count: dirty.length })}</p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setDrafts(initial)}>
              {t("discard")}
            </Button>
            <LoadingButton loading={pending} onClick={save}>
              <Save className="size-4" aria-hidden="true" />
              {t("save")}
            </LoadingButton>
          </div>
        </div>
      )}

      {attendanceFor && (
        <Attendance menu={attendanceFor} members={members} onClose={() => setAttendanceFor(null)} />
      )}
    </div>
  );
}

/** Who eats this meal; the manager can switch anyone on/off, even after cutoff. */
function Attendance({ menu, members, onClose }: { menu: BoardMenu; members: BoardMember[]; onClose: () => void }) {
  const t = useTranslations("manage.menu");
  const ts = useTranslations("slots");
  const te = useTranslations("errors");
  const locale = useLocale();
  const [orders, setOrders] = useState(() => new Map(menu.orders.map((o) => [o.userId, o])));
  const [busy, setBusy] = useState<string | null>(null);
  const total = [...orders.values()].filter((o) => o.status === "ordered").reduce((s, o) => s + 1 + o.guests, 0);

  const toggle = async (userId: string, ordered: boolean) => {
    setBusy(userId);
    const result = await setMealOrder({ menuId: menu.id, ordered, guests: 0, userId });
    setBusy(null);
    if (!result.ok) {
      toast.error(te(result.error));
      return;
    }
    setOrders((m) => new Map(m).set(userId, { userId, status: result.data.status, guests: result.data.guestCount }));
  };

  return (
    <ResponsiveDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t("attendanceTitle", { slot: ts(menu.slot), date: formatDate(menu.date, locale, { weekday: "short", day: "numeric", month: "short" }) })}
      description={t("attendanceBody", { count: formatNumber(total, locale) })}
    >
      <ul className="grid gap-1">
        {members.map((m) => {
          const order = orders.get(m.userId);
          const on = order?.status === "ordered";
          return (
            <li key={m.userId} className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 hover:bg-accent/50">
              <span className="text-sm">
                {m.name}
                {on && order!.guests > 0 && <span className="ml-1 text-xs text-muted-foreground">+{formatNumber(order!.guests, locale)}</span>}
              </span>
              <Switch checked={on} disabled={busy === m.userId} onCheckedChange={(v) => toggle(m.userId, v)} aria-label={m.name} />
            </li>
          );
        })}
      </ul>
    </ResponsiveDialog>
  );
}

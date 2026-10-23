"use client";

import { Lock, Minus, Moon, Plus, Sun, Sunrise, UtensilsCrossed, Zap } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { setMealOrder } from "@/lib/actions/meals";
import { formatDate, formatTaka, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export type MealCell = {
  id: string;
  date: string;
  slot: "breakfast" | "lunch" | "dinner";
  items: string;
  price: number;
  cutoffAt: string;
  locked: boolean;
  ordered: boolean;
  guests: number;
};

type Settings = { mode: "auto" | "fixed"; guestsAllowed: boolean; maxGuests: number };

const SLOT_ICON = { breakfast: Sunrise, lunch: Sun, dinner: Moon } as const;
const SLOTS = ["breakfast", "lunch", "dinner"] as const;

/** Re-renders every 30 s so cutoffs close on screen without a reload. */
function useNow(serverNow: string) {
  const [now, setNow] = useState(() => new Date(serverNow).getTime());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function MealPlanner({
  days,
  cells,
  settings,
  serverNow,
}: {
  days: string[];
  cells: MealCell[];
  settings: Settings;
  serverNow: string;
}) {
  const t = useTranslations("meals");
  const ts = useTranslations("slots");
  const te = useTranslations("errors");
  const locale = useLocale();
  const now = useNow(serverNow);
  const [selected, setSelected] = useState(days[0]);
  const [, startTransition] = useTransition();
  const [optimistic, applyOptimistic] = useOptimistic(
    cells,
    (state, change: { id: string; ordered: boolean; guests: number }) =>
      state.map((c) => (c.id === change.id ? { ...c, ordered: change.ordered, guests: change.guests } : c)),
  );

  const isOpen = (c: MealCell) => !c.locked && now <= new Date(c.cutoffAt).getTime();

  const update = (cell: MealCell, ordered: boolean, guests: number) => {
    startTransition(async () => {
      applyOptimistic({ id: cell.id, ordered, guests });
      const result = await setMealOrder({ menuId: cell.id, ordered, guests });
      if (!result.ok) toast.error(te(result.error));
      else if (settings.mode === "fixed" && ordered !== cell.ordered) {
        toast.success(ordered ? t("orderedToast", { slot: ts(cell.slot) }) : t("cancelledToast", { slot: ts(cell.slot) }), {
          description: t("balanceAfter", { amount: formatTaka(result.data.balance, locale) }),
        });
      }
    });
  };

  const dayCells = optimistic.filter((c) => c.date === selected);
  const openOff = dayCells.filter((c) => isOpen(c) && !c.ordered);

  return (
    <div className="grid gap-4">
      {/* date strip */}
      <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="tablist" aria-label={t("pickDay")}>
        <div className="flex gap-2">
          {days.map((day, i) => {
            const count = optimistic.filter((c) => c.date === day && c.ordered).length;
            const active = day === selected;
            return (
              <button
                key={day}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelected(day)}
                className={cn(
                  "flex min-w-[68px] flex-col items-center rounded-2xl border px-3 py-2.5 transition-colors",
                  active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40",
                )}
              >
                <span className={cn("text-[11px]", active ? "opacity-80" : "text-muted-foreground")}>
                  {i === 0 ? t("today") : i === 1 ? t("tomorrow") : formatDate(day, locale, { weekday: "short" })}
                </span>
                <span className="num text-lg font-bold leading-tight">{formatDate(day, locale, { day: "numeric" })}</span>
                <span className="mt-1 flex gap-0.5" aria-label={t("mealsThatDay", { count })}>
                  {SLOTS.map((s, idx) => (
                    <span
                      key={s}
                      className={cn(
                        "size-1.5 rounded-full",
                        idx < count ? (active ? "bg-primary-foreground" : "bg-primary") : active ? "bg-primary-foreground/30" : "bg-border",
                      )}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{formatDate(selected, locale, { weekday: "long", day: "numeric", month: "long" })}</h2>
        {openOff.length > 1 && (
          <Button variant="outline" size="sm" onClick={() => openOff.forEach((c) => update(c, true, 0))}>
            <Zap className="size-4 text-marigold" aria-hidden="true" />
            {t("orderAll")}
          </Button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {SLOTS.map((slot) => {
          const cell = dayCells.find((c) => c.slot === slot);
          const Icon = SLOT_ICON[slot];
          if (!cell) {
            return (
              <div key={slot} className="flex items-center gap-3 rounded-2xl border border-dashed p-4 text-muted-foreground">
                <Icon className="size-5" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-foreground">{ts(slot)}</p>
                  <p className="text-xs">{t("noMenu")}</p>
                </div>
              </div>
            );
          }
          const open = isOpen(cell);
          return (
            <article
              key={slot}
              className={cn(
                "flex flex-col rounded-2xl border p-4 transition-colors",
                cell.ordered ? "border-marigold/40 bg-marigold-soft" : "bg-card",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "flex size-10 items-center justify-center rounded-xl",
                      cell.ordered ? "bg-marigold text-[#2a1a02]" : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-semibold">{ts(slot)}</p>
                    <p className="num text-xs text-muted-foreground">
                      {settings.mode === "fixed" ? formatTaka(cell.price, locale) : t("rateAtMonthEnd")}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={cell.ordered}
                  disabled={!open}
                  onCheckedChange={(v) => update(cell, v, 0)}
                  aria-label={t("toggle", { slot: ts(slot) })}
                  className="mt-1 scale-110"
                />
              </div>

              <p className="mt-3 flex-1 text-sm leading-relaxed">{cell.items}</p>

              <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
                <span className={cn("flex items-center gap-1 text-xs", open ? "text-muted-foreground" : "text-coral")}>
                  {!open && <Lock className="size-3.5" aria-hidden="true" />}
                  {cell.locked
                    ? t("locked")
                    : open
                      ? t("openUntil", { time: formatTime(cell.cutoffAt, locale) })
                      : t("closed")}
                </span>
                {settings.guestsAllowed && cell.ordered && (
                  <div className="flex items-center gap-1" aria-label={t("guests")}>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      disabled={!open || cell.guests === 0}
                      onClick={() => update(cell, true, cell.guests - 1)}
                      aria-label={t("lessGuests")}
                    >
                      <Minus className="size-3.5" />
                    </Button>
                    <span className="num w-14 text-center text-xs">{t("guestCount", { count: cell.guests })}</span>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      disabled={!open || cell.guests >= settings.maxGuests}
                      onClick={() => update(cell, true, cell.guests + 1)}
                      aria-label={t("moreGuests")}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {dayCells.length === 0 && (
        <p className="flex items-center gap-2 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          <UtensilsCrossed className="size-4" aria-hidden="true" />
          {t("noMenuDay")}
        </p>
      )}
    </div>
  );
}

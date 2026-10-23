"use client";

import { Heart, List, Map as MapIcon, SlidersHorizontal } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { type AreaOption, AreaSelect } from "@/components/community/interactive";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "@/i18n/navigation";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LISTING_TYPES } from "@/lib/validations/community";

export type HousingFilterState = {
  area: string;
  type: string;
  max: string;
  gender: string;
  sort: string;
  saved: boolean;
  view: "list" | "map";
};

const MAX_RENTS = ["3000", "5000", "8000", "12000", "20000", "35000"];

/** One row of filters above the results; every change updates the URL. */
export function HousingFilters({ areas, value }: { areas: AreaOption[]; value: HousingFilterState }) {
  const t = useTranslations("housing.filters");
  const tt = useTranslations("listingTypes");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const go = (patch: Partial<HousingFilterState>) => {
    const next = { ...value, ...patch };
    const qs = new URLSearchParams();
    if (next.area) qs.set("area", next.area);
    if (next.type) qs.set("type", next.type);
    if (next.max) qs.set("max", next.max);
    if (next.gender) qs.set("gender", next.gender);
    if (next.sort && next.sort !== "new") qs.set("sort", next.sort);
    if (next.saved) qs.set("saved", "1");
    if (next.view === "map") qs.set("view", "map");
    startTransition(() => router.push(qs.size ? `/housing?${qs}` : "/housing", { scroll: false }));
  };

  const chip = (active: boolean) =>
    cn(
      "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm transition-colors",
      active ? "border-primary/50 bg-mint-soft font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
    );

  return (
    <div className={cn("grid gap-3 transition-opacity", pending && "opacity-60")} aria-busy={pending}>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label={t("type")}>
        <button type="button" className={chip(!value.type)} aria-pressed={!value.type} onClick={() => go({ type: "" })}>
          {t("allTypes")}
        </button>
        {LISTING_TYPES.map((type) => (
          <button key={type} type="button" className={chip(value.type === type)} aria-pressed={value.type === type} onClick={() => go({ type })}>
            {tt(type)}
          </button>
        ))}
        <button type="button" className={chip(value.saved)} aria-pressed={value.saved} onClick={() => go({ saved: !value.saved })}>
          <Heart className={cn("size-4", value.saved && "fill-coral text-coral")} aria-hidden="true" />
          {t("saved")}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1.3fr_1fr_1fr_1fr_auto]">
        <AreaSelect areas={areas} value={value.area} onChange={(area) => go({ area })} anyLabel={t("anyArea")} className="col-span-2 sm:col-span-1" />
        <Select value={value.max || "any"} onValueChange={(v) => go({ max: v === "any" ? "" : v })}>
          <SelectTrigger className="h-11 w-full" aria-label={t("maxRent")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">{t("anyRent")}</SelectItem>
            {MAX_RENTS.map((m) => (
              <SelectItem key={m} value={m}>
                {t("upTo", { amount: formatTaka(Number(m), locale) })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={value.gender || "any"} onValueChange={(v) => go({ gender: v === "any" ? "" : v })}>
          <SelectTrigger className="h-11 w-full" aria-label={t("gender")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">{t("anyGender")}</SelectItem>
            <SelectItem value="male">{t("forMale")}</SelectItem>
            <SelectItem value="female">{t("forFemale")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={value.sort || "new"} onValueChange={(sort) => go({ sort })}>
          <SelectTrigger className="h-11 w-full" aria-label={t("sort")}>
            <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden="true" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new">{t("sortNew")}</SelectItem>
            <SelectItem value="rent_asc">{t("sortCheap")}</SelectItem>
            <SelectItem value="rent_desc">{t("sortExpensive")}</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex rounded-xl border p-0.5" role="group" aria-label={t("view")}>
          {(["list", "map"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={value.view === v}
              onClick={() => go({ view: v })}
              className={cn(
                "flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-sm",
                value.view === v ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v === "list" ? <List className="size-4" aria-hidden="true" /> : <MapIcon className="size-4" aria-hidden="true" />}
              {t(v)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

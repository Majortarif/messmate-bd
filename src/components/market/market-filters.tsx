"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { type AreaOption, AreaSelect } from "@/components/community/interactive";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { MARKET_CATEGORIES } from "@/lib/validations/community";

export type MarketFilterState = { q: string; cat: string; area: string; scope: "" | "mess" | "mine"; sort: string };

export function MarketFilters({ areas, value, hasMess }: { areas: AreaOption[]; value: MarketFilterState; hasMess: boolean }) {
  const t = useTranslations("market.filters");
  const tc = useTranslations("marketCategories");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(value.q);

  const go = (patch: Partial<MarketFilterState>) => {
    const next = { ...value, q, ...patch };
    const qs = new URLSearchParams();
    if (next.q.trim()) qs.set("q", next.q.trim().slice(0, 60));
    if (next.cat) qs.set("cat", next.cat);
    if (next.area) qs.set("area", next.area);
    if (next.scope) qs.set("scope", next.scope);
    if (next.sort && next.sort !== "new") qs.set("sort", next.sort);
    startTransition(() => router.push(qs.size ? `/market?${qs}` : "/market", { scroll: false }));
  };
  const chip = (active: boolean) =>
    cn(
      "inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-sm transition-colors",
      active ? "border-primary/50 bg-mint-soft font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
    );

  return (
    <div className={cn("grid gap-3 transition-opacity", pending && "opacity-60")} aria-busy={pending}>
      <form
        role="search"
        className="relative"
        onSubmit={(e) => {
          e.preventDefault();
          go({});
        }}
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={60}
          placeholder={t("search")}
          aria-label={t("search")}
          className="h-11 pl-9"
        />
      </form>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label={t("category")}>
        <button type="button" className={chip(!value.cat)} aria-pressed={!value.cat} onClick={() => go({ cat: "" })}>
          {t("all")}
        </button>
        {MARKET_CATEGORIES.map((c) => (
          <button key={c} type="button" className={chip(value.cat === c)} aria-pressed={value.cat === c} onClick={() => go({ cat: c })}>
            {tc(c)}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1.2fr_1fr_1fr]">
        <AreaSelect areas={areas} value={value.area} onChange={(area) => go({ area })} anyLabel={t("anyArea")} className="col-span-2 sm:col-span-1" />
        <Select value={value.scope || "all"} onValueChange={(v) => go({ scope: v === "all" ? "" : (v as "mess" | "mine") })}>
          <SelectTrigger className="h-11 w-full" aria-label={t("scope")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("everyone")}</SelectItem>
            {hasMess && <SelectItem value="mess">{t("myMess")}</SelectItem>}
            <SelectItem value="mine">{t("mine")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={value.sort || "new"} onValueChange={(sort) => go({ sort })}>
          <SelectTrigger className="h-11 w-full" aria-label={t("sort")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new">{t("sortNew")}</SelectItem>
            <SelectItem value="price_asc">{t("sortCheap")}</SelectItem>
            <SelectItem value="price_desc">{t("sortExpensive")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

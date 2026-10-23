"use client";

import { BadgeCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { type AreaOption, AreaSelect } from "@/components/community/interactive";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { SERVICE_CATEGORIES } from "@/lib/validations/community";

export type ServiceFilterState = { cat: string; area: string; verified: boolean; mine: boolean };

export function ServicesFilters({ areas, value }: { areas: AreaOption[]; value: ServiceFilterState }) {
  const t = useTranslations("services.filters");
  const tc = useTranslations("serviceCategories");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const go = (patch: Partial<ServiceFilterState>) => {
    const next = { ...value, ...patch };
    const qs = new URLSearchParams();
    if (next.cat) qs.set("cat", next.cat);
    if (next.area) qs.set("area", next.area);
    if (next.verified) qs.set("verified", "1");
    if (next.mine) qs.set("mine", "1");
    startTransition(() => router.push(qs.size ? `/services?${qs}` : "/services", { scroll: false }));
  };
  const chip = (active: boolean) =>
    cn(
      "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm transition-colors",
      active ? "border-primary/50 bg-mint-soft font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
    );

  return (
    <div className={cn("grid gap-3 transition-opacity", pending && "opacity-60")} aria-busy={pending}>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label={t("category")}>
        <button type="button" className={chip(!value.cat)} aria-pressed={!value.cat} onClick={() => go({ cat: "" })}>
          {t("all")}
        </button>
        {SERVICE_CATEGORIES.map((c) => (
          <button key={c} type="button" className={chip(value.cat === c)} aria-pressed={value.cat === c} onClick={() => go({ cat: c })}>
            {tc(c)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <AreaSelect areas={areas} value={value.area} onChange={(area) => go({ area })} anyLabel={t("anyArea")} className="w-full sm:w-56" />
        <button type="button" className={chip(value.verified)} aria-pressed={value.verified} onClick={() => go({ verified: !value.verified })}>
          <BadgeCheck className="size-4" aria-hidden="true" />
          {t("verified")}
        </button>
        <button type="button" className={chip(value.mine)} aria-pressed={value.mine} onClick={() => go({ mine: !value.mine })}>
          {t("mine")}
        </button>
      </div>
    </div>
  );
}

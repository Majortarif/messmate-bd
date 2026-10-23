import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { ACTIVITY_CATEGORIES, type ActivityCategory } from "@/types/app";

/** ?type= from the URL, if it is one of the allowed categories. */
export function parseCategory(value: string | string[] | undefined, allowed: readonly ActivityCategory[] = ACTIVITY_CATEGORIES) {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as ActivityCategory) : null;
}

/** One row of filter chips above the log; every chip is a link, so it works without JS. */
export function ActivityFilters({
  path,
  active,
  options,
  extraQuery = "",
}: {
  path: string;
  active: ActivityCategory | null;
  options: readonly ActivityCategory[];
  extraQuery?: string;
}) {
  const t = useTranslations("activity.filters");
  const chips = [null, ...options] as const;
  return (
    <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label={t("label")}>
      {chips.map((c) => {
        const query = [c ? `type=${c}` : "", extraQuery].filter(Boolean).join("&");
        const selected = c === active;
        return (
          <Link
            key={c ?? "all"}
            href={query ? `${path}?${query}` : path}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-sm transition-colors",
              selected ? "border-primary/50 bg-mint-soft font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(c ?? "all")}
          </Link>
        );
      })}
    </nav>
  );
}

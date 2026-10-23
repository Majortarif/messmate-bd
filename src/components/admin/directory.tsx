import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";

export const PAGE_SIZE = 25;

/** ?page= as a 1-based page number. */
export function parsePage(value: string | string[] | undefined) {
  const n = typeof value === "string" ? Number.parseInt(value, 10) : 1;
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10_000) : 1;
}

/** Plain GET form: works before JavaScript loads, and the URL stays shareable. */
export function SearchForm({
  query,
  placeholder,
  hidden = {},
}: {
  query: string;
  placeholder: string;
  hidden?: Record<string, string | undefined>;
}) {
  const t = useTranslations("admin");
  return (
    <form method="get" role="search" className="flex w-full max-w-md gap-2">
      {Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          name="q"
          type="search"
          defaultValue={query}
          placeholder={placeholder}
          aria-label={placeholder}
          maxLength={80}
          className="h-11 pl-9"
        />
      </div>
      <Button type="submit" variant="outline" className="h-11">
        {t("search")}
      </Button>
    </form>
  );
}

/** "21–40 of 132" with previous / next links that keep the other filters. */
export function Pager({ path, page, total, query }: { path: string; page: number; total: number; query: Record<string, string | undefined> }) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (total === 0) return null;
  const href = (p: number) => {
    const qs = new URLSearchParams(Object.entries({ ...query, page: p > 1 ? String(p) : undefined }).filter((e): e is [string, string] => !!e[1]));
    const s = qs.toString();
    return s ? `${path}?${s}` : path;
  };
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);
  return (
    <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
      <span>
        {t("range", { from: formatNumber(first, locale), to: formatNumber(last, locale), total: formatNumber(total, locale) })}
      </span>
      <div className="flex gap-1">
        {page > 1 ? (
          <Button asChild variant="outline" size="icon" aria-label={t("prev")}>
            <Link href={href(page - 1)}>
              <ChevronLeft className="size-4" />
            </Link>
          </Button>
        ) : null}
        {page < pages ? (
          <Button asChild variant="outline" size="icon" aria-label={t("next")}>
            <Link href={href(page + 1)}>
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

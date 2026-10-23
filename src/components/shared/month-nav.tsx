import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/format";
import { currentMonth, monthParam, shiftMonth } from "@/lib/month";

/** ‹ October 2026 › — links that change ?month= on the given page. */
export function MonthNav({ month, path, allowFuture = false }: { month: string; path: string; allowFuture?: boolean }) {
  const t = useTranslations("common");
  const locale = useLocale();
  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const canNext = allowFuture || next <= currentMonth();

  return (
    <div className="flex items-center gap-1 rounded-xl border bg-card p-1">
      <Button asChild variant="ghost" size="icon-sm" aria-label={t("prevMonth")}>
        <Link href={`${path}?month=${monthParam(prev)}`}>
          <ChevronLeft className="size-4" />
        </Link>
      </Button>
      <span className="min-w-28 text-center text-sm font-semibold">
        {formatDate(month, locale, { month: "long", year: "numeric" })}
      </span>
      {canNext ? (
        <Button asChild variant="ghost" size="icon-sm" aria-label={t("nextMonth")}>
          <Link href={`${path}?month=${monthParam(next)}`}>
            <ChevronRight className="size-4" />
          </Link>
        </Button>
      ) : (
        <span className="size-9" aria-hidden="true" />
      )}
    </div>
  );
}

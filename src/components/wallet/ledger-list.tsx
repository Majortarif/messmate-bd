import { ArrowDownLeft, ArrowUpRight, ReceiptText } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { EmptyState } from "@/components/shared/states";
import { formatDate, formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Enums } from "@/types/database";

export type LedgerRow = {
  id: string;
  entry_type: Enums<"ledger_type">;
  amount: number;
  description: string | null;
  created_at: string;
};

export function LedgerList({ rows, emptyTitle }: { rows: LedgerRow[]; emptyTitle: string }) {
  const tl = useTranslations("ledgerTypes");
  const locale = useLocale();
  if (rows.length === 0) return <EmptyState icon={ReceiptText} title={emptyTitle} className="py-6" />;

  return (
    <ul className="divide-y">
      {rows.map((row) => {
        const credit = Number(row.amount) > 0;
        return (
          <li key={row.id} className="flex items-center gap-3 py-3">
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full",
                credit ? "bg-mint-soft text-mint" : "bg-coral-soft text-coral",
              )}
            >
              {credit ? <ArrowDownLeft className="size-4" aria-hidden="true" /> : <ArrowUpRight className="size-4" aria-hidden="true" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{tl(row.entry_type)}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {row.description ? `${row.description} · ` : ""}
                {formatDate(row.created_at, locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
              </span>
            </span>
            <span className={cn("num shrink-0 text-sm font-semibold", credit ? "text-mint" : "text-coral")}>
              {credit ? "+" : ""}
              {formatTaka(row.amount, locale)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

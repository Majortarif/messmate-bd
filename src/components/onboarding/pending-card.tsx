"use client";

import { Hourglass } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormError, LoadingButton } from "@/components/shared/form";
import { cancelJoinRequest } from "@/lib/actions/onboarding";
import type { ErrorKey } from "@/lib/errors";
import { formatDate } from "@/lib/format";

export function PendingCard({ messName, requestedAt }: { messName: string; requestedAt: string }) {
  const t = useTranslations("onboarding.pending");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(null);

  return (
    <div className="rounded-2xl border bg-card p-6 sm:p-8">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-marigold-soft text-marigold">
        <Hourglass className="size-6" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-xl font-semibold">{t("title")}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("body", { mess: messName })}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("since", { time: formatDate(requestedAt, locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) })}
      </p>
      <p className="mt-4 rounded-xl bg-muted px-4 py-3 text-sm">{t("tip")}</p>
      <FormError error={error} className="mt-4" />
      <LoadingButton
        variant="outline"
        className="mt-6"
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await cancelJoinRequest();
            if (result.ok) toast.success(t("cancelled"));
            else setError(result.error);
          })
        }
      >
        {t("cancel")}
      </LoadingButton>
    </div>
  );
}

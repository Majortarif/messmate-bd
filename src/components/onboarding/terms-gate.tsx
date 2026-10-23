"use client";

import { ScrollText } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { FormError, LoadingButton } from "@/components/shared/form";
import { Link } from "@/i18n/navigation";
import { acceptTerms } from "@/lib/actions/onboarding";
import type { ErrorKey } from "@/lib/errors";

/** Shown to people who signed in with Google and never saw the signup checkbox. */
export function TermsGate() {
  const t = useTranslations("onboarding.terms");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(null);

  return (
    <div className="rounded-2xl border bg-card p-6 sm:p-8">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-sky-soft text-sky">
        <ScrollText className="size-6" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-xl font-semibold">{t("title")}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("body")}</p>
      <ul className="mt-4 grid gap-2 text-sm">
        <li>
          <Link href="/privacy" target="_blank" className="font-medium text-primary hover:underline">
            {t("privacyLink")}
          </Link>
        </li>
        <li>
          <Link href="/terms" target="_blank" className="font-medium text-primary hover:underline">
            {t("termsLink")}
          </Link>
        </li>
      </ul>
      <FormError error={error} className="mt-4" />
      <LoadingButton
        className="mt-6 h-11 w-full sm:w-auto"
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await acceptTerms();
            if (!result.ok) setError(result.error);
          })
        }
      >
        {t("accept")}
      </LoadingButton>
    </div>
  );
}

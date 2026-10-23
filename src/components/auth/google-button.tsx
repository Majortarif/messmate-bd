"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { FormError } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "@/lib/actions/auth";
import type { ErrorKey } from "@/lib/errors";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-[18px]" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5Z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7Z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44Z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5Z" />
    </svg>
  );
}

export function GoogleButton({ next }: { next?: string | null }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(null);

  return (
    <div className="grid gap-2">
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await signInWithGoogle(next ?? null, locale);
            if (result.ok) window.location.assign(result.data.url);
            else setError(result.error);
          })
        }
      >
        <GoogleIcon />
        {t("google")}
      </Button>
      <FormError error={error} />
    </div>
  );
}

export function AuthDivider() {
  const t = useTranslations("auth");
  return (
    <div className="relative my-1 flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      {t("or")}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

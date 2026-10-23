"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errorPage");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center px-4 text-center" role="alert">
      <span className="flex size-16 items-center justify-center rounded-3xl bg-coral-soft text-coral">
        <TriangleAlert className="size-8" aria-hidden="true" />
      </span>
      <h1 className="mt-6 text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">{t("body")}</p>
      {error.digest && <p className="mt-2 font-mono text-xs text-muted-foreground">#{error.digest}</p>}
      <div className="mt-8 flex gap-2">
        <Button onClick={reset}>
          <RotateCcw className="size-4" aria-hidden="true" />
          {t("retry")}
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">{t("home")}</Link>
        </Button>
      </div>
    </div>
  );
}

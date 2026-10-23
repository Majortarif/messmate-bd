"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function LocaleSwitcher({ className, compact = false }: { className?: string; compact?: boolean }) {
  const t = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next = locale === "bn" ? "en" : "bn";

  return (
    <Button
      variant="ghost"
      size={compact ? "icon" : "sm"}
      className={cn("gap-1.5", className)}
      disabled={pending}
      aria-label={t("switchLanguage")}
      title={t("switchLanguage")}
      onClick={() => startTransition(() => router.replace(pathname, { locale: next }))}
    >
      <Languages className="size-[18px]" />
      {!compact && <span className="text-xs font-semibold">{next === "en" ? "EN" : "বাং"}</span>}
    </Button>
  );
}

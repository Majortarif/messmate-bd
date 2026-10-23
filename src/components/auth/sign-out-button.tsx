"use client";

import { LogOut } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

function Submit({ className, iconOnly }: { className?: string; iconOnly?: boolean }) {
  const t = useTranslations("common");
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="ghost"
      size={iconOnly ? "icon" : "sm"}
      disabled={pending}
      className={cn("text-muted-foreground", className)}
      aria-label={t("signOut")}
    >
      <LogOut className="size-4" aria-hidden="true" />
      {!iconOnly && t("signOut")}
    </Button>
  );
}

export function SignOutButton({ className, iconOnly }: { className?: string; iconOnly?: boolean }) {
  const locale = useLocale();
  return (
    <form action={signOut.bind(null, locale)}>
      <Submit className={className} iconOnly={iconOnly} />
    </form>
  );
}

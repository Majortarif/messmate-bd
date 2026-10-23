"use client";

import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";

const SECTIONS = ["features", "care", "how", "faq"] as const;

export function SiteHeader() {
  const t = useTranslations();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="rounded-lg focus-visible:outline-2 focus-visible:outline-ring" aria-label="MessMate BD">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label={t("landing.nav.label")}>
          {SECTIONS.map((id) => (
            <a
              key={id}
              href={`#${id}`}
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {t(`landing.nav.${id}`)}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <LocaleSwitcher className="hidden sm:inline-flex" />
          <ThemeToggle />
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link href="/login">{t("common.signIn")}</Link>
          </Button>
          <Button asChild className="hidden sm:inline-flex">
            <Link href="/signup">{t("common.getStarted")}</Link>
          </Button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label={t("common.menu")}>
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85vw] max-w-xs">
              <SheetHeader>
                <SheetTitle>
                  <Logo />
                </SheetTitle>
              </SheetHeader>
              <nav className="grid gap-1 px-4" aria-label={t("landing.nav.label")}>
                {SECTIONS.map((id) => (
                  <a
                    key={id}
                    href={`#${id}`}
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-3 text-base hover:bg-accent"
                  >
                    {t(`landing.nav.${id}`)}
                  </a>
                ))}
              </nav>
              <div className="mt-auto grid gap-2 p-4">
                <LocaleSwitcher className="justify-start" />
                <Button asChild variant="outline">
                  <Link href="/login">{t("common.signIn")}</Link>
                </Button>
                <Button asChild>
                  <Link href="/signup">{t("common.getStarted")}</Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

"use client";

import { Bell, Download, Languages, LogOut, Moon, Settings, Sun } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setTheme, useTheme } from "@/components/theme";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { signOut } from "@/lib/actions/auth";
import { initials } from "@/lib/format";

type InstallPrompt = Event & { prompt: () => Promise<void> };

export function UserMenu({
  name,
  email,
  avatarUrl,
  roleLabel,
}: {
  name: string;
  email: string | null;
  avatarUrl: string | null;
  roleLabel: string;
}) {
  const t = useTranslations("userMenu");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { theme } = useTheme();
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-10 gap-2 rounded-full px-1.5 sm:pr-3" aria-label={t("open")}>
          <Avatar className="size-8">
            {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
            <AvatarFallback className="bg-mint-soft text-xs font-semibold text-mint">{initials(name)}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-32 truncate text-sm font-medium sm:inline">{name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="grid gap-0.5 font-normal">
          <span className="truncate font-semibold">{name}</span>
          {email && <span className="truncate text-xs text-muted-foreground">{email}</span>}
          <span className="text-xs text-primary">{roleLabel}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings className="size-4" />
            {t("settings")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/notifications">
            <Bell className="size-4" />
            {t("notifications")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          {theme === "dark" ? t("lightMode") : t("darkMode")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.replace(pathname, { locale: locale === "bn" ? "en" : "bn" })}>
          <Languages className="size-4" />
          {t("language")}
        </DropdownMenuItem>
        {installPrompt && (
          <DropdownMenuItem
            onSelect={() => {
              void installPrompt.prompt();
              setInstallPrompt(null);
            }}
          >
            <Download className="size-4" />
            {t("install")}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void signOut(locale)}>
          <LogOut className="size-4" />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

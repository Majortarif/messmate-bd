"use client";

import {
  BadgeCheck,
  Building2,
  CalendarCheck,
  ChefHat,
  HeartPulse,
  Home,
  type LucideIcon,
  MoreHorizontal,
  Receipt,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Store,
  UserCog,
  Users,
  UtensilsCrossed,
  Wallet,
  Wrench,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Logo } from "@/components/brand/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type NavKey =
  | "dashboard" | "meals" | "wallet" | "billing" | "mess" | "care" | "housing" | "market" | "services"
  | "members" | "menu" | "approvals" | "expenses" | "bills" | "closing" | "messSettings" | "admin";
type NavItem = { key: NavKey; href: string; icon: LucideIcon; ready: boolean; mobile?: boolean };

// `ready` flips on as each phase ships its pages, so nobody hits a dead link.
const MAIN: NavItem[] = [
  { key: "dashboard", href: "/dashboard", icon: Home, ready: true, mobile: true },
  { key: "meals", href: "/meals", icon: UtensilsCrossed, ready: true, mobile: true },
  { key: "wallet", href: "/wallet", icon: Wallet, ready: true, mobile: true },
  { key: "billing", href: "/billing", icon: Receipt, ready: true, mobile: true },
  { key: "mess", href: "/mess", icon: Users, ready: false },
  { key: "care", href: "/care", icon: HeartPulse, ready: false, mobile: true },
  { key: "housing", href: "/housing", icon: Building2, ready: false },
  { key: "market", href: "/market", icon: Store, ready: false },
  { key: "services", href: "/services", icon: Wrench, ready: false },
];
const MANAGER: NavItem[] = [
  { key: "approvals", href: "/manage/approvals", icon: BadgeCheck, ready: true },
  { key: "menu", href: "/manage/menu", icon: ChefHat, ready: true },
  { key: "expenses", href: "/manage/expenses", icon: ShoppingCart, ready: true },
  { key: "bills", href: "/manage/bills", icon: Receipt, ready: true },
  { key: "closing", href: "/manage/closing", icon: CalendarCheck, ready: true },
  { key: "members", href: "/manage/members", icon: UserCog, ready: true },
  { key: "messSettings", href: "/manage/settings", icon: Settings2, ready: true },
];
const ADMIN: NavItem[] = [{ key: "admin", href: "/admin", icon: ShieldCheck, ready: false }];

export type NavAccess = { isManager: boolean; isAdmin: boolean };

/** Routes that exist right now (notification links to anything else render as plain text). */
export const READY_ROUTES = [...MAIN, ...MANAGER, ...ADMIN].filter((i) => i.ready).map((i) => i.href).concat("/onboarding");
export const isReadyRoute = (href: string) => READY_ROUTES.some((r) => href === r || href.startsWith(`${r}/`) || href.startsWith(`${r}?`));

function sections({ isManager, isAdmin }: NavAccess) {
  return [
    { id: "main" as const, items: MAIN.filter((i) => i.ready) },
    { id: "manager" as const, items: isManager ? MANAGER.filter((i) => i.ready) : [] },
    { id: "platform" as const, items: isAdmin ? ADMIN.filter((i) => i.ready) : [] },
  ].filter((s) => s.items.length > 0);
}

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav(access: NavAccess) {
  const t = useTranslations("nav");
  const isActive = useIsActive();
  return (
    <nav className="grid gap-6" aria-label={t("label")}>
      {sections(access).map((section) => (
        <div key={section.id} className="grid gap-1">
          <p className="px-3 pb-1 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground/80">
            {t(`sections.${section.id}`)}
          </p>
          {section.items.map(({ key, href, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={key}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex h-11 items-center gap-3 rounded-xl px-3 text-[0.95rem] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
                  active && "bg-sidebar-accent font-medium text-foreground",
                )}
              >
                <Icon className={cn("size-[19px]", active && "text-primary")} aria-hidden="true" />
                {t(key)}
                {active && <span className="ml-auto h-5 w-1 rounded-full bg-primary" aria-hidden="true" />}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function MobileNav(access: NavAccess) {
  const t = useTranslations("nav");
  const isActive = useIsActive();
  const [open, setOpen] = useState(false);
  const all = sections(access).flatMap((s) => s.items);
  const bar = all.filter((i) => i.mobile).slice(0, 4);

  return (
    <>
      <nav
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 backdrop-blur-xl lg:hidden"
        aria-label={t("label")}
      >
        <div className="mx-auto flex max-w-md items-stretch justify-around px-2">
          {bar.map(({ key, href, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={key}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[60px] min-w-[64px] flex-col items-center justify-center gap-0.5 text-[0.7rem] text-muted-foreground",
                  active && "text-primary",
                )}
              >
                <Icon className="size-[21px]" aria-hidden="true" />
                {t(key)}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex min-h-[60px] min-w-[64px] flex-col items-center justify-center gap-0.5 text-[0.7rem] text-muted-foreground"
          >
            <MoreHorizontal className="size-[21px]" aria-hidden="true" />
            {t("more")}
          </button>
        </div>
      </nav>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>
              <Logo />
            </SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-2 px-4" onClick={() => setOpen(false)}>
            {all.map(({ key, href, icon: Icon }) => (
              <Link
                key={key}
                href={href}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-2xl border bg-card px-2 py-4 text-sm",
                  isActive(href) && "border-primary/50 text-primary",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                {t(key)}
              </Link>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 border-t p-4">
            <div className="flex items-center gap-1">
              <LocaleSwitcher />
              <ThemeToggle />
            </div>
            <SignOutButton />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

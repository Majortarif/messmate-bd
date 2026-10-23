import { BellRing, Briefcase, CalendarHeart, HeartHandshake, HeartPulse, Siren, Soup, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "hub", href: "/care", icon: HeartPulse },
  { key: "emergency", href: "/care/emergency", icon: Siren },
  { key: "money", href: "/care/money", icon: Wallet },
  { key: "reminders", href: "/care/reminders", icon: BellRing },
  { key: "mind", href: "/care/mind", icon: HeartHandshake },
  { key: "food", href: "/care/food", icon: Soup },
  { key: "events", href: "/care/events", icon: CalendarHeart },
  { key: "jobs", href: "/care/jobs", icon: Briefcase },
] as const;
export type CareTab = (typeof TABS)[number]["key"];

/** Sub-navigation for the Care section. */
export function CareNav({ active }: { active: CareTab }) {
  const t = useTranslations("care.nav");
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" aria-label={t("label")}>
      {TABS.map(({ key, href, icon: Icon }) => (
        <Link
          key={key}
          href={href}
          aria-current={key === active ? "page" : undefined}
          className={cn(
            "inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm transition-colors",
            key === active ? "bg-mint-soft font-medium text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          <Icon className={cn("size-4", key === active && "text-mint")} aria-hidden="true" />
          {t(key)}
        </Link>
      ))}
    </nav>
  );
}

import { ClipboardList, Megaphone, MessageSquareWarning, Vote } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "notices", href: "/mess", icon: Megaphone },
  { key: "complaints", href: "/mess/complaints", icon: MessageSquareWarning },
  { key: "polls", href: "/mess/polls", icon: Vote },
  { key: "roster", href: "/mess/roster", icon: ClipboardList },
] as const;

/** Sub-navigation for mess life: notices, complaints, polls, duty roster. */
export function MessTabs({ active, counts }: { active: (typeof TABS)[number]["key"]; counts?: Partial<Record<(typeof TABS)[number]["key"], number>> }) {
  const t = useTranslations("mess.tabs");
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
          {counts?.[key] ? <span className="rounded-full bg-marigold px-1.5 text-xs font-semibold text-[#2a1a02]">{counts[key]}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

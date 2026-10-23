import { Building2, ClipboardCheck, ReceiptText, UsersRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "listings", href: "/housing", icon: Building2 },
  { key: "roommates", href: "/housing/roommates", icon: UsersRound },
  { key: "rent", href: "/housing/rent", icon: ReceiptText },
  { key: "move", href: "/housing/move", icon: ClipboardCheck },
] as const;

/** Sub-navigation for the housing section. */
export function HousingTabs({ active }: { active: (typeof TABS)[number]["key"] }) {
  const t = useTranslations("housing.tabs");
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

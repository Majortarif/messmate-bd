import { Bell, HeartPulse, Home, Moon, Sun, Sunrise, UtensilsCrossed, Wallet, MoreHorizontal, Heart } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { LogoMark } from "@/components/brand/logo";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Static illustration of the member dashboard for the landing hero (demo numbers). */
export function PhoneMockup({ className }: { className?: string }) {
  const t = useTranslations("landing.mock");
  const ts = useTranslations("slots");
  const locale = useLocale();

  return (
    <div
      className={cn(
        "relative w-[290px] rounded-[2.4rem] border-[7px] border-[#1f2732] bg-[#0b0f14] p-3.5 text-[#e8edf3] shadow-2xl shadow-black/40",
        className,
      )}
      role="img"
      aria-label={t("alt")}
    >
      <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-white/10" />
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <LogoMark className="size-7" /> MessMate
        </span>
        <span className="relative">
          <Bell className="size-5 text-[#c9d3df]" />
          <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-[#f2665a]" />
        </span>
      </div>

      <p className="mt-3 text-[1.05rem] font-semibold">{t("greeting")}</p>
      <p className="text-xs text-[#8a96a6]">{t("messLine")}</p>

      <div className="mt-3 rounded-2xl border border-[#2dd4a7]/25 bg-[#0f2420] p-3">
        <p className="text-xs text-[#8fd9c3]">{t("balance")}</p>
        <p className="num text-[1.7rem] font-semibold leading-tight text-[#2dd4a7]">{formatTaka(1240, locale)}</p>
        <div className="mt-1 flex justify-between text-[11px] text-[#a9c9bf]">
          <span>{t("deposits", { amount: formatTaka(5000, locale) })}</span>
          <span>{t("spent", { amount: formatTaka(3760, locale) })}</span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-[#163a33]">
          <div className="h-full w-3/4 rounded-full bg-[#2dd4a7]" />
        </div>
        <div className="mt-2.5 rounded-xl bg-[#2dd4a7] py-1.5 text-center text-xs font-semibold text-[#04201a]">
          {t("addMoney")}
        </div>
      </div>

      <div className="mt-2.5 rounded-2xl border border-white/[0.07] bg-[#141b24] p-3">
        <div className="mb-2 flex justify-between text-xs">
          <span className="font-semibold">{t("todayMeals")}</span>
          <span className="text-[#8a96a6]">{t("mealRate", { amount: formatTaka(52, locale) })}</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
          <div className="rounded-lg bg-[#1b2430] px-1 py-2 text-[#6f7b8b]">
            <Sunrise className="mx-auto size-4" />
            {ts("breakfast")}
            <div className="text-[10px]">{t("done")}</div>
          </div>
          <div className="rounded-lg border border-[#f5a524]/45 bg-[#2a2112] px-1 py-2 text-[#f5c26b]">
            <Sun className="mx-auto size-4" />
            {ts("lunch")}
            <div className="text-[10px]">{t("ordered")}</div>
          </div>
          <div className="rounded-lg border border-dashed border-white/20 bg-[#1b2430] px-1 py-2 text-[#c9d3df]">
            <Moon className="mx-auto size-4" />
            {ts("dinner")}
            <div className="text-[10px]">{t("until")}</div>
          </div>
        </div>
      </div>

      <div className="mt-2.5 rounded-2xl border border-[#f2665a]/30 bg-[#2a1614] p-3">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <HeartPulse className="size-4 text-[#f2665a]" />
          {t("care")}
        </div>
        <p className="mt-0.5 text-[11px] text-[#d8a7a2]">{t("careBody")}</p>
      </div>

      <div className="mt-3 flex justify-around border-t border-white/[0.07] pt-2 text-[10px] text-[#6f7b8b]">
        {[
          { icon: Home, label: t("navHome"), active: true },
          { icon: UtensilsCrossed, label: t("navMeals") },
          { icon: Wallet, label: t("navWallet") },
          { icon: Heart, label: t("navCare") },
          { icon: MoreHorizontal, label: t("navMore") },
        ].map(({ icon: Icon, label, active }) => (
          <span key={label} className={cn("flex flex-col items-center gap-0.5", active && "text-[#2dd4a7]")}>
            <Icon className="size-[17px]" />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

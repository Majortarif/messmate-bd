import { ArrowLeft, HeartHandshake, ShieldCheck, UtensilsCrossed } from "lucide-react";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme";
import { Link } from "@/i18n/navigation";

export default function AuthLayout({ children }: LayoutProps<"/[locale]">) {
  const t = useTranslations();
  const points = [
    { key: "meals", icon: UtensilsCrossed },
    { key: "money", icon: ShieldCheck },
    { key: "care", icon: HeartHandshake },
  ] as const;

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <aside className="glow-mint relative hidden flex-col justify-between overflow-hidden border-r bg-surface p-10 lg:flex">
        <div className="bg-dots pointer-events-none absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <Link href="/" className="relative w-fit">
          <Logo />
        </Link>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-bold leading-snug">{t("auth.aside.title")}</h2>
          <ul className="mt-8 grid gap-5">
            {points.map(({ key, icon: Icon }) => (
              <li key={key} className="flex gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-mint-soft text-mint">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold">{t(`auth.aside.points.${key}.title`)}</p>
                  <p className="text-sm text-muted-foreground">{t(`auth.aside.points.${key}.body`)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-muted-foreground">{t("auth.aside.footer")}</p>
      </aside>

      <div className="flex flex-col">
        <div className="flex items-center justify-between px-4 py-4 sm:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            <span className="lg:hidden">
              <Logo markClassName="size-6" />
            </span>
            <span className="hidden lg:inline">{t("common.backHome")}</span>
          </Link>
          <div className="flex items-center gap-1">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </div>
        <main className="flex flex-1 items-start justify-center px-4 pb-12 pt-4 sm:items-center sm:px-8">
          <div className="w-full max-w-[420px] animate-fade-up">{children}</div>
        </main>
      </div>
    </div>
  );
}

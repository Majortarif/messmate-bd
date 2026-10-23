import { Compass } from "lucide-react";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("notFound");
  return (
    <main className="glow-mint flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <Logo className="mb-10" />
      <span className="flex size-16 items-center justify-center rounded-3xl bg-mint-soft text-mint">
        <Compass className="size-8" aria-hidden="true" />
      </span>
      <p className="num mt-6 text-6xl font-bold text-primary">404</p>
      <h1 className="mt-2 text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">{t("body")}</p>
      <Button asChild className="mt-8">
        <Link href="/">{t("home")}</Link>
      </Button>
    </main>
  );
}

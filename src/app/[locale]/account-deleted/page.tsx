import { HeartHandshake } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("accountDeleted");
  return { title: t("title"), robots: { index: false } };
}

/** Shown after "delete my account", and to anyone who signs in to a deleted account. */
export default async function AccountDeletedPage() {
  const t = await getTranslations("accountDeleted");
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto grid max-w-lg justify-items-center gap-4 px-4 py-20 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-mint-soft text-mint">
          <HeartHandshake className="size-7" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-bold sm:text-3xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("body")}</p>
        <p className="text-sm text-muted-foreground">{t("kept")}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/">{t("home")}</Link>
          </Button>
          <SignOutButton />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

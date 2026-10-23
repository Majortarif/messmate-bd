import { ArrowLeft, Mail } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { FeedbackForm } from "@/components/account/feedback";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { Link } from "@/i18n/navigation";
import { env } from "@/lib/env";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("feedback");
  return { title: t("title"), description: t("subtitle") };
}

/** Public contact / feedback / bug report page (works without signing in). */
export default async function FeedbackPage() {
  const t = await getTranslations("feedback");
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("backHome")}
        </Link>
        <h1 className="mt-6 text-3xl font-bold sm:text-4xl">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
        <div className="mt-8 rounded-2xl border bg-card p-5 sm:p-6">
          <FeedbackForm signedIn={false} />
        </div>
        {env.supportEmail && (
          <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="size-4" aria-hidden="true" />
            {t("orEmail")}{" "}
            <a href={`mailto:${env.supportEmail}`} className="font-medium text-primary hover:underline">
              {env.supportEmail}
            </a>
          </p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">{t("privacyNote")}</p>
      </main>
      <SiteFooter />
    </>
  );
}

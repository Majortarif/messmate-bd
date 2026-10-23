import { ArrowLeft } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { legalDocs } from "@/content/legal";
import { Link } from "@/i18n/navigation";
import { TERMS_VERSION } from "@/lib/constants";
import { env } from "@/lib/env";

export function LegalPage({ doc }: { doc: keyof typeof legalDocs }) {
  const t = useTranslations("legal");
  const locale = useLocale() as "bn" | "en";
  const content = legalDocs[doc][locale];

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("backHome")}
        </Link>
        <h1 className="mt-6 text-3xl font-bold sm:text-4xl">{content.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("version", { version: TERMS_VERSION })}</p>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">{content.intro}</p>

        <nav className="mt-8 rounded-2xl border bg-card p-5" aria-label={t("contents")}>
          <p className="mb-2 text-sm font-semibold">{t("contents")}</p>
          <ol className="grid list-decimal gap-1 pl-5 text-sm text-muted-foreground">
            {content.sections.map((s, i) => (
              <li key={s.heading}>
                <a href={`#s${i + 1}`} className="hover:text-foreground">
                  {s.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-10 grid gap-10">
          {content.sections.map((s, i) => (
            <section key={s.heading} id={`s${i + 1}`} className="scroll-mt-24">
              <h2 className="text-xl font-semibold">
                {i + 1}. {s.heading}
              </h2>
              <ul className="mt-3 grid gap-2.5 text-[0.97rem] leading-relaxed text-muted-foreground">
                {s.body.map((p) => (
                  <li key={p} className="relative pl-4 before:absolute before:left-0 before:top-[0.7em] before:size-1.5 before:rounded-full before:bg-primary/70">
                    {p}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {env.supportEmail && (
          <p className="mt-12 rounded-2xl border bg-card p-5 text-sm">
            {t("contact")}{" "}
            <a href={`mailto:${env.supportEmail}`} className="font-medium text-primary hover:underline">
              {env.supportEmail}
            </a>
          </p>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

import {
  ArrowRight,
  BarChart3,
  Building2,
  CalendarCheck,
  HandHeart,
  HeartPulse,
  KeyRound,
  Languages,
  MapPinCheck,
  PhoneCall,
  Receipt,
  ShieldCheck,
  ShieldHalf,
  Smile,
  Sparkles,
  Store,
  UtensilsCrossed,
  Users,
  Wallet,
} from "lucide-react";
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Faq } from "@/components/landing/faq";
import { PhoneMockup } from "@/components/landing/phone-mockup";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: { absolute: t("homeTitle") } };
}

const FEATURES = [
  { key: "meals", icon: UtensilsCrossed, tone: "text-marigold bg-marigold-soft" },
  { key: "wallet", icon: Wallet, tone: "text-mint bg-mint-soft" },
  { key: "bills", icon: Receipt, tone: "text-sky bg-sky-soft" },
  { key: "housing", icon: Building2, tone: "text-mint bg-mint-soft" },
  { key: "daily", icon: CalendarCheck, tone: "text-marigold bg-marigold-soft" },
  { key: "services", icon: Store, tone: "text-sky bg-sky-soft" },
] as const;

const CARE = [
  { key: "sick", icon: HeartPulse },
  { key: "sos", icon: ShieldHalf },
  { key: "checkin", icon: MapPinCheck },
  { key: "mood", icon: Smile },
  { key: "family", icon: PhoneCall },
  { key: "survival", icon: HandHeart },
] as const;

const TRUST = [
  { key: "ledger", icon: BarChart3 },
  { key: "isolated", icon: ShieldCheck },
  { key: "bangla", icon: Languages },
  { key: "manager", icon: KeyRound },
] as const;

export default function HomePage() {
  const t = useTranslations("landing");

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">
        {t("skip")}
      </a>
      <SiteHeader />
      <main id="main">
        {/* ------------------------------------------------------------ hero */}
        <section className="glow-mint relative overflow-hidden">
          <div className="bg-dots pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 md:grid-cols-[1.15fr_1fr] md:pt-20">
            <div className="animate-fade-up">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-mint-soft px-3 py-1 text-xs font-medium text-mint">
                <Sparkles className="size-3.5" aria-hidden="true" />
                {t("hero.badge")}
              </span>
              <h1 className="mt-5 text-[2.35rem] font-bold leading-[1.15] sm:text-5xl md:text-[3.4rem]">
                {t("hero.titleLead")}{" "}
                <span className="bg-linear-to-r from-[#2dd4a7] via-[#5ee0bd] to-[#f5a524] bg-clip-text text-transparent">
                  {t("hero.titleHighlight")}
                </span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">{t("hero.subtitle")}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="shadow-lg shadow-primary/20">
                  <Link href="/signup">
                    {t("hero.ctaPrimary")}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/onboarding">{t("hero.ctaSecondary")}</Link>
                </Button>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">{t("hero.note")}</p>
            </div>
            <div className="relative mx-auto">
              <div className="absolute -inset-10 rounded-full bg-primary/15 blur-3xl" aria-hidden="true" />
              <PhoneMockup className="relative motion-safe:animate-float" />
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------------- trust */}
        <section className="border-y bg-surface/60">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
            {TRUST.map(({ key, icon: Icon }) => (
              <div key={key} className="flex gap-3">
                <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <p className="font-semibold">{t(`trust.${key}.title`)}</p>
                  <p className="text-sm text-muted-foreground">{t(`trust.${key}.body`)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* -------------------------------------------------------- features */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-primary">{t("features.eyebrow")}</p>
            <h2 className="mt-2 text-3xl font-bold sm:text-4xl">{t("features.title")}</h2>
            <p className="mt-3 text-muted-foreground">{t("features.subtitle")}</p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ key, icon: Icon, tone }) => (
              <article key={key} className="card-hover rounded-2xl border bg-card p-6">
                <span className={`flex size-11 items-center justify-center rounded-xl ${tone}`}>
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{t(`features.items.${key}.title`)}</h3>
                <p className="mt-1.5 text-[0.95rem] leading-relaxed text-muted-foreground">{t(`features.items.${key}.body`)}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------------ care */}
        <section id="care" className="scroll-mt-20 border-y bg-[linear-gradient(180deg,transparent,color-mix(in_srgb,var(--coral)_6%,transparent))]">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-coral">{t("care.eyebrow")}</p>
              <h2 className="mt-2 text-3xl font-bold sm:text-4xl">{t("care.title")}</h2>
              <p className="mt-3 text-muted-foreground">{t("care.subtitle")}</p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {CARE.map(({ key, icon: Icon }) => (
                <article key={key} className="card-hover rounded-2xl border bg-card p-6">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-coral-soft text-coral">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">{t(`care.items.${key}.title`)}</h3>
                  <p className="mt-1.5 text-[0.95rem] leading-relaxed text-muted-foreground">{t(`care.items.${key}.body`)}</p>
                </article>
              ))}
            </div>
            <p className="mt-8 flex items-start gap-2 rounded-xl border border-coral/30 bg-coral-soft px-4 py-3 text-sm">
              <ShieldHalf className="mt-0.5 size-4 shrink-0 text-coral" aria-hidden="true" />
              {t("care.note")}
            </p>
          </div>
        </section>

        {/* ---------------------------------------------------- how it works */}
        <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
          <h2 className="text-3xl font-bold sm:text-4xl">{t("how.title")}</h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {(["create", "invite", "relax"] as const).map((key, i) => (
              <li key={key} className="relative rounded-2xl border bg-card p-6">
                <span className="num flex size-10 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-lg font-semibold">{t(`how.steps.${key}.title`)}</h3>
                <p className="mt-1.5 text-[0.95rem] text-muted-foreground">{t(`how.steps.${key}.body`)}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ------------------------------------------------------------- faq */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 pb-20 sm:px-6">
          <h2 className="mb-8 text-center text-3xl font-bold sm:text-4xl">{t("faq.title")}</h2>
          <Faq />
        </section>

        {/* ------------------------------------------------------------- cta */}
        <section className="px-4 pb-20 sm:px-6">
          <div className="glow-mint mx-auto max-w-6xl overflow-hidden rounded-3xl border bg-card px-6 py-14 text-center sm:px-12">
            <Users className="mx-auto size-10 text-primary" aria-hidden="true" />
            <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-bold sm:text-4xl">{t("cta.title")}</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">{t("cta.body")}</p>
            <Button asChild size="lg" className="mt-8 shadow-lg shadow-primary/20">
              <Link href="/signup">
                {t("cta.button")}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

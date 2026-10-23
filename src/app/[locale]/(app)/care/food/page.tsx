import { ArrowRight, Clock, CookingPot, HeartPulse, Users, UtensilsCrossed, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { CareNav } from "@/components/care/care-nav";
import { SubmitRecipeButton } from "@/components/care/community-care";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { ToneBadge } from "@/components/shared/tone-badge";
import { Link } from "@/i18n/navigation";
import { requireOnboarded } from "@/lib/dal";
import { formatNumber, formatTaka } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { EQUIPMENT } from "@/lib/validations/care";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("care.food");
  return { title: t("title") };
}

export default async function FoodPage({ searchParams }: PageProps<"/[locale]/care/food">) {
  const viewer = await requireOnboarded();
  const sp = await searchParams;
  const equipment = EQUIPMENT.find((e) => e === sp.eq) ?? null;
  const sick = sp.sick === "1";
  const budget = sp.budget === "1";
  const supabase = await createClient();

  let query = supabase
    .from("recipes")
    .select("id, title_bn, title_en, description, ingredients, steps, equipment, cook_minutes, servings, cost_estimate, is_budget, is_sick_friendly, status, created_by")
    .order("cost_estimate", { ascending: true, nullsFirst: false })
    .limit(80);
  query = query.or(`status.eq.approved,created_by.eq.${viewer.id}`);
  if (equipment) query = query.eq("equipment", equipment);
  if (sick) query = query.eq("is_sick_friendly", true);
  if (budget) query = query.eq("is_budget", true);

  const [{ data, error }, t, te, locale] = await Promise.all([query, getTranslations("care.food"), getTranslations("equipment"), getLocale()]);
  if (error) throw new Error(error.message);
  const recipes = data ?? [];
  const chip = (active: boolean) =>
    cn(
      "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm transition-colors",
      active ? "border-primary/50 bg-mint-soft font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
    );
  const href = (patch: Record<string, string | null>) => {
    const next = { eq: equipment, sick: sick ? "1" : null, budget: budget ? "1" : null, ...patch };
    const qs = new URLSearchParams(Object.entries(next).filter((e): e is [string, string] => Boolean(e[1])));
    return qs.size ? `/care/food?${qs}` : "/care/food";
  };

  return (
    <div className="grid gap-5">
      <PageHeader title={t("title")} description={t("subtitle")} actions={<SubmitRecipeButton />} />
      <CareNav active="food" />

      <Link href="/services?cat=tiffin" className="card-hover flex items-center gap-3 rounded-2xl border bg-card p-4">
        <span className="flex size-11 items-center justify-center rounded-xl bg-marigold-soft text-marigold">
          <UtensilsCrossed className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{t("tiffinTitle")}</span>
          <span className="block text-sm text-muted-foreground">{t("tiffinBody")}</span>
        </span>
        <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
      </Link>

      <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label={t("filters")}>
        <Link href={href({ eq: null })} className={chip(!equipment)} aria-current={!equipment ? "page" : undefined}>
          {t("all")}
        </Link>
        {EQUIPMENT.map((e) => (
          <Link key={e} href={href({ eq: e })} className={chip(equipment === e)} aria-current={equipment === e ? "page" : undefined}>
            {te(e)}
          </Link>
        ))}
        <Link href={href({ sick: sick ? null : "1" })} className={chip(sick)} aria-pressed={sick}>
          <HeartPulse className="size-4" aria-hidden="true" />
          {t("sick")}
        </Link>
        <Link href={href({ budget: budget ? null : "1" })} className={chip(budget)} aria-pressed={budget}>
          <Wallet className="size-4" aria-hidden="true" />
          {t("budget")}
        </Link>
      </nav>

      {recipes.length === 0 ? (
        <EmptyState icon={CookingPot} title={t("empty")} body={t("emptyBody")} className="rounded-2xl border bg-card py-12" />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {recipes.map((r) => (
            <li key={r.id} className="rounded-2xl border bg-card">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-start gap-3 p-4 [&::-webkit-details-marker]:hidden">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-mint-soft text-mint">
                    <CookingPot className="size-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{(locale === "en" && r.title_en) || r.title_bn}</span>
                      {r.status !== "approved" && <ToneBadge tone="marigold">{t("pending")}</ToneBadge>}
                      {r.is_sick_friendly && <ToneBadge tone="sky">{t("sickBadge")}</ToneBadge>}
                    </span>
                    {r.description && <span className="mt-0.5 block text-sm text-muted-foreground">{r.description}</span>}
                    <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{te(r.equipment)}</span>
                      {r.cook_minutes && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-3" aria-hidden="true" />
                          {t("minutes", { count: formatNumber(r.cook_minutes, locale) })}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3" aria-hidden="true" />
                        {t("servings", { count: formatNumber(r.servings, locale) })}
                      </span>
                      {r.cost_estimate !== null && <span>{t("cost", { amount: formatTaka(Number(r.cost_estimate), locale) })}</span>}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-primary group-open:hidden">{t("show")}</span>
                </summary>
                <div className="grid gap-3 border-t px-4 pb-4 pt-3 text-sm">
                  <div>
                    <h3 className="mb-1 font-semibold">{t("ingredients")}</h3>
                    <p className="whitespace-pre-line text-muted-foreground">{r.ingredients}</p>
                  </div>
                  <div>
                    <h3 className="mb-1 font-semibold">{t("steps")}</h3>
                    <p className="whitespace-pre-line leading-relaxed">{r.steps}</p>
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { BadgeCheck, MapPin, Phone, Plus, Wrench } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Stars } from "@/components/community/bits";
import { ServicesFilters, type ServiceFilterState } from "@/components/services/services-filters";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { type Tone, ToneBadge } from "@/components/shared/tone-badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { areaName, getAreas } from "@/lib/community";
import { requireOnboarded } from "@/lib/dal";
import { formatNumber } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { SERVICE_CATEGORIES } from "@/lib/validations/community";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("services");
  return { title: t("title") };
}

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
const STATUS_TONE: Record<string, Tone> = { pending: "marigold", approved: "mint", rejected: "coral", archived: "muted" };

export default async function ServicesPage({ searchParams }: PageProps<"/[locale]/services">) {
  const viewer = await requireOnboarded();
  const sp = await searchParams;
  const filters: ServiceFilterState = {
    cat: SERVICE_CATEGORIES.find((c) => c === sp.cat) ?? "",
    area: /^\d+$/.test(str(sp.area)) ? str(sp.area) : "",
    verified: sp.verified === "1",
    mine: sp.mine === "1",
  };
  const supabase = await createClient();
  const [areas, t, tc, ts, locale] = await Promise.all([
    getAreas(),
    getTranslations("services"),
    getTranslations("serviceCategories"),
    getTranslations("moderationStatus"),
    getLocale(),
  ]);
  const areaById = new Map(areas.map((a) => [a.id, a]));

  let query = supabase
    .from("service_providers")
    .select("id, name, category, area_id, phone, price_note, is_verified, avg_rating, rating_count, status", { count: "exact" });
  query = filters.mine ? query.eq("owner_id", viewer.id) : query.eq("status", "approved");
  if (filters.cat) query = query.eq("category", filters.cat as (typeof SERVICE_CATEGORIES)[number]);
  // a provider with no area serves all of Dhaka, so it matches every area filter
  if (filters.area) query = query.or(`area_id.eq.${Number(filters.area)},area_id.is.null`);
  if (filters.verified) query = query.eq("is_verified", true);
  const { data, count, error } = await query
    .order("is_verified", { ascending: false })
    .order("avg_rating", { ascending: false })
    .order("rating_count", { ascending: false })
    .limit(60);
  if (error) throw new Error(error.message);
  const providers = data ?? [];
  const filtered = Boolean(filters.cat || filters.area || filters.verified || filters.mine);

  return (
    <div className="grid gap-5">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button asChild>
            <Link href="/services/new">
              <Plus className="size-4" aria-hidden="true" />
              {t("suggest")}
            </Link>
          </Button>
        }
      />
      <ServicesFilters areas={areas} value={filters} />
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t("results", { count: formatNumber(count ?? providers.length, locale) })}
      </p>

      {providers.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title={filters.mine ? t("emptyMine") : filtered ? t("emptyFiltered") : t("empty")}
          body={t("emptyBody")}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {filtered && (
                <Button asChild variant="outline">
                  <Link href="/services">{t("clearFilters")}</Link>
                </Button>
              )}
              <Button asChild>
                <Link href="/services/new">{t("suggest")}</Link>
              </Button>
            </div>
          }
          className="rounded-2xl border bg-card py-12"
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {providers.map((p) => (
            <li key={p.id} className="card-hover relative flex items-start gap-3 rounded-2xl border bg-card p-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sky-soft text-sky">
                <Wrench className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 font-medium">
                  <Link href={`/services/${p.id}`} className="after:absolute after:inset-0 focus-visible:outline-none">
                    {p.name}
                  </Link>
                  {p.is_verified && (
                    <span className="inline-flex items-center gap-0.5 text-xs font-normal text-mint">
                      <BadgeCheck className="size-4" aria-hidden="true" />
                      {t("verified")}
                    </span>
                  )}
                  {filters.mine && <ToneBadge tone={STATUS_TONE[p.status]}>{ts(p.status)}</ToneBadge>}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {tc(p.category)}
                  {" · "}
                  <MapPin className="inline size-3.5 align-[-2px]" aria-hidden="true" /> {areaName(p.area_id ? areaById.get(p.area_id) : undefined, locale) ?? t("allDhaka")}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Stars value={Number(p.avg_rating)} count={p.rating_count} />
                  {p.price_note && <span className="truncate text-xs text-muted-foreground">{p.price_note}</span>}
                </div>
              </div>
              <Button asChild size="icon" variant="outline" className="relative z-10 shrink-0">
                <a href={`tel:${p.phone}`} aria-label={t("call", { name: p.name })}>
                  <Phone className="size-4" />
                </a>
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">{t("disclaimer")}</p>
    </div>
  );
}

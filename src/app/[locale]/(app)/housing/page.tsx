import { Building2, Plus } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { HousingFilters, type HousingFilterState } from "@/components/housing/housing-filters";
import { HousingTabs } from "@/components/housing/housing-tabs";
import { ListingCard, type ListingCardData } from "@/components/housing/listing-card";
import { ListingsMap } from "@/components/housing/listings-map";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { areaName, getAreas } from "@/lib/community";
import { requireOnboarded } from "@/lib/dal";
import { formatNumber, formatTaka } from "@/lib/format";
import { publicPhotoUrl } from "@/lib/links";
import { createClient } from "@/lib/supabase/server";
import { LISTING_TYPES } from "@/lib/validations/community";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("housing");
  return { title: t("title") };
}

const PAGE = 18;
const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function HousingPage({ searchParams }: PageProps<"/[locale]/housing">) {
  await requireOnboarded();
  const sp = await searchParams;
  const filters: HousingFilterState = {
    area: /^\d+$/.test(str(sp.area)) ? str(sp.area) : "",
    type: LISTING_TYPES.find((x) => x === sp.type) ?? "",
    max: /^\d{1,7}$/.test(str(sp.max)) ? str(sp.max) : "",
    gender: sp.gender === "male" || sp.gender === "female" ? sp.gender : "",
    sort: sp.sort === "rent_asc" || sp.sort === "rent_desc" ? sp.sort : "new",
    saved: sp.saved === "1",
    view: sp.view === "map" ? "map" : "list",
  };
  const page = Math.min(Math.max(Number.parseInt(str(sp.page) || "1", 10) || 1, 1), 20);

  const supabase = await createClient();
  const [areas, t, locale] = await Promise.all([getAreas(), getTranslations("housing"), getLocale()]);
  const areaById = new Map(areas.map((a) => [a.id, a]));

  let savedIds: string[] | null = null;
  if (filters.saved) {
    const { data } = await supabase.from("saved_listings").select("listing_id");
    savedIds = (data ?? []).map((s) => s.listing_id);
  }

  let query = supabase
    .from("listings")
    .select(
      "id, listing_type, title, area_id, rent, seats_available, gender_pref, facilities, lat, lng, available_from, created_at, photos:listing_photos(storage_path, sort_order), saved:saved_listings(user_id)",
      { count: "exact" },
    )
    .eq("status", "approved")
    .eq("is_filled", false);
  if (filters.area) query = query.eq("area_id", Number(filters.area));
  if (filters.type) query = query.eq("listing_type", filters.type as (typeof LISTING_TYPES)[number]);
  if (filters.max) query = query.lte("rent", Number(filters.max));
  if (filters.gender) query = query.in("gender_pref", [filters.gender as "male" | "female", "any"]);
  if (savedIds) query = query.in("id", savedIds.length ? savedIds : ["00000000-0000-0000-0000-000000000000"]);
  query =
    filters.sort === "rent_asc"
      ? query.order("rent", { ascending: true })
      : filters.sort === "rent_desc"
        ? query.order("rent", { ascending: false })
        : query.order("created_at", { ascending: false });
  query = filters.view === "map" ? query.not("lat", "is", null).limit(200) : query.range(0, page * PAGE - 1);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  const rows = data ?? [];

  const cards: ListingCardData[] = rows.map((l) => {
    const cover = [...(l.photos ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0];
    return {
      id: l.id,
      title: l.title,
      listingType: l.listing_type,
      rent: Number(l.rent),
      area: areaName(areaById.get(l.area_id), locale),
      seats: l.seats_available,
      genderPref: l.gender_pref,
      facilities: l.facilities,
      cover: cover ? publicPhotoUrl("listing-photos", cover.storage_path) : null,
      saved: (l.saved ?? []).length > 0,
      availableFrom: l.available_from,
    };
  });
  const total = count ?? rows.length;
  const filtered = Boolean(filters.area || filters.type || filters.max || filters.gender || filters.saved);
  const moreHref = () => {
    const qs = new URLSearchParams(
      Object.entries({ ...sp, page: String(page + 1) }).filter((e): e is [string, string] => typeof e[1] === "string"),
    );
    return `/housing?${qs}`;
  };

  return (
    <div className="grid gap-5">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <>
            <Button asChild variant="outline" className="hidden sm:inline-flex">
              <Link href="/housing/mine">{t("mine")}</Link>
            </Button>
            <Button asChild>
              <Link href="/housing/new">
                <Plus className="size-4" aria-hidden="true" />
                {t("post")}
              </Link>
            </Button>
          </>
        }
      />
      <HousingTabs active="listings" />
      <HousingFilters areas={areas} value={filters} />

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t("results", { count: formatNumber(total, locale) })}
      </p>

      {rows.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={filters.saved ? t("emptySaved") : filtered ? t("emptyFiltered") : t("empty")}
          body={t("emptyBody")}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {filtered && (
                <Button asChild variant="outline">
                  <Link href="/housing">{t("clearFilters")}</Link>
                </Button>
              )}
              <Button asChild>
                <Link href="/housing/new">{t("post")}</Link>
              </Button>
            </div>
          }
          className="rounded-2xl border bg-card py-12"
        />
      ) : filters.view === "map" ? (
        <ListingsMap
          pins={rows
            .filter((l) => l.lat !== null && l.lng !== null)
            .map((l) => ({
              id: l.id,
              lat: Number(l.lat),
              lng: Number(l.lng),
              title: l.title,
              subtitle: `${formatTaka(l.rent, locale)} · ${areaName(areaById.get(l.area_id), locale) ?? ""}`,
              href: `/housing/${l.id}`,
            }))}
        />
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((c) => (
              <li key={c.id}>
                <ListingCard listing={c} />
              </li>
            ))}
          </ul>
          {total > rows.length && (
            <Button asChild variant="outline" className="mx-auto">
              <Link href={moreHref()} scroll={false}>
                {t("showMore")}
              </Link>
            </Button>
          )}
        </>
      )}
      {filters.view === "map" && rows.length > 0 && <p className="text-xs text-muted-foreground">{t("mapNote")}</p>}
    </div>
  );
}

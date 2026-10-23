import { MapPin, Plus, Store } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { CoverPhoto } from "@/components/community/bits";
import { MarketFilters, type MarketFilterState } from "@/components/market/market-filters";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { ToneBadge } from "@/components/shared/tone-badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { areaName, getAreas } from "@/lib/community";
import { requireOnboarded } from "@/lib/dal";
import { formatDate, formatNumber, formatTaka } from "@/lib/format";
import { publicPhotoUrl } from "@/lib/links";
import { createClient } from "@/lib/supabase/server";
import { MARKET_CATEGORIES } from "@/lib/validations/community";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("market");
  return { title: t("title") };
}

const PAGE = 24;
const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export default async function MarketPage({ searchParams }: PageProps<"/[locale]/market">) {
  const viewer = await requireOnboarded();
  const sp = await searchParams;
  const messId = viewer.context.membership?.status === "active" || viewer.context.membership?.status === "inactive" ? viewer.context.membership.mess_id : null;
  const filters: MarketFilterState = {
    q: str(sp.q).trim().slice(0, 60),
    cat: MARKET_CATEGORIES.find((c) => c === sp.cat) ?? "",
    area: /^\d+$/.test(str(sp.area)) ? str(sp.area) : "",
    scope: sp.scope === "mine" ? "mine" : sp.scope === "mess" && messId ? "mess" : "",
    sort: sp.sort === "price_asc" || sp.sort === "price_desc" ? sp.sort : "new",
  };
  const page = Math.min(Math.max(Number.parseInt(str(sp.page) || "1", 10) || 1, 1), 20);

  const supabase = await createClient();
  const [areas, t, tc, ti, locale] = await Promise.all([
    getAreas(),
    getTranslations("market"),
    getTranslations("marketCategories"),
    getTranslations("itemConditions"),
    getLocale(),
  ]);
  const areaById = new Map(areas.map((a) => [a.id, a]));

  let query = supabase
    .from("market_items")
    .select("id, title, category, condition, price, is_negotiable, area_id, status, created_at, photos:market_item_photos(storage_path, sort_order)", {
      count: "exact",
    });
  query = filters.scope === "mine" ? query.eq("seller_id", viewer.id) : query.in("status", ["available", "reserved"]);
  if (filters.scope === "mess" && messId) query = query.eq("mess_id", messId);
  if (filters.cat) query = query.eq("category", filters.cat as (typeof MARKET_CATEGORIES)[number]);
  if (filters.area) query = query.eq("area_id", Number(filters.area));
  if (filters.q) query = query.ilike("title", `%${likeEscape(filters.q)}%`);
  query =
    filters.sort === "price_asc"
      ? query.order("price", { ascending: true })
      : filters.sort === "price_desc"
        ? query.order("price", { ascending: false })
        : query.order("created_at", { ascending: false });
  const { data, count, error } = await query.range(0, page * PAGE - 1);
  if (error) throw new Error(error.message);
  const items = data ?? [];
  const total = count ?? items.length;
  const filtered = Boolean(filters.q || filters.cat || filters.area || filters.scope);
  const moreHref = () => {
    const qs = new URLSearchParams(Object.entries({ ...sp, page: String(page + 1) }).filter((e): e is [string, string] => typeof e[1] === "string"));
    return `/market?${qs}`;
  };

  return (
    <div className="grid gap-5">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button asChild>
            <Link href="/market/new">
              <Plus className="size-4" aria-hidden="true" />
              {t("sell")}
            </Link>
          </Button>
        }
      />
      <MarketFilters areas={areas} value={filters} hasMess={Boolean(messId)} />
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t("results", { count: formatNumber(total, locale) })}
      </p>

      {items.length === 0 ? (
        <EmptyState
          icon={Store}
          title={filters.scope === "mine" ? t("emptyMine") : filtered ? t("emptyFiltered") : t("empty")}
          body={t("emptyBody")}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {filtered && (
                <Button asChild variant="outline">
                  <Link href="/market">{t("clearFilters")}</Link>
                </Button>
              )}
              <Button asChild>
                <Link href="/market/new">{t("sell")}</Link>
              </Button>
            </div>
          }
          className="rounded-2xl border bg-card py-12"
        />
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {items.map((i) => {
              const cover = [...(i.photos ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0];
              return (
                <li key={i.id}>
                  <article className="card-hover relative h-full overflow-hidden rounded-2xl border bg-card">
                    <div className="relative">
                      <CoverPhoto src={cover ? publicPhotoUrl("market-photos", cover.storage_path) : null} alt={i.title} className="aspect-square w-full" />
                      {i.status !== "available" && (
                        <span className="absolute left-2 top-2">
                          <ToneBadge tone={i.status === "reserved" ? "marigold" : "muted"}>{t(`status.${i.status}`)}</ToneBadge>
                        </span>
                      )}
                    </div>
                    <div className="grid gap-1 p-3">
                      <p className="font-semibold">
                        {formatTaka(i.price, locale)}
                        {i.is_negotiable && <span className="text-xs font-normal text-muted-foreground"> · {t("negotiable")}</span>}
                      </p>
                      <h3 className="line-clamp-2 text-sm leading-snug">
                        <Link href={`/market/${i.id}`} className="after:absolute after:inset-0 focus-visible:outline-none">
                          {i.title}
                        </Link>
                      </h3>
                      <p className="truncate text-xs text-muted-foreground">
                        {tc(i.category)} · {ti(i.condition)}
                      </p>
                      <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        {i.area_id && (
                          <>
                            <MapPin className="size-3 shrink-0" aria-hidden="true" />
                            {areaName(areaById.get(i.area_id), locale)} ·{" "}
                          </>
                        )}
                        {formatDate(i.created_at, locale, { day: "numeric", month: "short" })}
                      </p>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
          {total > items.length && (
            <Button asChild variant="outline" className="mx-auto">
              <Link href={moreHref()} scroll={false}>
                {t("showMore")}
              </Link>
            </Button>
          )}
        </>
      )}
      <p className="text-xs text-muted-foreground">{t("safety")}</p>
    </div>
  );
}

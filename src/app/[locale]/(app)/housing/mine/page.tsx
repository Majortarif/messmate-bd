import { Building2, Eye, Plus } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { CoverPhoto } from "@/components/community/bits";
import { HousingTabs } from "@/components/housing/housing-tabs";
import { ListingOwnerActions } from "@/components/housing/listing-owner-actions";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { type Tone, ToneBadge } from "@/components/shared/tone-badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { areaName, getAreas } from "@/lib/community";
import { requireOnboarded } from "@/lib/dal";
import { formatDate, formatTaka } from "@/lib/format";
import { publicPhotoUrl } from "@/lib/links";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("housing");
  return { title: t("mine") };
}

const STATUS_TONE: Record<string, Tone> = { pending: "marigold", approved: "mint", rejected: "coral", archived: "muted" };

export default async function MyListingsPage() {
  const viewer = await requireOnboarded();
  const supabase = await createClient();
  const [{ data, error }, areas, t, ts, tt, locale] = await Promise.all([
    supabase
      .from("listings")
      .select("id, title, listing_type, rent, area_id, status, is_filled, rejection_reason, updated_at, photos:listing_photos(storage_path, sort_order)")
      .eq("owner_id", viewer.id)
      .order("updated_at", { ascending: false }),
    getAreas(),
    getTranslations("housing"),
    getTranslations("moderationStatus"),
    getTranslations("listingTypes"),
    getLocale(),
  ]);
  if (error) throw new Error(error.message);
  const listings = data ?? [];
  const areaById = new Map(areas.map((a) => [a.id, a]));

  return (
    <div className="grid gap-5">
      <PageHeader
        title={t("mine")}
        description={t("mineSubtitle")}
        actions={
          <Button asChild>
            <Link href="/housing/new">
              <Plus className="size-4" aria-hidden="true" />
              {t("post")}
            </Link>
          </Button>
        }
      />
      <HousingTabs active="listings" />
      {listings.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={t("mineEmpty")}
          body={t("mineEmptyBody")}
          action={
            <Button asChild>
              <Link href="/housing/new">{t("post")}</Link>
            </Button>
          }
          className="rounded-2xl border bg-card py-12"
        />
      ) : (
        <ul className="grid gap-3">
          {listings.map((l) => {
            const cover = [...(l.photos ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0];
            return (
              <li key={l.id} className="flex gap-3 rounded-2xl border bg-card p-3">
                <CoverPhoto
                  src={cover ? publicPhotoUrl("listing-photos", cover.storage_path) : null}
                  alt={l.title}
                  className="size-20 shrink-0 rounded-xl sm:h-24 sm:w-32"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <ToneBadge tone={STATUS_TONE[l.status]}>{ts(l.status)}</ToneBadge>
                    {l.is_filled && <ToneBadge tone="muted">{t("filled")}</ToneBadge>}
                    <span className="text-xs text-muted-foreground">{tt(l.listing_type)}</span>
                  </div>
                  <p className="mt-1 truncate font-medium">{l.title}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {formatTaka(l.rent, locale)} · {areaName(areaById.get(l.area_id), locale)} ·{" "}
                    {t("updated", { date: formatDate(l.updated_at, locale, { day: "numeric", month: "short" }) })}
                  </p>
                  {l.status === "rejected" && l.rejection_reason && (
                    <p className="mt-1 text-xs text-coral">{t("reason", { reason: l.rejection_reason })}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
                  <Button asChild variant="ghost" size="icon" aria-label={t("view", { title: l.title })}>
                    <Link href={`/housing/${l.id}`}>
                      <Eye className="size-4" />
                    </Link>
                  </Button>
                  <ListingOwnerActions id={l.id} title={l.title} status={l.status} filled={l.is_filled} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

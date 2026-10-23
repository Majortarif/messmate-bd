import { ArrowLeft, CalendarDays, Clock3, MapPin, Navigation, ShieldAlert, Users } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { ContactButtons, FacilityList, PhotoGallery } from "@/components/community/bits";
import { GeoMap } from "@/components/community/geo-map";
import { ReportButton, SaveButton } from "@/components/community/interactive";
import { ListingOwnerActions } from "@/components/housing/listing-owner-actions";
import { type Tone, ToneBadge } from "@/components/shared/tone-badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { areaName, getAreas, getDisplayNames } from "@/lib/community";
import { requireOnboarded } from "@/lib/dal";
import { formatDate, formatNumber, formatTaka } from "@/lib/format";
import { directionsHref, publicPhotoUrl } from "@/lib/links";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("housing");
  return { title: t("detailTitle"), robots: { index: false } };
}

const STATUS_TONE: Record<string, Tone> = { pending: "marigold", approved: "mint", rejected: "coral", archived: "muted" };

export default async function ListingPage({ params }: PageProps<"/[locale]/housing/[id]">) {
  const viewer = await requireOnboarded();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const [result, areas, t, tt, ts, locale] = await Promise.all([
    supabase
      .from("listings")
      .select("*, photos:listing_photos(storage_path, sort_order), saved:saved_listings(user_id)")
      .eq("id", id)
      .maybeSingle(),
    getAreas(),
    getTranslations("housing"),
    getTranslations("listingTypes"),
    getTranslations("moderationStatus"),
    getLocale(),
  ]);
  const l = result.data;
  if (!l) notFound();

  const isOwner = l.owner_id === viewer.id;
  const area = areas.find((a) => a.id === l.area_id);
  const names = await getDisplayNames(supabase, [l.owner_id]);
  const photos = [...(l.photos ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((p) => publicPhotoUrl("listing-photos", p.storage_path));
  const lat = l.lat === null ? null : Number(l.lat);
  const lng = l.lng === null ? null : Number(l.lng);
  const postedBy = l.contact_name || names.get(l.owner_id)?.name || t("someone");
  const fact = (label: string, value: string) => (
    <div className="rounded-xl bg-muted/50 px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={isOwner ? "/housing/mine" : "/housing"}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            {isOwner ? t("mine") : t("backToListings")}
          </Link>
        </Button>
        {isOwner && <ListingOwnerActions id={l.id} title={l.title} status={l.status} filled={l.is_filled} afterDelete="/housing/mine" />}
      </div>

      {isOwner && l.status !== "approved" && (
        <div className="flex items-start gap-3 rounded-2xl border border-marigold/30 bg-marigold-soft p-4 text-sm">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-marigold" aria-hidden="true" />
          <p>
            {t(`ownerNote.${l.status}`)}
            {l.status === "rejected" && l.rejection_reason ? ` ${t("reason", { reason: l.rejection_reason })}` : ""}
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="grid min-w-0 content-start gap-5">
          <PhotoGallery photos={photos} alt={l.title} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <ToneBadge tone="sky">{tt(l.listing_type)}</ToneBadge>
              {l.is_filled && <ToneBadge tone="muted">{t("filled")}</ToneBadge>}
              {isOwner && <ToneBadge tone={STATUS_TONE[l.status]}>{ts(l.status)}</ToneBadge>}
            </div>
            <h1 className="mt-2 text-2xl font-semibold leading-tight sm:text-[1.7rem]">{l.title}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-4" aria-hidden="true" />
              {[l.address_line, areaName(area, locale)].filter(Boolean).join(", ")}
            </p>
          </div>

          {l.description && <p className="whitespace-pre-line leading-relaxed">{l.description}</p>}

          {l.facilities.length > 0 && (
            <section>
              <h2 className="mb-2 font-semibold">{t("facilitiesTitle")}</h2>
              <FacilityList items={l.facilities} />
            </section>
          )}

          <section>
            <h2 className="mb-2 font-semibold">{t("whoTitle")}</h2>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {fact(t("genderLabel"), t(`genderPref.${l.gender_pref}`))}
              {fact(t("tenantLabel"), t(`tenantPref.${l.tenant_pref}`))}
            </dl>
          </section>

          {lat !== null && lng !== null && (
            <section className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold">{t("mapTitle")}</h2>
                <Button asChild variant="ghost" size="sm">
                  <a href={directionsHref(lat, lng)} target="_blank" rel="noreferrer">
                    <Navigation className="size-4" aria-hidden="true" />
                    {t("directions")}
                  </a>
                </Button>
              </div>
              <GeoMap pins={[{ id: l.id, lat, lng, title: l.title }]} label={t("mapLabelOne", { title: l.title })} className="h-64" />
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="grid gap-4 rounded-2xl border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-2xl font-semibold">
                {formatTaka(l.rent, locale)}
                <span className="text-sm font-normal text-muted-foreground"> {t("perMonth")}</span>
              </p>
              {!isOwner && <SaveButton listingId={l.id} saved={(l.saved ?? []).length > 0} className="border" />}
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {fact(t("advance"), formatTaka(l.advance_deposit, locale))}
              {fact(t("seatsLabel"), formatNumber(l.seats_available, locale))}
            </dl>
            <ul className="grid gap-1.5 text-sm text-muted-foreground">
              {l.available_from && (
                <li className="flex items-center gap-2">
                  <CalendarDays className="size-4" aria-hidden="true" />
                  {t("availableFrom", { date: formatDate(l.available_from, locale, { day: "numeric", month: "long" }) })}
                </li>
              )}
              <li className="flex items-center gap-2">
                <Users className="size-4" aria-hidden="true" />
                {t("postedBy", { name: postedBy })}
              </li>
              <li className="flex items-center gap-2">
                <Clock3 className="size-4" aria-hidden="true" />
                {t("updated", { date: formatDate(l.updated_at, locale, { day: "numeric", month: "short", year: "numeric" }) })}
              </li>
            </ul>
            {!l.is_filled && <ContactButtons phone={l.contact_phone} name={postedBy} message={t("whatsappText", { title: l.title })} />}
            <p className="text-xs leading-relaxed text-muted-foreground">{t("safety")}</p>
          </div>
          {!isOwner && (
            <div className="mt-2 flex justify-end">
              <ReportButton kind="listing" id={l.id} title={l.title} />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

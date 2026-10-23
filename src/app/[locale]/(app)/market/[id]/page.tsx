import { ArrowLeft, Clock3, MapPin, ShieldAlert, Tag, UserRound } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { ContactButtons, PhotoGallery } from "@/components/community/bits";
import { ReportButton } from "@/components/community/interactive";
import { MarketOwnerActions } from "@/components/market/market-owner-actions";
import { ToneBadge } from "@/components/shared/tone-badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { areaName, getAreas, getDisplayNames } from "@/lib/community";
import { requireOnboarded } from "@/lib/dal";
import { formatDate, formatTaka } from "@/lib/format";
import { publicPhotoUrl } from "@/lib/links";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("market");
  return { title: t("detailTitle"), robots: { index: false } };
}

export default async function MarketItemPage({ params }: PageProps<"/[locale]/market/[id]">) {
  const viewer = await requireOnboarded();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const [{ data: item }, areas, t, tc, ti, locale] = await Promise.all([
    supabase.from("market_items").select("*, photos:market_item_photos(storage_path, sort_order)").eq("id", id).maybeSingle(),
    getAreas(),
    getTranslations("market"),
    getTranslations("marketCategories"),
    getTranslations("itemConditions"),
    getLocale(),
  ]);
  if (!item) notFound();

  const isSeller = item.seller_id === viewer.id;
  const names = await getDisplayNames(supabase, [item.seller_id]);
  const seller = names.get(item.seller_id)?.name ?? t("someone");
  const photos = [...(item.photos ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((p) => publicPhotoUrl("market-photos", p.storage_path));
  const area = item.area_id ? areaName(areas.find((a) => a.id === item.area_id), locale) : undefined;
  const open = item.status === "available" || item.status === "reserved";

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={isSeller ? "/market?scope=mine" : "/market"}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            {isSeller ? t("myItems") : t("back")}
          </Link>
        </Button>
        {isSeller && <MarketOwnerActions id={item.id} title={item.title} status={item.status} afterDelete="/market?scope=mine" />}
      </div>

      {isSeller && item.status === "removed" && (
        <div className="flex items-start gap-3 rounded-2xl border border-coral/30 bg-coral-soft p-4 text-sm">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-coral" aria-hidden="true" />
          {t("removedNote")}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="grid min-w-0 content-start gap-5">
          <PhotoGallery photos={photos} alt={item.title} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <ToneBadge tone="sky">{tc(item.category)}</ToneBadge>
              <ToneBadge tone="muted">{ti(item.condition)}</ToneBadge>
              {item.status !== "available" && (
                <ToneBadge tone={item.status === "reserved" ? "marigold" : "coral"}>{t(`status.${item.status}`)}</ToneBadge>
              )}
            </div>
            <h1 className="mt-2 text-2xl font-semibold leading-tight sm:text-[1.7rem]">{item.title}</h1>
          </div>
          {item.description && <p className="whitespace-pre-line leading-relaxed">{item.description}</p>}
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="grid gap-4 rounded-2xl border bg-card p-5">
            <p className="text-2xl font-semibold">{formatTaka(item.price, locale)}</p>
            <ul className="grid gap-1.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Tag className="size-4" aria-hidden="true" />
                {item.is_negotiable ? t("negotiableLong") : t("fixedPrice")}
              </li>
              {area && (
                <li className="flex items-center gap-2">
                  <MapPin className="size-4" aria-hidden="true" />
                  {area}
                </li>
              )}
              <li className="flex items-center gap-2">
                <UserRound className="size-4" aria-hidden="true" />
                {t("seller", { name: seller })}
              </li>
              <li className="flex items-center gap-2">
                <Clock3 className="size-4" aria-hidden="true" />
                {t("posted", { date: formatDate(item.created_at, locale, { day: "numeric", month: "short", year: "numeric" }) })}
              </li>
            </ul>
            {open && item.contact_phone && !isSeller && (
              <ContactButtons phone={item.contact_phone} name={seller} message={t("whatsappText", { title: item.title })} />
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">{t("safety")}</p>
          </div>
          {!isSeller && (
            <div className="mt-2 flex justify-end">
              <ReportButton kind="market" id={item.id} title={item.title} />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

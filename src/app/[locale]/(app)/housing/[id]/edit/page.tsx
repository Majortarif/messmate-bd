import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { HousingTabs } from "@/components/housing/housing-tabs";
import { ListingForm } from "@/components/housing/listing-form";
import { PageHeader } from "@/components/shared/states";
import { getAreas } from "@/lib/community";
import { requireOnboarded } from "@/lib/dal";
import { publicPhotoUrl } from "@/lib/links";
import { createClient } from "@/lib/supabase/server";
import { FACILITIES, type Facility } from "@/lib/validations/community";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("housing.form");
  return { title: t("editTitle") };
}

export default async function EditListingPage({ params }: PageProps<"/[locale]/housing/[id]/edit">) {
  const viewer = await requireOnboarded();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const [{ data: l }, areas, t] = await Promise.all([
    supabase
      .from("listings")
      .select("*, photos:listing_photos(id, storage_path, sort_order)")
      .eq("id", id)
      .eq("owner_id", viewer.id)
      .maybeSingle(),
    getAreas(),
    getTranslations("housing.form"),
  ]);
  if (!l) notFound();

  return (
    <div className="grid gap-5">
      <PageHeader title={t("editTitle")} description={t("editSubtitle")} />
      <HousingTabs active="listings" />
      <ListingForm
        userId={viewer.id}
        areas={areas}
        listingId={l.id}
        photos={[...(l.photos ?? [])]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((p) => ({ id: p.id, url: publicPhotoUrl("listing-photos", p.storage_path) }))}
        initial={{
          listingType: l.listing_type,
          title: l.title,
          description: l.description ?? "",
          areaId: l.area_id,
          addressLine: l.address_line ?? "",
          lat: l.lat === null ? null : Number(l.lat),
          lng: l.lng === null ? null : Number(l.lng),
          rent: Number(l.rent),
          advanceDeposit: Number(l.advance_deposit),
          availableFrom: l.available_from ?? "",
          genderPref: l.gender_pref,
          tenantPref: l.tenant_pref,
          seatsAvailable: l.seats_available,
          facilities: l.facilities.filter((f): f is Facility => (FACILITIES as readonly string[]).includes(f)),
          contactName: l.contact_name ?? "",
          contactPhone: l.contact_phone,
        }}
      />
    </div>
  );
}

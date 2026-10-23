import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { HousingTabs } from "@/components/housing/housing-tabs";
import { ListingForm } from "@/components/housing/listing-form";
import { PageHeader } from "@/components/shared/states";
import { getAreas } from "@/lib/community";
import { requireOnboarded } from "@/lib/dal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("housing.form");
  return { title: t("newTitle") };
}

export default async function NewListingPage() {
  const viewer = await requireOnboarded();
  const [areas, t] = await Promise.all([getAreas(), getTranslations("housing.form")]);
  return (
    <div className="grid gap-5">
      <PageHeader title={t("newTitle")} description={t("newSubtitle")} />
      <HousingTabs active="listings" />
      <ListingForm
        userId={viewer.id}
        areas={areas}
        initial={{
          listingType: "seat",
          title: "",
          description: "",
          areaId: "",
          addressLine: "",
          lat: null,
          lng: null,
          rent: "",
          advanceDeposit: 0,
          availableFrom: "",
          genderPref: "any",
          tenantPref: "any",
          seatsAvailable: 1,
          facilities: [],
          contactName: viewer.context.profile?.full_name ?? "",
          contactPhone: viewer.context.profile?.phone ?? "",
        }}
      />
    </div>
  );
}

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MarketForm } from "@/components/market/market-form";
import { PageHeader } from "@/components/shared/states";
import { getAreas } from "@/lib/community";
import { requireOnboarded } from "@/lib/dal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("market.form");
  return { title: t("newTitle") };
}

export default async function NewMarketItemPage() {
  const viewer = await requireOnboarded();
  const [areas, t] = await Promise.all([getAreas(), getTranslations("market.form")]);
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-5">
      <PageHeader title={t("newTitle")} description={t("newSubtitle")} />
      <MarketForm
        userId={viewer.id}
        areas={areas}
        initial={{
          title: "",
          description: "",
          category: "furniture",
          condition: "good",
          price: "",
          isNegotiable: true,
          areaId: "",
          contactPhone: viewer.context.profile?.phone ?? "",
        }}
      />
    </div>
  );
}

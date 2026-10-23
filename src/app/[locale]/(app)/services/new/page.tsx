import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ServiceForm } from "@/components/services/service-forms";
import { PageHeader } from "@/components/shared/states";
import { getAreas } from "@/lib/community";
import { requireOnboarded } from "@/lib/dal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("services.form");
  return { title: t("newTitle") };
}

export default async function SuggestServicePage() {
  await requireOnboarded();
  const [areas, t] = await Promise.all([getAreas(), getTranslations("services.form")]);
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-5">
      <PageHeader title={t("newTitle")} description={t("newSubtitle")} />
      <ServiceForm
        areas={areas}
        initial={{ name: "", category: "bua_cook", areaId: "", phone: "", altPhone: "", description: "", priceNote: "" }}
      />
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { ServiceForm } from "@/components/services/service-forms";
import { PageHeader } from "@/components/shared/states";
import { getAreas } from "@/lib/community";
import { requireOnboarded } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("services.form");
  return { title: t("editTitle") };
}

export default async function EditServicePage({ params }: PageProps<"/[locale]/services/[id]/edit">) {
  const viewer = await requireOnboarded();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const [{ data: p }, areas, t] = await Promise.all([
    supabase.from("service_providers").select("*").eq("id", id).eq("owner_id", viewer.id).maybeSingle(),
    getAreas(),
    getTranslations("services.form"),
  ]);
  if (!p) notFound();
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-5">
      <PageHeader title={t("editTitle")} description={t("editSubtitle")} />
      <ServiceForm
        areas={areas}
        serviceId={p.id}
        initial={{
          name: p.name,
          category: p.category,
          areaId: p.area_id ?? "",
          phone: p.phone,
          altPhone: p.alt_phone ?? "",
          description: p.description ?? "",
          priceNote: p.price_note ?? "",
        }}
      />
    </div>
  );
}

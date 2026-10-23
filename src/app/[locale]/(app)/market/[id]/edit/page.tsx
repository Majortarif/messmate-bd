import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { MarketForm } from "@/components/market/market-form";
import { PageHeader } from "@/components/shared/states";
import { getAreas } from "@/lib/community";
import { requireOnboarded } from "@/lib/dal";
import { publicPhotoUrl } from "@/lib/links";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("market.form");
  return { title: t("editTitle") };
}

export default async function EditMarketItemPage({ params }: PageProps<"/[locale]/market/[id]/edit">) {
  const viewer = await requireOnboarded();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const [{ data: item }, areas, t] = await Promise.all([
    supabase
      .from("market_items")
      .select("*, photos:market_item_photos(id, storage_path, sort_order)")
      .eq("id", id)
      .eq("seller_id", viewer.id)
      .neq("status", "removed")
      .maybeSingle(),
    getAreas(),
    getTranslations("market.form"),
  ]);
  if (!item) notFound();

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-5">
      <PageHeader title={t("editTitle")} />
      <MarketForm
        userId={viewer.id}
        areas={areas}
        itemId={item.id}
        photos={[...(item.photos ?? [])]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((p) => ({ id: p.id, url: publicPhotoUrl("market-photos", p.storage_path) }))}
        initial={{
          title: item.title,
          description: item.description ?? "",
          category: item.category,
          condition: item.condition,
          price: Number(item.price),
          isNegotiable: item.is_negotiable,
          areaId: item.area_id ?? "",
          contactPhone: item.contact_phone ?? "",
        }}
      />
    </div>
  );
}

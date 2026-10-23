"use client";

import { useTranslations } from "next-intl";
import { GeoMap, type MapPin } from "@/components/community/geo-map";
import { useRouter } from "@/i18n/navigation";

/** Map view of the search results; a pin's popup opens the listing. */
export function ListingsMap({ pins }: { pins: MapPin[] }) {
  const t = useTranslations("housing");
  const router = useRouter();
  return <GeoMap pins={pins} onOpen={(href) => router.push(href)} label={t("mapLabel")} className="h-[62vh] min-h-80" />;
}

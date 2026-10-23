import { CalendarDays, MapPin, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { CoverPhoto, FacilityList } from "@/components/community/bits";
import { SaveButton } from "@/components/community/interactive";
import { Link } from "@/i18n/navigation";
import { formatDate, formatNumber, formatTaka } from "@/lib/format";

export type ListingCardData = {
  id: string;
  title: string;
  listingType: "seat" | "room" | "flat" | "sublet";
  rent: number;
  area: string | undefined;
  seats: number;
  genderPref: "any" | "male" | "female";
  facilities: string[];
  cover: string | null;
  saved: boolean;
  availableFrom: string | null;
};

export function ListingCard({ listing: l }: { listing: ListingCardData }) {
  const t = useTranslations("housing");
  const tt = useTranslations("listingTypes");
  const locale = useLocale();
  return (
    <article className="card-hover group relative overflow-hidden rounded-2xl border bg-card">
      <div className="relative">
        <CoverPhoto src={l.cover} alt={l.title} className="aspect-[4/3] w-full" />
        <span className="absolute left-3 top-3 rounded-full bg-background/85 px-2.5 py-1 text-xs font-medium backdrop-blur">{tt(l.listingType)}</span>
        <SaveButton listingId={l.id} saved={l.saved} className="absolute right-3 top-3 z-10" />
      </div>
      <div className="grid gap-2 p-4">
        <p className="text-lg font-semibold">
          {formatTaka(l.rent, locale)}
          <span className="text-sm font-normal text-muted-foreground"> {t("perMonth")}</span>
        </p>
        <h3 className="line-clamp-2 font-medium leading-snug">
          <Link href={`/housing/${l.id}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {l.title}
          </Link>
        </h3>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {l.area && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden="true" />
              {l.area}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" aria-hidden="true" />
            {t("seats", { count: formatNumber(l.seats, locale) })}
          </span>
          {l.availableFrom && (
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              {t("from", { date: formatDate(l.availableFrom, locale, { day: "numeric", month: "short" }) })}
            </span>
          )}
          {l.genderPref !== "any" && <span>{t(`genderOnly.${l.genderPref}`)}</span>}
        </p>
        <FacilityList items={l.facilities.slice(0, 4)} compact />
      </div>
    </article>
  );
}

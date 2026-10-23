import {
  ArrowUpDown,
  Bath,
  BatteryCharging,
  Car,
  Cctv,
  CookingPot,
  Droplets,
  Flame,
  ImageOff,
  type LucideIcon,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sofa,
  Star,
  Sun,
  UtensilsCrossed,
  WashingMachine,
  Wifi,
  Zap,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { whatsappHref } from "@/lib/links";
import { cn } from "@/lib/utils";
import type { Facility } from "@/lib/validations/community";

export const FACILITY_ICONS: Record<Facility, LucideIcon> = {
  wifi: Wifi,
  gas: Flame,
  lift: ArrowUpDown,
  generator: Zap,
  ips: BatteryCharging,
  attached_bath: Bath,
  balcony: Sun,
  parking: Car,
  security: ShieldCheck,
  cctv: Cctv,
  water_filter: Droplets,
  furnished: Sofa,
  kitchen: CookingPot,
  meal_system: UtensilsCrossed,
  laundry: WashingMachine,
};

/** Call + WhatsApp, the two ways people actually reach each other in Dhaka. */
export function ContactButtons({ phone, name, message, className }: { phone: string; name?: string | null; message?: string; className?: string }) {
  const t = useTranslations("community.contact");
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <Button asChild className="h-11 flex-1 basis-32">
        <a href={`tel:${phone}`} aria-label={name ? t("callName", { name }) : t("call")}>
          <Phone className="size-4" aria-hidden="true" />
          {t("call")}
        </a>
      </Button>
      <Button asChild variant="outline" className="h-11 flex-1 basis-32">
        <a href={whatsappHref(phone, message)} target="_blank" rel="noreferrer">
          <MessageCircle className="size-4" aria-hidden="true" />
          WhatsApp
        </a>
      </Button>
    </div>
  );
}

/** Read-only star rating with the number, e.g. ★★★★☆ 4.2 (18). */
export function Stars({ value, count, size = "sm", className }: { value: number; count?: number; size?: "sm" | "md"; className?: string }) {
  const t = useTranslations("community.rating");
  const locale = useLocale();
  const rounded = Math.round(value * 2) / 2;
  return (
    <span className={cn("inline-flex items-center gap-1", className)} aria-label={t("label", { value: formatNumber(value, locale, 1), count: count ?? 0 })}>
      <span className="flex" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={cn(
              size === "sm" ? "size-3.5" : "size-4.5",
              i <= rounded ? "fill-marigold text-marigold" : i - 0.5 === rounded ? "fill-marigold/50 text-marigold" : "text-muted-foreground/40",
            )}
          />
        ))}
      </span>
      {count !== undefined && (
        <span className="num text-xs text-muted-foreground" aria-hidden="true">
          {count > 0 ? `${formatNumber(value, locale, 1)} (${formatNumber(count, locale)})` : t("none")}
        </span>
      )}
    </span>
  );
}

/** Facility chips with icons. */
export function FacilityList({ items, compact = false }: { items: string[]; compact?: boolean }) {
  const t = useTranslations("facilities");
  const known = items.filter((f): f is Facility => f in FACILITY_ICONS);
  if (known.length === 0) return null;
  return (
    <ul className={cn("flex flex-wrap", compact ? "gap-1.5" : "gap-2")}>
      {known.map((f) => {
        const Icon = FACILITY_ICONS[f];
        return (
          <li
            key={f}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border bg-background/40 text-muted-foreground",
              compact ? "px-2 py-0.5 text-[0.7rem]" : "px-3 py-1 text-sm",
            )}
          >
            <Icon className={compact ? "size-3" : "size-4"} aria-hidden="true" />
            {t(f)}
          </li>
        );
      })}
    </ul>
  );
}

/** Swipeable photo strip (scroll-snap), or a calm placeholder when there are none. */
export function PhotoGallery({ photos, alt }: { photos: string[]; alt: string }) {
  const t = useTranslations("community");
  if (photos.length === 0) {
    return (
      <div className="flex aspect-[16/9] items-center justify-center rounded-2xl border bg-muted text-muted-foreground">
        <ImageOff className="size-8" aria-hidden="true" />
        <span className="sr-only">{t("noPhotos")}</span>
      </div>
    );
  }
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" aria-label={t("photoCount", { count: photos.length })}>
      {photos.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- photos are compressed before upload and served from Storage
        <img
          key={src}
          src={src}
          alt={i === 0 ? alt : ""}
          loading={i === 0 ? "eager" : "lazy"}
          className={cn(
            "aspect-[4/3] shrink-0 snap-start rounded-2xl border bg-muted object-cover",
            photos.length === 1 ? "w-full" : "w-[85%] sm:w-[60%]",
          )}
        />
      ))}
    </div>
  );
}

/** Cover image for a card. */
export function CoverPhoto({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  if (!src) {
    return (
      <div className={cn("flex items-center justify-center bg-muted text-muted-foreground", className)} aria-hidden="true">
        <ImageOff className="size-6" />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- compressed Storage photo
  return <img src={src} alt={alt} loading="lazy" className={cn("bg-muted object-cover", className)} />;
}

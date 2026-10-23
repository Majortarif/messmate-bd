import { env } from "@/lib/env";

/** Public URL of a file in a public Storage bucket (avatars, listing-photos, market-photos). */
export function publicPhotoUrl(bucket: "avatars" | "listing-photos" | "market-photos", path: string) {
  return `${env.supabaseUrl}/storage/v1/object/public/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/** wa.me link for a Bangladeshi mobile number (01712345678 -> 8801712345678). */
export function whatsappHref(phone: string, text?: string) {
  const digits = phone.replace(/\D/g, "");
  const intl = digits.startsWith("880") ? digits : digits.startsWith("0") ? `88${digits}` : digits;
  return `https://wa.me/${intl}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** Google Maps directions to a point (opens the app on phones). */
export function directionsHref(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

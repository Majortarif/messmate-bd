import { DHAKA_TZ } from "@/lib/constants";

type AppLocale = "bn" | "en";

// bn-BD gives Bangla digits; en-IN keeps the lakh grouping people in Dhaka read (1,24,000).
const intlLocale = (locale: string) => (locale === "bn" ? "bn-BD" : "en-IN");

/** ৳1,240 or ৳১,২৪০ — decimals only when there are paisa. */
export function formatTaka(amount: number | string | null | undefined, locale: AppLocale | string) {
  const value = Number(amount ?? 0);
  const hasPaisa = Math.round(Math.abs(value) * 100) % 100 !== 0;
  const text = new Intl.NumberFormat(intlLocale(locale), {
    minimumFractionDigits: hasPaisa ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  return `${value < 0 ? "−" : ""}৳${text}`;
}

export function formatNumber(value: number | string | null | undefined, locale: AppLocale | string, maxFraction = 2) {
  return new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: maxFraction }).format(Number(value ?? 0));
}

export function formatDate(
  value: string | Date,
  locale: AppLocale | string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" },
) {
  return new Intl.DateTimeFormat(intlLocale(locale), { timeZone: DHAKA_TZ, ...options }).format(new Date(value));
}

export function formatTime(value: string | Date, locale: AppLocale | string) {
  return new Intl.DateTimeFormat(intlLocale(locale), { timeZone: DHAKA_TZ, hour: "numeric", minute: "2-digit" }).format(
    new Date(value),
  );
}

/** Today's date in Dhaka as YYYY-MM-DD. */
export function dhakaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: DHAKA_TZ }).format(new Date());
}

/** Hour of day (0-23) in Dhaka, for greetings. */
export function dhakaHour(date = new Date()) {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: DHAKA_TZ, hour: "2-digit", hourCycle: "h23" }).format(date));
}

export function initials(name: string | null | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "");
}

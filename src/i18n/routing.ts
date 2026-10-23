import { defineRouting } from "next-intl/routing";

/**
 * Bangla-first: Bangla URLs have no prefix (/dashboard), English lives under /en.
 * Browser language is ignored on purpose — people switch with the language toggle.
 */
export const routing = defineRouting({
  locales: ["bn", "en"],
  defaultLocale: "bn",
  localePrefix: "as-needed",
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];

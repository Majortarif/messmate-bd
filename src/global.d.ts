import type messages from "../messages/bn.json";
import type { routing } from "@/i18n/routing";

// Typed translation keys: a missing or misspelled key is a TypeScript error.
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}

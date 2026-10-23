import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";
import * as rootParams from "next/root-params";
import { routing } from "./routing";

export default getRequestConfig(async ({ locale: explicitLocale }) => {
  // Server Actions and Route Handlers can't read root params, so they pass the
  // locale explicitly (getTranslations({ locale, namespace })).
  const candidate = explicitLocale ?? (await rootParams.locale());
  if (!hasLocale(routing.locales, candidate)) {
    notFound();
  }

  return {
    locale: candidate,
    messages: (await import(`../../messages/${candidate}.json`)).default,
    timeZone: "Asia/Dhaka",
  };
});

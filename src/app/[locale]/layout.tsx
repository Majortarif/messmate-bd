import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Hind_Siliguri } from "next/font/google";
import { Providers } from "@/components/providers";
import { themeScript } from "@/components/theme";
import { routing } from "@/i18n/routing";
import { APP_NAME } from "@/lib/constants";
import { env } from "@/lib/env";
import "../globals.css";

const hind = Hind_Siliguri({
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hind",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  const locale = await getLocale();
  return {
    metadataBase: new URL(env.siteUrl),
    title: { default: t("title"), template: `%s · ${APP_NAME}` },
    description: t("description"),
    applicationName: APP_NAME,
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [
        { url: "/icons/icon.svg", type: "image/svg+xml" },
        { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      ],
      apple: "/icons/apple-touch-icon.png",
    },
    appleWebApp: { capable: true, title: "MessMate", statusBarStyle: "black-translucent" },
    openGraph: {
      type: "website",
      siteName: APP_NAME,
      title: t("title"),
      description: t("description"),
      locale: locale === "bn" ? "bn_BD" : "en_US",
      images: [{ url: "/icons/og.png", width: 1200, height: 630, alt: APP_NAME }],
    },
    alternates: { languages: { bn: "/", en: "/en" } },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0f14",
};

export default async function LocaleLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${hind.variable} dark`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

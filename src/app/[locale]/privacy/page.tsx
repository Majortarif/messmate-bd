import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { LegalPage } from "@/components/legal/legal-page";
import { legalDocs } from "@/content/legal";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as "bn" | "en";
  return { title: legalDocs.privacy[locale].title };
}

export default function PrivacyPage() {
  return <LegalPage doc="privacy" />;
}

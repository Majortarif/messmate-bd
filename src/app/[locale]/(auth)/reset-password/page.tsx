import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ResetPasswordForm } from "@/components/auth/password-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.reset");
  return { title: t("title") };
}

// Reached from the recovery email; the proxy only lets signed-in (recovery) sessions in.
export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}

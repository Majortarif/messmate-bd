import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { CardSkeleton } from "@/components/shared/states";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");
  return { title: t("title") };
}

export default function LoginPage() {
  return (
    <Suspense fallback={<CardSkeleton lines={5} />}>
      <LoginForm />
    </Suspense>
  );
}

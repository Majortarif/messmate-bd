import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { SignupForm } from "@/components/auth/signup-form";
import { CardSkeleton } from "@/components/shared/states";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.signup");
  return { title: t("title") };
}

export default function SignupPage() {
  return (
    <Suspense fallback={<CardSkeleton lines={8} />}>
      <SignupForm />
    </Suspense>
  );
}

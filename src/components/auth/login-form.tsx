"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter as useNextRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { FormError, FormField, LoadingButton, PasswordInput } from "@/components/shared/form";
import { Input } from "@/components/ui/input";
import { Link, useRouter } from "@/i18n/navigation";
import { signIn } from "@/lib/actions/auth";
import { toErrorKey, type ErrorKey } from "@/lib/errors";
import { safeNext, signInSchema, type SignInInput } from "@/lib/validations/auth";

export function LoginForm() {
  const t = useTranslations("auth");
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const router = useRouter();
  const nextRouter = useNextRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(
    searchParams.get("error") ? toErrorKey(searchParams.get("error")) : null,
  );

  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      setError(null);
      const result = await signIn(values);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // `next` already carries the locale prefix (it comes from the proxy).
      if (next) nextRouter.replace(safeNext(next));
      else router.replace("/dashboard");
      nextRouter.refresh();
    }),
  );

  const { errors } = form.formState;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("login.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("login.subtitle")}</p>
      </div>

      <GoogleButton next={next} />
      <AuthDivider />

      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        <FormField label={t("email")} error={errors.email}>
          {(field) => (
            <Input {...field} type="email" autoComplete="email" inputMode="email" placeholder={t("emailPlaceholder")} {...form.register("email")} />
          )}
        </FormField>
        <FormField
          label={
            <span className="flex w-full items-center justify-between">
              {t("password")}
              <Link href="/forgot-password" className="text-xs font-normal text-primary hover:underline">
                {t("login.forgot")}
              </Link>
            </span>
          }
          error={errors.password}
        >
          {(field) => <PasswordInput {...field} autoComplete="current-password" {...form.register("password")} />}
        </FormField>
        <FormError error={error} />
        <LoadingButton type="submit" loading={pending} className="h-11 w-full">
          {t("login.submit")}
        </LoadingButton>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {t("login.noAccount")}{" "}
        <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="font-medium text-primary hover:underline">
          {t("login.signupLink")}
        </Link>
      </p>
    </div>
  );
}

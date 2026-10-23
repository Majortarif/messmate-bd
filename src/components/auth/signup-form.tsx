"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Building, MailCheck, User, Wrench } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter as useNextRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { FormError, FormField, LoadingButton, PasswordInput, type ValidationKey } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Link, useRouter } from "@/i18n/navigation";
import { signUp } from "@/lib/actions/auth";
import type { ErrorKey } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { signUpSchema } from "@/lib/validations/auth";

const ACCOUNT_TYPES = [
  { value: "user", icon: User },
  { value: "landlord", icon: Building },
  { value: "service_provider", icon: Wrench },
] as const;

type FormInput = z.input<typeof signUpSchema>;
type FormOutput = z.output<typeof signUpSchema>;

export function SignupForm() {
  const t = useTranslations("auth");
  const tv = useTranslations("validation");
  const locale = useLocale();
  const next = useSearchParams().get("next");
  const router = useRouter();
  const nextRouter = useNextRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      accountType: "user",
      acceptTerms: false,
    },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      setError(null);
      const result = await signUp(values, locale);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.data.needsConfirmation) {
        setSentTo(values.email);
        return;
      }
      if (next) nextRouter.replace(next);
      else router.replace("/onboarding");
      nextRouter.refresh();
    }),
  );

  if (sentTo) {
    return (
      <div className="grid gap-5 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-mint-soft text-mint">
          <MailCheck className="size-7" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-2xl font-bold">{t("signup.checkEmailTitle")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("signup.checkEmailBody", { email: sentTo })}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/login">{t("signup.backToLogin")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("signup.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("signup.subtitle")}</p>
      </div>

      <GoogleButton next={next ?? `${locale === "bn" ? "" : `/${locale}`}/onboarding`} />
      <AuthDivider />

      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        <FormField label={t("signup.fullName")} error={errors.fullName}>
          {(field) => <Input {...field} autoComplete="name" placeholder={t("signup.fullNamePlaceholder")} {...form.register("fullName")} />}
        </FormField>
        <FormField label={t("email")} error={errors.email}>
          {(field) => (
            <Input {...field} type="email" autoComplete="email" inputMode="email" placeholder={t("emailPlaceholder")} {...form.register("email")} />
          )}
        </FormField>
        <FormField label={t("signup.phone")} hint={t("signup.phoneHint")} error={errors.phone} optional>
          {(field) => (
            <Input {...field} type="tel" autoComplete="tel" inputMode="tel" placeholder="01XXXXXXXXX" {...form.register("phone")} />
          )}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t("password")} hint={t("signup.passwordHint")} error={errors.password}>
            {(field) => <PasswordInput {...field} autoComplete="new-password" {...form.register("password")} />}
          </FormField>
          <FormField label={t("signup.confirmPassword")} error={errors.confirmPassword}>
            {(field) => <PasswordInput {...field} autoComplete="new-password" {...form.register("confirmPassword")} />}
          </FormField>
        </div>

        <fieldset className="grid gap-2">
          <legend className="mb-1.5 text-[0.9rem] font-medium">{t("signup.accountType")}</legend>
          <Controller
            control={form.control}
            name="accountType"
            render={({ field }) => (
              <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-2">
                {ACCOUNT_TYPES.map(({ value, icon: Icon }) => (
                  <label
                    key={value}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors hover:bg-accent/60",
                      field.value === value && "border-primary/60 bg-mint-soft",
                    )}
                  >
                    <RadioGroupItem value={value} className="mt-1" />
                    <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="grid">
                      <span className="text-sm font-medium">{t(`signup.types.${value}.title`)}</span>
                      <span className="text-xs text-muted-foreground">{t(`signup.types.${value}.body`)}</span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            )}
          />
        </fieldset>

        <Controller
          control={form.control}
          name="acceptTerms"
          render={({ field, fieldState }) => (
            <div className="grid gap-1">
              <label className="flex items-start gap-3 text-sm leading-relaxed">
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(v) => field.onChange(v === true)}
                  aria-invalid={Boolean(fieldState.error)}
                  className="mt-1"
                />
                <span>
                  {t.rich("signup.terms", {
                    privacy: (chunks) => (
                      <Link href="/privacy" target="_blank" className="font-medium text-primary underline-offset-2 hover:underline">
                        {chunks}
                      </Link>
                    ),
                    terms: (chunks) => (
                      <Link href="/terms" target="_blank" className="font-medium text-primary underline-offset-2 hover:underline">
                        {chunks}
                      </Link>
                    ),
                  })}
                </span>
              </label>
              {fieldState.error?.message && (
                <p role="alert" className="pl-7 text-[0.8rem] text-destructive">
                  {tv(fieldState.error.message as ValidationKey)}
                </p>
              )}
            </div>
          )}
        />

        <FormError error={error} />
        <LoadingButton type="submit" loading={pending} className="h-11 w-full">
          {t("signup.submit")}
        </LoadingButton>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {t("signup.haveAccount")}{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t("signup.loginLink")}
        </Link>
      </p>
    </div>
  );
}

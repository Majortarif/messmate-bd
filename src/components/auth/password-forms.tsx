"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormError, FormField, LoadingButton, PasswordInput } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useRouter } from "@/i18n/navigation";
import { requestPasswordReset, updatePassword } from "@/lib/actions/auth";
import type { ErrorKey } from "@/lib/errors";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  type ForgotPasswordInput,
  type ResetPasswordInput,
} from "@/lib/validations/auth";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(null);
  const [sent, setSent] = useState(false);
  const form = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      setError(null);
      const result = await requestPasswordReset(values, locale);
      if (result.ok) setSent(true);
      else setError(result.error);
    }),
  );

  if (sent) {
    return (
      <div className="grid gap-5 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-mint-soft text-mint">
          <MailCheck className="size-7" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-2xl font-bold">{t("forgot.sentTitle")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("forgot.sentBody")}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/login">{t("forgot.backToLogin")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("forgot.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("forgot.subtitle")}</p>
      </div>
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        <FormField label={t("email")} error={form.formState.errors.email}>
          {(field) => (
            <Input {...field} type="email" autoComplete="email" inputMode="email" placeholder={t("emailPlaceholder")} {...form.register("email")} />
          )}
        </FormField>
        <FormError error={error} />
        <LoadingButton type="submit" loading={pending} className="h-11 w-full">
          {t("forgot.submit")}
        </LoadingButton>
      </form>
      <p className="text-center text-sm">
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t("forgot.backToLogin")}
        </Link>
      </p>
    </div>
  );
}

export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(null);
  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      setError(null);
      const result = await updatePassword(values);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(t("reset.success"));
      router.replace("/dashboard");
    }),
  );

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("reset.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("reset.subtitle")}</p>
      </div>
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        <FormField label={t("reset.password")} hint={t("signup.passwordHint")} error={errors.password}>
          {(field) => <PasswordInput {...field} autoComplete="new-password" {...form.register("password")} />}
        </FormField>
        <FormField label={t("signup.confirmPassword")} error={errors.confirmPassword}>
          {(field) => <PasswordInput {...field} autoComplete="new-password" {...form.register("confirmPassword")} />}
        </FormField>
        <FormError error={error} />
        <LoadingButton type="submit" loading={pending} className="h-11 w-full">
          {t("reset.submit")}
        </LoadingButton>
      </form>
    </div>
  );
}

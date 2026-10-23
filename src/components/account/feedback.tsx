"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Bug, CheckCircle2, Flag, Lightbulb, Mail, MessageSquareHeart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { FormError, FormField, LoadingButton } from "@/components/shared/form";
import { ResponsiveDialog } from "@/components/shared/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { sendFeedback } from "@/lib/actions/account";
import type { ErrorKey } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { FEEDBACK_TYPES, type FeedbackInput, feedbackSchema } from "@/lib/validations/account";

const ICONS = { feedback: Lightbulb, bug: Bug, contact: Mail, report: Flag };

/** Feedback / bug / contact / report form. Signed-in users are linked automatically. */
export function FeedbackForm({ signedIn, onDone }: { signedIn: boolean; onDone?: () => void }) {
  const t = useTranslations("feedback.form");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(null);
  const [sent, setSent] = useState(false);
  const form = useForm<FeedbackInput, unknown, z.output<typeof feedbackSchema>>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: { type: "feedback", subject: "", message: "", contactEmail: "" },
  });
  const { errors } = form.formState;

  if (sent) {
    return (
      <div className="grid justify-items-center gap-3 py-6 text-center">
        <CheckCircle2 className="size-10 text-mint" aria-hidden="true" />
        <p className="text-lg font-semibold">{t("thanks")}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{t("thanksBody")}</p>
        <Button
          variant="outline"
          onClick={() => {
            form.reset();
            setSent(false);
            onDone?.();
          }}
        >
          {onDone ? t("close") : t("another")}
        </Button>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={form.handleSubmit(() =>
        startTransition(async () => {
          setError(null);
          const result = await sendFeedback({ ...form.getValues(), pageUrl: window.location.pathname.slice(0, 300) });
          if (!result.ok) return setError(result.error);
          setSent(true);
        }),
      )}
    >
      <Controller
        control={form.control}
        name="type"
        render={({ field }) => (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label={t("type")}>
            {FEEDBACK_TYPES.map((k) => {
              const Icon = ICONS[k];
              return (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={field.value === k}
                  onClick={() => field.onChange(k)}
                  className={cn(
                    "flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-2 text-sm transition-colors",
                    field.value === k ? "border-primary bg-mint-soft font-medium" : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  {t(`types.${k}`)}
                </button>
              );
            })}
          </div>
        )}
      />
      <FormField label={t("subject")} error={errors.subject} optional>
        {(field) => <Input {...field} maxLength={120} {...form.register("subject")} />}
      </FormField>
      <FormField label={t("message")} hint={t("messageHint")} error={errors.message}>
        {(field) => <Textarea {...field} rows={5} maxLength={2000} placeholder={t("messagePlaceholder")} {...form.register("message")} />}
      </FormField>
      {!signedIn && (
        <FormField label={t("email")} hint={t("emailHint")} error={errors.contactEmail} optional>
          {(field) => <Input {...field} type="email" inputMode="email" autoComplete="email" {...form.register("contactEmail")} />}
        </FormField>
      )}
      <FormError error={error} />
      <LoadingButton type="submit" loading={pending} className="h-11">
        {t("send")}
      </LoadingButton>
    </form>
  );
}

/** Floating "Feedback" button in the app shell. */
export function FeedbackFab() {
  const t = useTranslations("feedback");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("fab")}
        title={t("fab")}
        className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] right-4 z-30 flex size-12 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-lg transition-colors hover:text-foreground lg:bottom-6 lg:right-6 print:hidden"
      >
        <MessageSquareHeart className="size-5" aria-hidden="true" />
      </button>
      <ResponsiveDialog open={open} onOpenChange={setOpen} title={t("dialogTitle")} description={t("dialogBody")}>
        <FeedbackForm signedIn onDone={() => setOpen(false)} />
      </ResponsiveDialog>
    </>
  );
}

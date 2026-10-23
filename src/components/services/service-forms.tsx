"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { type AreaOption, AreaSelect, StarInput } from "@/components/community/interactive";
import { FormError, FormField, LoadingButton } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { deleteReview, saveReview, saveService } from "@/lib/actions/services";
import type { ErrorKey } from "@/lib/errors";
import { SERVICE_CATEGORIES, type ServiceInput, serviceSchema } from "@/lib/validations/community";

/** Suggest a provider (or edit your suggestion); a platform admin reviews it first. */
export function ServiceForm({ areas, serviceId, initial }: { areas: AreaOption[]; serviceId?: string; initial: ServiceInput }) {
  const t = useTranslations("services.form");
  const tc = useTranslations("serviceCategories");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(null);
  const form = useForm<ServiceInput, unknown, z.output<typeof serviceSchema>>({ resolver: zodResolver(serviceSchema), defaultValues: initial });
  const { errors } = form.formState;

  return (
    <form
      noValidate
      className="grid gap-5 rounded-2xl border bg-card p-4 sm:p-5"
      onSubmit={form.handleSubmit(() =>
        startTransition(async () => {
          setError(null);
          const result = await saveService(form.getValues(), serviceId);
          if (!result.ok) return setError(result.error);
          toast.success(t("sent"), { description: t("reviewNote") });
          router.push(`/services/${result.data.id}`);
        }),
      )}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={t("name")} error={errors.name}>
          {(field) => <Input {...field} maxLength={100} placeholder={t("namePlaceholder")} {...form.register("name")} />}
        </FormField>
        <FormField label={t("category")} error={errors.category}>
          {(field) => (
            <Controller
              control={form.control}
              name="category"
              render={({ field: f }) => (
                <Select value={f.value} onValueChange={f.onChange}>
                  <SelectTrigger id={field.id} className="h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {tc(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </FormField>
        <FormField label={t("phone")} error={errors.phone}>
          {(field) => <Input {...field} type="tel" inputMode="tel" placeholder="01XXXXXXXXX" {...form.register("phone")} />}
        </FormField>
        <FormField label={t("altPhone")} error={errors.altPhone} optional>
          {(field) => <Input {...field} type="tel" inputMode="tel" placeholder="01XXXXXXXXX" {...form.register("altPhone")} />}
        </FormField>
        <FormField label={t("area")} error={errors.areaId} optional>
          {(field) => (
            <Controller
              control={form.control}
              name="areaId"
              render={({ field: f }) => (
                <AreaSelect
                  id={field.id}
                  areas={areas}
                  value={f.value === undefined || f.value === null ? "" : String(f.value)}
                  onChange={f.onChange}
                  anyLabel={t("allDhaka")}
                />
              )}
            />
          )}
        </FormField>
        <FormField label={t("price")} hint={t("priceHint")} error={errors.priceNote} optional>
          {(field) => <Input {...field} maxLength={120} placeholder={t("pricePlaceholder")} {...form.register("priceNote")} />}
        </FormField>
      </div>
      <FormField label={t("description")} error={errors.description} optional>
        {(field) => <Textarea {...field} rows={4} maxLength={1000} placeholder={t("descriptionPlaceholder")} {...form.register("description")} />}
      </FormField>
      <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">{t("reviewNote")}</p>
      <FormError error={error} />
      <LoadingButton type="submit" loading={pending} className="h-12 sm:w-fit sm:px-8">
        {serviceId ? t("save") : t("submit")}
      </LoadingButton>
    </form>
  );
}

/** Your rating + review for one provider. */
export function ReviewForm({ providerId, initial }: { providerId: string; initial: { rating: number; comment: string } | null }) {
  const t = useTranslations("services.review");
  const te = useTranslations("errors");
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(null);

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (rating < 1) return;
        startTransition(async () => {
          setError(null);
          const result = await saveReview({ providerId, rating, comment });
          if (!result.ok) return setError(result.error);
          toast.success(initial ? t("updated") : t("thanks"));
        });
      }}
    >
      <StarInput value={rating} onChange={setRating} label={t("rating")} />
      <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={500} placeholder={t("placeholder")} aria-label={t("comment")} />
      <FormError error={error} />
      <div className="flex flex-wrap gap-2">
        <LoadingButton type="submit" loading={pending} disabled={rating < 1}>
          {initial ? t("update") : t("submit")}
        </LoadingButton>
        {initial && (
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await deleteReview(providerId);
                if (!result.ok) return void toast.error(te(result.error));
                setRating(0);
                setComment("");
                toast.success(t("removed"));
              })
            }
          >
            {t("remove")}
          </Button>
        )}
      </div>
    </form>
  );
}

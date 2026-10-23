"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Calculator, Tags } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { FormError, FormField, LoadingButton } from "@/components/shared/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { createMess } from "@/lib/actions/onboarding";
import type { ErrorKey } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { createMessSchema } from "@/lib/validations/mess";

export type AreaOption = { id: number; name_bn: string; name_en: string };

type FormInput = z.input<typeof createMessSchema>;
type FormOutput = z.output<typeof createMessSchema>;

const MODES = [
  { value: "auto", icon: Calculator },
  { value: "fixed", icon: Tags },
] as const;

export function CreateMessForm({ areas }: { areas: AreaOption[] }) {
  const t = useTranslations("onboarding.create");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(null);

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(createMessSchema),
    defaultValues: { name: "", areaId: 0, address: "", buildingName: "", description: "", mealRateMode: "auto", genderPolicy: "any" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      setError(null);
      const result = await createMess(values);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(t("success"));
      router.replace("/manage/members?welcome=1");
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <FormField label={t("name")} error={errors.name}>
        {(field) => <Input {...field} placeholder={t("namePlaceholder")} {...form.register("name")} />}
      </FormField>

      <FormField label={t("area")} error={errors.areaId}>
        {(field) => (
          <Controller
            control={form.control}
            name="areaId"
            render={({ field: f }) => (
              <Select value={f.value ? String(f.value) : ""} onValueChange={(v) => f.onChange(Number(v))}>
                <SelectTrigger id={field.id} aria-invalid={field["aria-invalid"]} className="w-full">
                  <SelectValue placeholder={t("areaPlaceholder")} />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {areas.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {locale === "bn" ? a.name_bn : a.name_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        )}
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label={t("address")} error={errors.address} optional>
          {(field) => <Input {...field} placeholder={t("addressPlaceholder")} {...form.register("address")} />}
        </FormField>
        <FormField label={t("building")} error={errors.buildingName} optional>
          {(field) => <Input {...field} placeholder={t("buildingPlaceholder")} {...form.register("buildingName")} />}
        </FormField>
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-1.5 text-[0.9rem] font-medium">{t("mealMode")}</legend>
        <Controller
          control={form.control}
          name="mealRateMode"
          render={({ field }) => (
            <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-2 sm:grid-cols-2">
              {MODES.map(({ value, icon: Icon }) => (
                <label
                  key={value}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors hover:bg-accent/60",
                    field.value === value && "border-primary/60 bg-mint-soft",
                  )}
                >
                  <RadioGroupItem value={value} className="mt-1" />
                  <span className="grid gap-1">
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <Icon className="size-4 text-primary" aria-hidden="true" />
                      {t(`modes.${value}.title`)}
                    </span>
                    <span className="text-xs leading-relaxed text-muted-foreground">{t(`modes.${value}.body`)}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          )}
        />
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-1.5 text-[0.9rem] font-medium">{t("gender")}</legend>
        <Controller
          control={form.control}
          name="genderPolicy"
          render={({ field }) => (
            <RadioGroup value={field.value} onValueChange={field.onChange} className="flex flex-wrap gap-2">
              {(["any", "male", "female"] as const).map((value) => (
                <label
                  key={value}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors hover:bg-accent/60",
                    field.value === value && "border-primary/60 bg-mint-soft",
                  )}
                >
                  <RadioGroupItem value={value} />
                  {t(`genders.${value}`)}
                </label>
              ))}
            </RadioGroup>
          )}
        />
      </fieldset>

      <FormField label={t("description")} error={errors.description} optional>
        {(field) => <Textarea {...field} rows={3} placeholder={t("descriptionPlaceholder")} {...form.register("description")} />}
      </FormField>

      <FormError error={error} />
      <LoadingButton type="submit" loading={pending} className="h-11 w-full sm:w-auto sm:justify-self-start">
        {t("submit")}
      </LoadingButton>
    </form>
  );
}

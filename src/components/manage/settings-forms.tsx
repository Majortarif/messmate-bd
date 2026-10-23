"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Info } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition, type ReactNode } from "react";
import { Controller, useForm, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { FormError, FormField, LoadingButton } from "@/components/shared/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { updateMealSettings, updateMessInfo, updatePaymentNumbers } from "@/lib/actions/manage";
import type { ErrorKey } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { mealSettingsSchema, messInfoSchema, paymentSchema } from "@/lib/validations/manage";

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-5 sm:p-6">
      <h2 className="font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function SwitchRow<T extends FieldValues>({
  control,
  name,
  label,
  hint,
}: {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  hint?: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <label className="flex items-start justify-between gap-4 rounded-xl border px-3 py-3">
          <span className="grid">
            <span className="text-sm font-medium">{label}</span>
            {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
          </span>
          <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} />
        </label>
      )}
    />
  );
}

function useSave() {
  const t = useTranslations("manage.settings");
  const [error, setError] = useState<ErrorKey | null>(null);
  const [pending, startTransition] = useTransition();
  const save = (fn: () => Promise<{ ok: true } | { ok: false; error: ErrorKey }>) =>
    startTransition(async () => {
      setError(null);
      const result = await fn();
      if (!result.ok) setError(result.error);
      else toast.success(t("saved"));
    });
  return { error, pending, save };
}

// ------------------------------------------------------------- mess info ---
type InfoIn = z.input<typeof messInfoSchema>;
type InfoOut = z.output<typeof messInfoSchema>;

export function MessInfoForm({ messId, initial, areas }: { messId: string; initial: InfoIn; areas: { id: number; name_bn: string; name_en: string }[] }) {
  const t = useTranslations("manage.settings.info");
  const to = useTranslations("onboarding.create");
  const locale = useLocale();
  const { error, pending, save } = useSave();
  const form = useForm<InfoIn, unknown, InfoOut>({ resolver: zodResolver(messInfoSchema), defaultValues: initial });
  const { errors } = form.formState;

  return (
    <Section title={t("title")} description={t("body")}>
      <form noValidate className="grid gap-4" onSubmit={form.handleSubmit((v) => save(() => updateMessInfo(messId, v)))}>
        <FormField label={to("name")} error={errors.name}>
          {(field) => <Input {...field} {...form.register("name")} />}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={to("area")} error={errors.areaId}>
            {(field) => (
              <Controller
                control={form.control}
                name="areaId"
                render={({ field: f }) => (
                  <Select value={f.value ? String(f.value) : ""} onValueChange={(v) => f.onChange(Number(v))}>
                    <SelectTrigger id={field.id} className="w-full">
                      <SelectValue placeholder={to("areaPlaceholder")} />
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
          <FormField label={to("building")} error={errors.buildingName} optional>
            {(field) => <Input {...field} {...form.register("buildingName")} />}
          </FormField>
        </div>
        <FormField label={to("address")} error={errors.address} optional>
          {(field) => <Input {...field} {...form.register("address")} />}
        </FormField>
        <FormField label={to("description")} error={errors.description} optional>
          {(field) => <Textarea {...field} rows={3} {...form.register("description")} />}
        </FormField>
        <Controller
          control={form.control}
          name="genderPolicy"
          render={({ field }) => (
            <RadioGroup value={field.value} onValueChange={field.onChange} className="flex flex-wrap gap-2" aria-label={to("gender")}>
              {(["any", "male", "female"] as const).map((v) => (
                <label key={v} className={cn("flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm", field.value === v && "border-primary/60 bg-mint-soft")}>
                  <RadioGroupItem value={v} />
                  {to(`genders.${v}`)}
                </label>
              ))}
            </RadioGroup>
          )}
        />
        <FormError error={error} />
        <LoadingButton type="submit" loading={pending} className="w-fit">
          {t("save")}
        </LoadingButton>
      </form>
    </Section>
  );
}

// ---------------------------------------------------------- meal settings ---
type MealIn = z.input<typeof mealSettingsSchema>;
type MealOut = z.output<typeof mealSettingsSchema>;
const SLOTS = ["breakfast", "lunch", "dinner"] as const;

export function MealSettingsForm({ messId, initial, modeLocked }: { messId: string; initial: MealIn; modeLocked: boolean }) {
  const t = useTranslations("manage.settings.meals");
  const ts = useTranslations("slots");
  const to = useTranslations("onboarding.create.modes");
  const { error, pending, save } = useSave();
  const form = useForm<MealIn, unknown, MealOut>({ resolver: zodResolver(mealSettingsSchema), defaultValues: initial });
  const { errors } = form.formState;

  return (
    <Section title={t("title")} description={t("body")}>
      <form noValidate className="grid gap-5" onSubmit={form.handleSubmit((v) => save(() => updateMealSettings(messId, v)))}>
        <Controller
          control={form.control}
          name="mealRateMode"
          render={({ field }) => (
            <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-2 sm:grid-cols-2" aria-label={t("mode")}>
              {(["auto", "fixed"] as const).map((v) => (
                <label
                  key={v}
                  className={cn(
                    "flex gap-3 rounded-xl border p-3",
                    modeLocked ? "cursor-not-allowed opacity-70" : "cursor-pointer",
                    field.value === v && "border-primary/60 bg-mint-soft",
                  )}
                >
                  <RadioGroupItem value={v} disabled={modeLocked} className="mt-1" />
                  <span className="grid gap-0.5">
                    <span className="text-sm font-semibold">{to(`${v}.title`)}</span>
                    <span className="text-xs text-muted-foreground">{to(`${v}.body`)}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          )}
        />
        {modeLocked && (
          <p className="flex gap-2 rounded-xl bg-muted px-3 py-2.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {t("modeLocked")}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-2 font-medium">{t("slot")}</th>
                <th className="pb-2 pr-2 font-medium">{t("price")}</th>
                <th className="pb-2 pr-2 font-medium">{t("weight")}</th>
                <th className="pb-2 pr-2 font-medium">{t("cutoff")}</th>
                <th className="pb-2 font-medium">{t("prevDay")}</th>
              </tr>
            </thead>
            <tbody>
              {SLOTS.map((slot) => (
                <tr key={slot}>
                  <td className="py-1.5 pr-2 font-medium">{ts(slot)}</td>
                  <td className="py-1.5 pr-2">
                    <Input type="number" inputMode="decimal" min={0} className="num h-9 w-24" aria-label={`${ts(slot)} ${t("price")}`} {...form.register(`${slot}Price`)} />
                  </td>
                  <td className="py-1.5 pr-2">
                    <Input type="number" inputMode="decimal" step="0.5" min={0} max={2} className="num h-9 w-20" aria-label={`${ts(slot)} ${t("weight")}`} {...form.register(`${slot}Weight`)} />
                  </td>
                  <td className="py-1.5 pr-2">
                    <Input type="time" className="h-9 w-32" aria-label={`${ts(slot)} ${t("cutoff")}`} {...form.register(`${slot}Cutoff`)} />
                  </td>
                  <td className="py-1.5">
                    <Controller
                      control={form.control}
                      name={`${slot}PrevDay`}
                      render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} aria-label={`${ts(slot)} ${t("prevDay")}`} />}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">{t("weightHint")}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <SwitchRow control={form.control} name="guestMealAllowed" label={t("guests")} hint={t("guestsHint")} />
          <FormField label={t("maxGuests")} error={errors.maxGuests}>
            {(field) => <Input {...field} type="number" min={0} max={10} {...form.register("maxGuests")} />}
          </FormField>
          <FormField label={t("creditLimit")} hint={t("creditHint")} error={errors.creditLimit}>
            {(field) => <Input {...field} type="number" min={0} {...form.register("creditLimit")} />}
          </FormField>
          <FormField label={t("lowBalance")} hint={t("lowBalanceHint")} error={errors.lowBalanceThreshold}>
            {(field) => <Input {...field} type="number" min={0} {...form.register("lowBalanceThreshold")} />}
          </FormField>
          <SwitchRow control={form.control} name="splitSharedExpenses" label={t("splitShared")} hint={t("splitSharedHint")} />
          <SwitchRow control={form.control} name="autoCloseEnabled" label={t("autoClose")} hint={t("autoCloseHint")} />
          <FormField label={t("autoCloseDay")} error={errors.autoCloseDay}>
            {(field) => <Input {...field} type="number" min={1} max={10} {...form.register("autoCloseDay")} />}
          </FormField>
        </div>
        <FormError error={error} />
        <LoadingButton type="submit" loading={pending} className="w-fit">
          {t("save")}
        </LoadingButton>
      </form>
    </Section>
  );
}

// -------------------------------------------------------- payment numbers ---
type PayIn = z.input<typeof paymentSchema>;
// The action re-parses the raw input (its transforms turn "" into null), so submit the raw values.
type PayOut = z.output<typeof paymentSchema>;

export function PaymentForm({ messId, initial }: { messId: string; initial: PayIn }) {
  const t = useTranslations("manage.settings.payment");
  const { error, pending, save } = useSave();
  const form = useForm<PayIn, unknown, PayOut>({ resolver: zodResolver(paymentSchema), defaultValues: initial });
  const { errors } = form.formState;

  return (
    <Section title={t("title")} description={t("body")}>
      <form noValidate className="grid gap-4" onSubmit={form.handleSubmit(() => save(() => updatePaymentNumbers(messId, form.getValues())))}>
        <div className="grid gap-4 sm:grid-cols-3">
          {(["bkash", "nagad", "rocket"] as const).map((k) => (
            <FormField key={k} label={t(k)} error={errors[k]} optional>
              {(field) => <Input {...field} type="tel" inputMode="tel" placeholder={k === "rocket" ? "01XXXXXXXXXX" : "01XXXXXXXXX"} {...form.register(k)} />}
            </FormField>
          ))}
        </div>
        <FormField label={t("note")} hint={t("noteHint")} error={errors.note} optional>
          {(field) => <Input {...field} maxLength={300} placeholder={t("notePlaceholder")} {...form.register("note")} />}
        </FormField>
        <FormError error={error} />
        <LoadingButton type="submit" loading={pending} className="w-fit">
          {t("save")}
        </LoadingButton>
      </form>
    </Section>
  );
}

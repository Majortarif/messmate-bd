"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import type { AreaOption } from "@/components/community/interactive";
import { FormError, FormField, LoadingButton } from "@/components/shared/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveRoommateProfile } from "@/lib/actions/housing";
import type { ErrorKey } from "@/lib/errors";
import { cn } from "@/lib/utils";
import {
  FOOD_PREFS,
  GENDERS,
  OCCUPATIONS,
  type RoommateInput,
  roommateSchema,
  SLEEP_SCHEDULES,
} from "@/lib/validations/community";

type Values = z.output<typeof roommateSchema>;

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  render,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  label: string;
  render: (v: T) => string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          onClick={() => onChange(o)}
          className={cn(
            "h-10 rounded-xl border px-3.5 text-sm transition-colors",
            value === o ? "border-primary/50 bg-mint-soft font-medium" : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          {render(o)}
        </button>
      ))}
    </div>
  );
}

function SwitchRow({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border px-3 py-2.5">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

/** The user's own roommate profile; matching only runs once this exists and is active. */
export function RoommateForm({ areas, initial, onSaved }: { areas: AreaOption[]; initial: RoommateInput; onSaved?: () => void }) {
  const t = useTranslations("housing.roommates.form");
  const tg = useTranslations("housing.roommates");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(null);
  const form = useForm<RoommateInput, unknown, Values>({ resolver: zodResolver(roommateSchema), defaultValues: initial });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      setError(null);
      const result = await saveRoommateProfile(form.getValues());
      if (!result.ok) return setError(result.error);
      toast.success(t("saved"));
      onSaved?.();
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <Controller
        control={form.control}
        name="isActive"
        render={({ field }) => <SwitchRow checked={field.value} onChange={field.onChange} label={t("active")} hint={t("activeHint")} />}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <p className="text-[0.9rem] font-medium">{t("gender")}</p>
          <Controller
            control={form.control}
            name="gender"
            render={({ field }) => (
              <Segmented value={field.value} options={GENDERS} onChange={field.onChange} label={t("gender")} render={(g) => tg(`gender.${g}`)} />
            )}
          />
          <p className="text-[0.8rem] text-muted-foreground">{t("genderHint")}</p>
        </div>
        <FormField label={t("occupation")} error={errors.occupation}>
          {(field) => (
            <Controller
              control={form.control}
              name="occupation"
              render={({ field: f }) => (
                <Select value={f.value} onValueChange={f.onChange}>
                  <SelectTrigger id={field.id} className="h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OCCUPATIONS.map((o) => (
                      <SelectItem key={o} value={o}>
                        {tg(`occupation.${o}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <FormField label={t("budgetMin")} error={errors.budgetMin}>
          {(field) => <Input {...field} type="number" inputMode="numeric" min={0} {...form.register("budgetMin")} />}
        </FormField>
        <FormField label={t("budgetMax")} error={errors.budgetMax}>
          {(field) => <Input {...field} type="number" inputMode="numeric" min={0} {...form.register("budgetMax")} />}
        </FormField>
        <FormField label={t("moveIn")} error={errors.moveInDate} optional className="col-span-2 sm:col-span-1">
          {(field) => <Input {...field} type="date" {...form.register("moveInDate")} />}
        </FormField>
      </div>

      <div className="grid gap-1.5">
        <p className="text-[0.9rem] font-medium">{t("areas")}</p>
        <Controller
          control={form.control}
          name="areaIds"
          render={({ field }) => (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("areas")}>
              {areas.map((a) => {
                const on = field.value.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => field.onChange(on ? field.value.filter((x) => x !== a.id) : [...field.value, a.id].slice(0, 10))}
                    className={cn(
                      "h-9 rounded-full border px-3 text-sm transition-colors",
                      on ? "border-primary/50 bg-mint-soft font-medium" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {locale === "en" ? a.name_en : a.name_bn}
                  </button>
                );
              })}
            </div>
          )}
        />
        <p className="text-[0.8rem] text-muted-foreground">{t("areasHint")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <p className="text-[0.9rem] font-medium">{t("sleep")}</p>
          <Controller
            control={form.control}
            name="sleepSchedule"
            render={({ field }) => (
              <Segmented value={field.value} options={SLEEP_SCHEDULES} onChange={field.onChange} label={t("sleep")} render={(s) => tg(`sleep.${s}`)} />
            )}
          />
        </div>
        <div className="grid gap-1.5">
          <p className="text-[0.9rem] font-medium">{t("cleanliness")}</p>
          <Controller
            control={form.control}
            name="cleanliness"
            render={({ field }) => (
              <Segmented
                value={String(field.value) as "1" | "2" | "3" | "4" | "5"}
                options={["1", "2", "3", "4", "5"] as const}
                onChange={(v) => field.onChange(Number(v))}
                label={t("cleanliness")}
                render={(v) => tg(`clean.${v}`)}
              />
            )}
          />
        </div>
        <FormField label={t("food")} error={errors.foodPref}>
          {(field) => (
            <Controller
              control={form.control}
              name="foodPref"
              render={({ field: f }) => (
                <Select value={f.value} onValueChange={f.onChange}>
                  <SelectTrigger id={field.id} className="h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FOOD_PREFS.map((o) => (
                      <SelectItem key={o} value={o}>
                        {tg(`food.${o}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </FormField>
        <div className="grid content-end gap-2">
          <Controller
            control={form.control}
            name="smoking"
            render={({ field }) => <SwitchRow checked={field.value} onChange={field.onChange} label={t("smoking")} />}
          />
          <Controller
            control={form.control}
            name="guestsOk"
            render={({ field }) => <SwitchRow checked={field.value} onChange={field.onChange} label={t("guests")} />}
          />
        </div>
      </div>

      <FormField label={t("about")} hint={t("aboutHint")} error={errors.about} optional>
        {(field) => <Textarea {...field} rows={3} maxLength={500} placeholder={t("aboutPlaceholder")} {...form.register("about")} />}
      </FormField>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label={t("phone")} error={errors.contactPhone} optional>
          {(field) => <Input {...field} type="tel" inputMode="tel" placeholder="01XXXXXXXXX" {...form.register("contactPhone")} />}
        </FormField>
        <Controller
          control={form.control}
          name="showPhone"
          render={({ field }) => (
            <div className="grid content-end">
              <SwitchRow checked={field.value} onChange={field.onChange} label={t("showPhone")} hint={t("showPhoneHint")} />
            </div>
          )}
        />
      </div>

      <FormError error={error} />
      <LoadingButton type="submit" loading={pending} className="h-11 sm:w-fit sm:px-8">
        {t("save")}
      </LoadingButton>
    </form>
  );
}

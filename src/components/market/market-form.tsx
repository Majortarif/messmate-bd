"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { type AreaOption, AreaSelect, type ExistingPhoto, PhotoPicker } from "@/components/community/interactive";
import { FormError, FormField, LoadingButton } from "@/components/shared/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { addMarketPhotos, removeMarketPhotos, saveMarketItem } from "@/lib/actions/market";
import { type ErrorKey, toErrorKey } from "@/lib/errors";
import { uploadImage } from "@/lib/image";
import { cn } from "@/lib/utils";
import { ITEM_CONDITIONS, MARKET_CATEGORIES, type MarketItemInput, marketItemSchema } from "@/lib/validations/community";

export function MarketForm({
  userId,
  areas,
  itemId,
  initial,
  photos,
}: {
  userId: string;
  areas: AreaOption[];
  itemId?: string;
  initial: MarketItemInput;
  photos?: ExistingPhoto[];
}) {
  const t = useTranslations("market.form");
  const tc = useTranslations("marketCategories");
  const ti = useTranslations("itemConditions");
  const te = useTranslations("errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const form = useForm<MarketItemInput, unknown, z.output<typeof marketItemSchema>>({
    resolver: zodResolver(marketItemSchema),
    defaultValues: initial,
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      setError(null);
      const result = await saveMarketItem(form.getValues(), itemId);
      if (!result.ok) return setError(result.error);
      const id = result.data.id;
      if (removed.length) await removeMarketPhotos(id, removed);
      if (files.length) {
        try {
          const paths = await Promise.all(files.map((file) => uploadImage("market-photos", `${userId}/${id}`, file)));
          const added = await addMarketPhotos(id, paths);
          if (!added.ok) toast.error(te(added.error));
        } catch (e) {
          toast.error(te(toErrorKey(e)));
        }
      }
      toast.success(itemId ? t("updated") : t("posted"));
      router.push(`/market/${id}`);
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5 rounded-2xl border bg-card p-4 sm:p-5">
      <PhotoPicker
        existing={(photos ?? []).filter((p) => !removed.includes(p.id))}
        onRemoveExisting={(id) => setRemoved((r) => [...r, id])}
        files={files}
        onFilesChange={setFiles}
        max={6}
      />
      <FormField label={t("title")} error={errors.title}>
        {(field) => <Input {...field} maxLength={100} placeholder={t("titlePlaceholder")} {...form.register("title")} />}
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
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
                    {MARKET_CATEGORIES.map((c) => (
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
        <div className="grid gap-1.5">
          <p className="text-[0.9rem] font-medium">{t("condition")}</p>
          <Controller
            control={form.control}
            name="condition"
            render={({ field }) => (
              <div className="grid grid-cols-4 gap-1" role="radiogroup" aria-label={t("condition")}>
                {ITEM_CONDITIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={field.value === c}
                    onClick={() => field.onChange(c)}
                    className={cn(
                      "h-11 rounded-xl border px-1 text-xs transition-colors sm:text-sm",
                      field.value === c ? "border-primary/50 bg-mint-soft font-medium" : "text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {ti(c)}
                  </button>
                ))}
              </div>
            )}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={t("price")} error={errors.price}>
          {(field) => <Input {...field} type="number" inputMode="numeric" min={0} {...form.register("price")} />}
        </FormField>
        <Controller
          control={form.control}
          name="isNegotiable"
          render={({ field }) => (
            <label className="flex cursor-pointer items-center justify-between gap-3 self-end rounded-xl border px-3 py-2.5">
              <span className="text-sm font-medium">{t("negotiable")}</span>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </label>
          )}
        />
      </div>
      <FormField label={t("description")} error={errors.description} optional>
        {(field) => <Textarea {...field} rows={4} maxLength={1500} placeholder={t("descriptionPlaceholder")} {...form.register("description")} />}
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
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
                  anyLabel={t("noArea")}
                />
              )}
            />
          )}
        </FormField>
        <FormField label={t("phone")} hint={t("phoneHint")} error={errors.contactPhone}>
          {(field) => <Input {...field} type="tel" inputMode="tel" placeholder="01XXXXXXXXX" {...form.register("contactPhone")} />}
        </FormField>
      </div>
      <FormError error={error} />
      <LoadingButton type="submit" loading={pending} className="h-12 sm:w-fit sm:px-8">
        {itemId ? t("save") : t("post")}
      </LoadingButton>
    </form>
  );
}

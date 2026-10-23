"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { FACILITY_ICONS } from "@/components/community/bits";
import { GeoMap } from "@/components/community/geo-map";
import { type AreaOption, AreaSelect, type ExistingPhoto, PhotoPicker } from "@/components/community/interactive";
import { FormError, FormField, LoadingButton } from "@/components/shared/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { addListingPhotos, removeListingPhotos, saveListing } from "@/lib/actions/housing";
import { type ErrorKey, toErrorKey } from "@/lib/errors";
import { uploadImage } from "@/lib/image";
import { cn } from "@/lib/utils";
import {
  FACILITIES,
  GENDER_PREFS,
  LISTING_TYPES,
  type ListingInput,
  listingSchema,
  type ListingValues,
  TENANT_PREFS,
} from "@/lib/validations/community";

type AreaWithPoint = AreaOption & { lat: number | null; lng: number | null };

export function ListingForm({
  userId,
  areas,
  listingId,
  initial,
  photos,
}: {
  userId: string;
  areas: AreaWithPoint[];
  listingId?: string;
  initial?: ListingInput;
  photos?: ExistingPhoto[];
}) {
  const t = useTranslations("housing.form");
  const tt = useTranslations("listingTypes");
  const tf = useTranslations("facilities");
  const th = useTranslations("housing");
  const te = useTranslations("errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);

  const form = useForm<ListingInput, unknown, ListingValues>({
    resolver: zodResolver(listingSchema),
    defaultValues: initial ?? {
      listingType: "seat",
      title: "",
      description: "",
      areaId: "",
      addressLine: "",
      lat: null,
      lng: null,
      rent: "",
      advanceDeposit: 0,
      availableFrom: "",
      genderPref: "any",
      tenantPref: "any",
      seatsAvailable: 1,
      facilities: [],
      contactName: "",
      contactPhone: "",
    },
  });
  const { errors } = form.formState;
  const [areaId, lat, lng] = useWatch({ control: form.control, name: ["areaId", "lat", "lng"] });
  const area = areas.find((a) => String(a.id) === String(areaId));
  const center: [number, number] | null = area?.lat != null && area?.lng != null ? [area.lat, area.lng] : null;
  const existing = (photos ?? []).filter((p) => !removed.includes(p.id));

  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      setError(null);
      const result = await saveListing(form.getValues(), listingId);
      if (!result.ok) return setError(result.error);
      const id = result.data.id;
      if (removed.length > 0) await removeListingPhotos(id, removed);
      if (files.length > 0) {
        try {
          const paths = await Promise.all(files.map((file) => uploadImage("listing-photos", `${userId}/${id}`, file)));
          const added = await addListingPhotos(id, paths);
          if (!added.ok) toast.error(te(added.error));
        } catch (e) {
          toast.error(te(toErrorKey(e)));
        }
      }
      toast.success(listingId ? t("updated") : t("submitted"), { description: t("reviewNote") });
      router.push(`/housing/${id}`);
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6">
      <section className="grid gap-4 rounded-2xl border bg-card p-4 sm:p-5">
        <h2 className="font-semibold">{t("basics")}</h2>
        <Controller
          control={form.control}
          name="listingType"
          render={({ field }) => (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label={t("type")}>
              {LISTING_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  role="radio"
                  aria-checked={field.value === type}
                  onClick={() => field.onChange(type)}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-left transition-colors",
                    field.value === type ? "border-primary bg-mint-soft" : "hover:bg-accent",
                  )}
                >
                  <span className="block font-medium">{tt(type)}</span>
                  <span className="block text-xs text-muted-foreground">{t(`typeHint.${type}`)}</span>
                </button>
              ))}
            </div>
          )}
        />
        <FormField label={t("title")} hint={t("titleHint")} error={errors.title}>
          {(field) => <Input {...field} maxLength={120} placeholder={t("titlePlaceholder")} {...form.register("title")} />}
        </FormField>
        <FormField label={t("description")} error={errors.description} optional>
          {(field) => <Textarea {...field} rows={5} maxLength={2000} placeholder={t("descriptionPlaceholder")} {...form.register("description")} />}
        </FormField>
      </section>

      <section className="grid gap-4 rounded-2xl border bg-card p-4 sm:p-5">
        <h2 className="font-semibold">{t("where")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t("area")} error={errors.areaId}>
            {(field) => (
              <Controller
                control={form.control}
                name="areaId"
                render={({ field: f }) => (
                  <AreaSelect
                    id={field.id}
                    invalid={field["aria-invalid"]}
                    areas={areas}
                    value={f.value === undefined || f.value === null ? "" : String(f.value)}
                    onChange={f.onChange}
                    placeholder={t("areaPlaceholder")}
                  />
                )}
              />
            )}
          </FormField>
          <FormField label={t("address")} hint={t("addressHint")} error={errors.addressLine} optional>
            {(field) => <Input {...field} maxLength={200} placeholder={t("addressPlaceholder")} {...form.register("addressLine")} />}
          </FormField>
        </div>
        <div className="grid gap-1.5">
          <p className="text-[0.9rem] font-medium">
            {t("pin")} <span className="font-normal text-muted-foreground">({th("optional")})</span>
          </p>
          <GeoMap
            center={center}
            zoom={center ? 15 : 12}
            picker={{
              value: lat != null && lng != null ? { lat: Number(lat), lng: Number(lng) } : null,
              onChange: (p) => {
                form.setValue("lat", p.lat, { shouldDirty: true });
                form.setValue("lng", p.lng, { shouldDirty: true });
              },
            }}
            label={t("pinLabel")}
            className="h-64"
          />
          <p className="flex items-center justify-between gap-2 text-[0.8rem] text-muted-foreground">
            <span>{t("pinHint")}</span>
            {lat != null && (
              <button
                type="button"
                className="shrink-0 underline-offset-2 hover:underline"
                onClick={() => {
                  form.setValue("lat", null);
                  form.setValue("lng", null);
                }}
              >
                {t("clearPin")}
              </button>
            )}
          </p>
        </div>
      </section>

      <section className="grid gap-4 rounded-2xl border bg-card p-4 sm:p-5">
        <h2 className="font-semibold">{t("money")}</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <FormField label={t("rent")} error={errors.rent}>
            {(field) => <Input {...field} type="number" inputMode="numeric" min={0} {...form.register("rent")} />}
          </FormField>
          <FormField label={t("advance")} error={errors.advanceDeposit}>
            {(field) => <Input {...field} type="number" inputMode="numeric" min={0} {...form.register("advanceDeposit")} />}
          </FormField>
          <FormField label={t("seats")} error={errors.seatsAvailable}>
            {(field) => <Input {...field} type="number" inputMode="numeric" min={0} max={50} {...form.register("seatsAvailable")} />}
          </FormField>
          <FormField label={t("availableFrom")} error={errors.availableFrom} optional>
            {(field) => <Input {...field} type="date" {...form.register("availableFrom")} />}
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t("gender")} error={errors.genderPref}>
            {(field) => (
              <Controller
                control={form.control}
                name="genderPref"
                render={({ field: f }) => (
                  <Select value={f.value} onValueChange={f.onChange}>
                    <SelectTrigger id={field.id} className="h-11 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDER_PREFS.map((g) => (
                        <SelectItem key={g} value={g}>
                          {th(`genderPref.${g}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <FormField label={t("tenant")} error={errors.tenantPref}>
            {(field) => (
              <Controller
                control={form.control}
                name="tenantPref"
                render={({ field: f }) => (
                  <Select value={f.value} onValueChange={f.onChange}>
                    <SelectTrigger id={field.id} className="h-11 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TENANT_PREFS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {th(`tenantPref.${p}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
        </div>
      </section>

      <section className="grid gap-3 rounded-2xl border bg-card p-4 sm:p-5">
        <h2 className="font-semibold">{t("facilities")}</h2>
        <Controller
          control={form.control}
          name="facilities"
          render={({ field }) => (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {FACILITIES.map((f) => {
                const Icon = FACILITY_ICONS[f];
                const checked = field.value.includes(f);
                return (
                  <li key={f}>
                    <label
                      className={cn(
                        "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border px-3 text-sm transition-colors",
                        checked ? "border-primary/50 bg-mint-soft" : "hover:bg-accent",
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(on) => field.onChange(on ? [...field.value, f] : field.value.filter((x) => x !== f))}
                      />
                      <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                      {tf(f)}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        />
      </section>

      <section className="grid gap-4 rounded-2xl border bg-card p-4 sm:p-5">
        <h2 className="font-semibold">{t("photosAndContact")}</h2>
        <PhotoPicker
          existing={existing}
          onRemoveExisting={(id) => setRemoved((r) => [...r, id])}
          files={files}
          onFilesChange={setFiles}
          max={8}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t("contactName")} error={errors.contactName} optional>
            {(field) => <Input {...field} maxLength={80} autoComplete="name" {...form.register("contactName")} />}
          </FormField>
          <FormField label={t("contactPhone")} hint={t("contactPhoneHint")} error={errors.contactPhone}>
            {(field) => <Input {...field} type="tel" inputMode="tel" placeholder="01XXXXXXXXX" autoComplete="tel" {...form.register("contactPhone")} />}
          </FormField>
        </div>
      </section>

      <p className="flex items-start gap-2 rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {t("reviewNote")}
      </p>
      <FormError error={error} />
      <LoadingButton type="submit" loading={pending} className="h-12 sm:w-fit sm:px-8">
        {listingId ? t("saveChanges") : t("submit")}
      </LoadingButton>
    </form>
  );
}

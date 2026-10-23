"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, CheckCircle2, MoreVertical, Plus, RotateCcw, Trash2, UserCheck, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useOptimistic, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { type AreaOption, AreaSelect } from "@/components/community/interactive";
import { FormError, FormField, LoadingButton } from "@/components/shared/form";
import { ResponsiveDialog } from "@/components/shared/responsive-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { archiveEvent, deleteJob, saveEvent, saveJob, setJobStatus, setRsvp, submitRecipe } from "@/lib/actions/care";
import type { ErrorKey } from "@/lib/errors";
import {
  EQUIPMENT,
  EVENT_TYPES,
  type EventInput,
  eventSchema,
  JOB_TYPES,
  type JobInput,
  jobSchema,
  type RecipeInput,
  recipeSchema,
} from "@/lib/validations/care";

function EnumSelect<T extends string>({
  id,
  value,
  onChange,
  options,
  render,
}: {
  id: string;
  value: T;
  onChange: (v: T) => void;
  options: readonly T[];
  render: (v: T) => string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger id={id} className="h-11 w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {render(o)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ----------------------------------------------------------------- recipes ---
export function SubmitRecipeButton() {
  const t = useTranslations("care.food.form");
  const te = useTranslations("equipment");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(null);
  const form = useForm<RecipeInput, unknown, z.output<typeof recipeSchema>>({
    resolver: zodResolver(recipeSchema),
    defaultValues: { titleBn: "", titleEn: "", description: "", ingredients: "", steps: "", equipment: "rice_cooker", cookMinutes: "", servings: 1, costEstimate: "", isSickFriendly: false },
  });
  const { errors } = form.formState;
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden="true" />
        {t("open")}
      </Button>
      <ResponsiveDialog open={open} onOpenChange={setOpen} title={t("title")} description={t("body")}>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={form.handleSubmit(() =>
            startTransition(async () => {
              setError(null);
              const result = await submitRecipe(form.getValues());
              if (!result.ok) return setError(result.error);
              toast.success(t("sent"));
              form.reset();
              setOpen(false);
            }),
          )}
        >
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t("titleBn")} error={errors.titleBn}>
              {(field) => <Input {...field} maxLength={100} placeholder="ডিম খিচুড়ি" {...form.register("titleBn")} />}
            </FormField>
            <FormField label={t("titleEn")} error={errors.titleEn} optional>
              {(field) => <Input {...field} maxLength={100} placeholder="Egg khichuri" {...form.register("titleEn")} />}
            </FormField>
          </div>
          <FormField label={t("ingredients")} hint={t("ingredientsHint")} error={errors.ingredients}>
            {(field) => <Textarea {...field} rows={4} maxLength={2000} {...form.register("ingredients")} />}
          </FormField>
          <FormField label={t("steps")} error={errors.steps}>
            {(field) => <Textarea {...field} rows={5} maxLength={4000} {...form.register("steps")} />}
          </FormField>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <FormField label={t("equipment")} error={errors.equipment} className="col-span-2">
              {(field) => (
                <Controller
                  control={form.control}
                  name="equipment"
                  render={({ field: f }) => <EnumSelect id={field.id} value={f.value} onChange={f.onChange} options={EQUIPMENT} render={(e) => te(e)} />}
                />
              )}
            </FormField>
            <FormField label={t("minutes")} error={errors.cookMinutes} optional>
              {(field) => <Input {...field} type="number" inputMode="numeric" min={1} {...form.register("cookMinutes")} />}
            </FormField>
            <FormField label={t("cost")} error={errors.costEstimate} optional>
              {(field) => <Input {...field} type="number" inputMode="numeric" min={0} {...form.register("costEstimate")} />}
            </FormField>
          </div>
          <Controller
            control={form.control}
            name="isSickFriendly"
            render={({ field }) => (
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2.5">
                <span className="text-sm">{t("sickFriendly")}</span>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </label>
            )}
          />
          <FormError error={error} />
          <LoadingButton type="submit" loading={pending}>
            {t("submit")}
          </LoadingButton>
        </form>
      </ResponsiveDialog>
    </>
  );
}

// ------------------------------------------------------------------ events ---
export function NewEventButton({ areas }: { areas: AreaOption[] }) {
  const t = useTranslations("care.events.form");
  const tt = useTranslations("eventTypes");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(null);
  const form = useForm<EventInput, unknown, z.output<typeof eventSchema>>({
    resolver: zodResolver(eventSchema),
    defaultValues: { eventType: "meetup", title: "", description: "", areaId: "", venue: "", startsAt: "", endsAt: "", maxPeople: "", contactPhone: "" },
  });
  const { errors } = form.formState;
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden="true" />
        {t("open")}
      </Button>
      <ResponsiveDialog open={open} onOpenChange={setOpen} title={t("title")} description={t("body")}>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={form.handleSubmit(() =>
            startTransition(async () => {
              setError(null);
              const result = await saveEvent(form.getValues());
              if (!result.ok) return setError(result.error);
              toast.success(t("created"));
              form.reset();
              setOpen(false);
            }),
          )}
        >
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t("type")} error={errors.eventType}>
              {(field) => (
                <Controller
                  control={form.control}
                  name="eventType"
                  render={({ field: f }) => <EnumSelect id={field.id} value={f.value} onChange={f.onChange} options={EVENT_TYPES} render={(e) => tt(e)} />}
                />
              )}
            </FormField>
            <FormField label={t("area")} error={errors.areaId} optional>
              {(field) => (
                <Controller
                  control={form.control}
                  name="areaId"
                  render={({ field: f }) => (
                    <AreaSelect id={field.id} areas={areas} value={f.value === null || f.value === undefined ? "" : String(f.value)} onChange={f.onChange} anyLabel={t("anyArea")} />
                  )}
                />
              )}
            </FormField>
          </div>
          <FormField label={t("name")} error={errors.title}>
            {(field) => <Input {...field} maxLength={120} placeholder={t("namePlaceholder")} {...form.register("title")} />}
          </FormField>
          <FormField label={t("description")} error={errors.description} optional>
            {(field) => <Textarea {...field} rows={3} maxLength={2000} placeholder={t("descriptionPlaceholder")} {...form.register("description")} />}
          </FormField>
          <FormField label={t("venue")} error={errors.venue} optional>
            {(field) => <Input {...field} maxLength={200} {...form.register("venue")} />}
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t("starts")} error={errors.startsAt}>
              {(field) => <Input {...field} type="datetime-local" {...form.register("startsAt")} />}
            </FormField>
            <FormField label={t("ends")} error={errors.endsAt} optional>
              {(field) => <Input {...field} type="datetime-local" {...form.register("endsAt")} />}
            </FormField>
            <FormField label={t("max")} error={errors.maxPeople} optional>
              {(field) => <Input {...field} type="number" inputMode="numeric" min={2} {...form.register("maxPeople")} />}
            </FormField>
            <FormField label={t("phone")} error={errors.contactPhone} optional>
              {(field) => <Input {...field} type="tel" inputMode="tel" placeholder="01XXXXXXXXX" {...form.register("contactPhone")} />}
            </FormField>
          </div>
          <FormError error={error} />
          <LoadingButton type="submit" loading={pending}>
            {t("create")}
          </LoadingButton>
        </form>
      </ResponsiveDialog>
    </>
  );
}

export function RsvpButton({ eventId, going, full }: { eventId: string; going: boolean; full: boolean }) {
  const t = useTranslations("care.events");
  const te = useTranslations("errors");
  const [state, setState] = useOptimistic(going);
  const [, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant={state ? "default" : "outline"}
      disabled={!state && full}
      onClick={() =>
        startTransition(async () => {
          setState(!state);
          const result = await setRsvp(eventId, !state);
          if (!result.ok) toast.error(te(result.error));
        })
      }
    >
      {state ? <UserCheck className="size-4" aria-hidden="true" /> : <UserPlus className="size-4" aria-hidden="true" />}
      {state ? t("going") : full ? t("full") : t("join")}
    </Button>
  );
}

export function ArchiveEventButton({ id }: { id: string }) {
  const t = useTranslations("care.events");
  const te = useTranslations("errors");
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await archiveEvent(id);
          if (!result.ok) toast.error(te(result.error));
          else toast.success(t("archived"));
        })
      }
    >
      <Archive className="size-4" aria-hidden="true" />
      {t("cancelEvent")}
    </Button>
  );
}

// -------------------------------------------------------------------- jobs ---
export function NewJobButton({ areas, phone }: { areas: AreaOption[]; phone: string }) {
  const t = useTranslations("care.jobs.form");
  const tj = useTranslations("jobTypes");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(null);
  const form = useForm<JobInput, unknown, z.output<typeof jobSchema>>({
    resolver: zodResolver(jobSchema),
    defaultValues: { jobType: "tuition", title: "", description: "", areaId: "", salaryText: "", scheduleText: "", contactPhone: phone, expiresAt: "" },
  });
  const { errors } = form.formState;
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden="true" />
        {t("open")}
      </Button>
      <ResponsiveDialog open={open} onOpenChange={setOpen} title={t("title")} description={t("body")}>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={form.handleSubmit(() =>
            startTransition(async () => {
              setError(null);
              const result = await saveJob(form.getValues());
              if (!result.ok) return setError(result.error);
              toast.success(t("posted"));
              form.reset();
              setOpen(false);
            }),
          )}
        >
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t("type")} error={errors.jobType}>
              {(field) => (
                <Controller
                  control={form.control}
                  name="jobType"
                  render={({ field: f }) => <EnumSelect id={field.id} value={f.value} onChange={f.onChange} options={JOB_TYPES} render={(j) => tj(j)} />}
                />
              )}
            </FormField>
            <FormField label={t("area")} error={errors.areaId} optional>
              {(field) => (
                <Controller
                  control={form.control}
                  name="areaId"
                  render={({ field: f }) => (
                    <AreaSelect id={field.id} areas={areas} value={f.value === null || f.value === undefined ? "" : String(f.value)} onChange={f.onChange} anyLabel={t("anyArea")} />
                  )}
                />
              )}
            </FormField>
          </div>
          <FormField label={t("name")} error={errors.title}>
            {(field) => <Input {...field} maxLength={120} placeholder={t("namePlaceholder")} {...form.register("title")} />}
          </FormField>
          <FormField label={t("description")} error={errors.description}>
            {(field) => <Textarea {...field} rows={4} maxLength={2000} placeholder={t("descriptionPlaceholder")} {...form.register("description")} />}
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t("salary")} error={errors.salaryText} optional>
              {(field) => <Input {...field} maxLength={80} placeholder={t("salaryPlaceholder")} {...form.register("salaryText")} />}
            </FormField>
            <FormField label={t("schedule")} error={errors.scheduleText} optional>
              {(field) => <Input {...field} maxLength={120} placeholder={t("schedulePlaceholder")} {...form.register("scheduleText")} />}
            </FormField>
            <FormField label={t("phone")} error={errors.contactPhone}>
              {(field) => <Input {...field} type="tel" inputMode="tel" placeholder="01XXXXXXXXX" {...form.register("contactPhone")} />}
            </FormField>
            <FormField label={t("expires")} error={errors.expiresAt} optional>
              {(field) => <Input {...field} type="date" {...form.register("expiresAt")} />}
            </FormField>
          </div>
          <FormError error={error} />
          <LoadingButton type="submit" loading={pending}>
            {t("post")}
          </LoadingButton>
        </form>
      </ResponsiveDialog>
    </>
  );
}

export function JobMenu({ id, title, status }: { id: string; title: string; status: "open" | "closed" | "removed" }) {
  const t = useTranslations("care.jobs");
  const te = useTranslations("errors");
  const [, startTransition] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: ErrorKey }>) =>
    startTransition(async () => {
      const result = await fn();
      if (!result.ok && result.error) toast.error(te(result.error));
    });
  if (status === "removed") return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t("menu", { title })}>
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {status === "open" ? (
          <DropdownMenuItem onSelect={() => run(() => setJobStatus(id, "closed"))}>
            <CheckCircle2 className="size-4" />
            {t("filled")}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => run(() => setJobStatus(id, "open"))}>
            <RotateCcw className="size-4" />
            {t("reopen")}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => run(() => deleteJob(id))}>
          <Trash2 className="size-4" />
          {t("delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

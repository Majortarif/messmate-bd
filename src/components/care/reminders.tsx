"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useOptimistic, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { FormError, FormField, LoadingButton } from "@/components/shared/form";
import { ResponsiveDialog } from "@/components/shared/responsive-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { deleteReminder, saveReminder, setReminderActive } from "@/lib/actions/care";
import type { ErrorKey } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { REMINDER_TYPES, type ReminderInput, reminderSchema } from "@/lib/validations/care";

/** Dhaka's week starts on Saturday; values are Postgres day-of-week (0 = Sunday). */
export const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5] as const;

const DEFAULT_TIME: Record<(typeof REMINDER_TYPES)[number], string> = {
  medicine: "09:00",
  water: "11:00",
  sleep: "23:30",
  call_home: "21:00",
  rent: "10:00",
  bill: "10:00",
  custom: "08:00",
};

function ReminderForm({ reminderId, initial, onDone }: { reminderId?: string; initial: ReminderInput; onDone: () => void }) {
  const t = useTranslations("care.reminders.form");
  const tt = useTranslations("care.reminders.types");
  const td = useTranslations("weekdays");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(null);
  const form = useForm<ReminderInput, unknown, z.output<typeof reminderSchema>>({ resolver: zodResolver(reminderSchema), defaultValues: initial });
  const { errors } = form.formState;

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={form.handleSubmit(() =>
        startTransition(async () => {
          setError(null);
          const result = await saveReminder(form.getValues(), reminderId);
          if (!result.ok) return setError(result.error);
          toast.success(t("saved"));
          onDone();
        }),
      )}
    >
      <FormField label={t("type")} error={errors.type}>
        {(field) => (
          <Controller
            control={form.control}
            name="type"
            render={({ field: f }) => (
              <Select
                value={f.value}
                onValueChange={(v) => {
                  const type = v as (typeof REMINDER_TYPES)[number];
                  f.onChange(type);
                  if (!reminderId) {
                    form.setValue("title", type === "custom" ? "" : tt(type));
                    form.setValue("remindAt", DEFAULT_TIME[type]);
                  }
                }}
              >
                <SelectTrigger id={field.id} className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REMINDER_TYPES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {tt(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        )}
      </FormField>
      <div className="grid grid-cols-[1fr_8rem] gap-4">
        <FormField label={t("title")} error={errors.title}>
          {(field) => <Input {...field} maxLength={80} placeholder={t("titlePlaceholder")} {...form.register("title")} />}
        </FormField>
        <FormField label={t("time")} error={errors.remindAt}>
          {(field) => <Input {...field} type="time" {...form.register("remindAt")} />}
        </FormField>
      </div>
      <div className="grid gap-1.5">
        <p className="text-[0.9rem] font-medium">{t("days")}</p>
        <Controller
          control={form.control}
          name="daysOfWeek"
          render={({ field }) => (
            <div className="grid grid-cols-7 gap-1" role="group" aria-label={t("days")}>
              {WEEK_ORDER.map((d) => {
                const on = field.value.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    aria-label={td(`long.${d}`)}
                    onClick={() => field.onChange(on ? field.value.filter((x) => x !== d) : [...field.value, d])}
                    className={cn("h-10 rounded-lg border text-xs", on ? "border-primary/50 bg-mint-soft font-medium" : "text-muted-foreground")}
                  >
                    {td(`short.${d}`)}
                  </button>
                );
              })}
            </div>
          )}
        />
        {errors.daysOfWeek && (
          <p role="alert" className="text-[0.8rem] text-destructive">
            {t("pickDays")}
          </p>
        )}
      </div>
      <FormField label={t("note")} hint={t("noteHint")} error={errors.note} optional>
        {(field) => <Input {...field} maxLength={200} placeholder={t("notePlaceholder")} {...form.register("note")} />}
      </FormField>
      <FormError error={error} />
      <LoadingButton type="submit" loading={pending}>
        {t("save")}
      </LoadingButton>
    </form>
  );
}

export function AddReminderButton() {
  const t = useTranslations("care.reminders");
  const tt = useTranslations("care.reminders.types");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden="true" />
        {t("add")}
      </Button>
      <ResponsiveDialog open={open} onOpenChange={setOpen} title={t("addTitle")} description={t("addBody")}>
        <ReminderForm
          initial={{ type: "medicine", title: tt("medicine"), note: "", remindAt: DEFAULT_TIME.medicine, daysOfWeek: [0, 1, 2, 3, 4, 5, 6], isActive: true }}
          onDone={() => setOpen(false)}
        />
      </ResponsiveDialog>
    </>
  );
}

export function ReminderControls({ id, title, active, initial }: { id: string; title: string; active: boolean; initial: ReminderInput }) {
  const t = useTranslations("care.reminders");
  const te = useTranslations("errors");
  const [on, setOn] = useOptimistic(active);
  const [edit, setEdit] = useState(false);
  const [, startTransition] = useTransition();
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Switch
        checked={on}
        aria-label={t("toggle", { title })}
        onCheckedChange={(v) =>
          startTransition(async () => {
            setOn(v);
            const result = await setReminderActive(id, v);
            if (!result.ok) toast.error(te(result.error));
          })
        }
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={t("menu", { title })}>
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEdit(true)}>
            <Pencil className="size-4" />
            {t("edit")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() =>
              startTransition(async () => {
                const result = await deleteReminder(id);
                if (!result.ok) toast.error(te(result.error));
              })
            }
          >
            <Trash2 className="size-4" />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ResponsiveDialog open={edit} onOpenChange={setEdit} title={t("editTitle")}>
        <ReminderForm reminderId={id} initial={initial} onDone={() => setEdit(false)} />
      </ResponsiveDialog>
    </div>
  );
}

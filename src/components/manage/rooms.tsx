"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { BedDouble, Pencil, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { FormError, FormField, LoadingButton } from "@/components/shared/form";
import { ResponsiveDialog } from "@/components/shared/responsive-dialog";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deleteRoom, saveRoom } from "@/lib/actions/manage";
import type { ErrorKey } from "@/lib/errors";
import { formatNumber, formatTaka } from "@/lib/format";
import { ROOM_TYPES, roomSchema } from "@/lib/validations/manage";
import type { Enums } from "@/types/database";

export type RoomRow = {
  id: string;
  building: string | null;
  flat: string | null;
  label: string;
  type: Enums<"room_type">;
  capacity: number;
  rent: number;
  occupants: number;
};
type FormIn = z.input<typeof roomSchema>;
type FormOut = z.output<typeof roomSchema>;

export function RoomManager({ messId, rooms }: { messId: string; rooms: RoomRow[] }) {
  const t = useTranslations("manage.rooms");
  const tr = useTranslations("roomTypes");
  const te = useTranslations("errors");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RoomRow | null>(null);
  const [error, setError] = useState<ErrorKey | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(roomSchema),
    values: editing
      ? {
          id: editing.id,
          building: editing.building ?? "",
          flat: editing.flat ?? "",
          roomLabel: editing.label,
          roomType: editing.type,
          capacity: editing.capacity,
          monthlyRent: editing.rent,
        }
      : { building: "", flat: "", roomLabel: "", roomType: "shared", capacity: 2, monthlyRent: 0 },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      setError(null);
      const result = await saveRoom(messId, values);
      if (!result.ok) return setError(result.error);
      toast.success(t("saved"));
      setOpen(false);
    }),
  );

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <BedDouble className="size-[18px] text-muted-foreground" aria-hidden="true" />
          {t("title")}
        </h2>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setEditing(null);
            setError(null);
            setOpen(true);
          }}
        >
          <Plus className="size-4" aria-hidden="true" />
          {t("add")}
        </Button>
      </div>
      {rooms.length === 0 ? (
        <EmptyState icon={BedDouble} title={t("empty")} body={t("emptyBody")} className="py-4" />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {rooms.map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-xl border px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {r.label}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">{tr(r.type)}</span>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {[r.building, r.flat].filter(Boolean).join(" · ")}
                  {r.building || r.flat ? " · " : ""}
                  {t("occupancy", { used: formatNumber(r.occupants, locale), capacity: formatNumber(r.capacity, locale) })} ·{" "}
                  {formatTaka(r.rent, locale)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("edit")}
                onClick={() => {
                  setEditing(r);
                  setError(null);
                  setOpen(true);
                }}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("delete")}
                onClick={() =>
                  startTransition(async () => {
                    const result = await deleteRoom(r.id);
                    if (result.ok) toast.success(t("deleted"));
                    else toast.error(te(result.error));
                  })
                }
              >
                <Trash2 className="size-4 text-coral" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ResponsiveDialog open={open} onOpenChange={setOpen} title={editing ? t("editTitle") : t("addTitle")}>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t("label")} error={errors.roomLabel}>
              {(field) => <Input {...field} placeholder="301" {...form.register("roomLabel")} />}
            </FormField>
            <FormField label={t("type")} error={errors.roomType}>
              {(field) => (
                <Controller
                  control={form.control}
                  name="roomType"
                  render={({ field: f }) => (
                    <Select value={f.value} onValueChange={f.onChange}>
                      <SelectTrigger id={field.id} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROOM_TYPES.map((rt) => (
                          <SelectItem key={rt} value={rt}>
                            {tr(rt)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </FormField>
            <FormField label={t("building")} error={errors.building} optional>
              {(field) => <Input {...field} {...form.register("building")} />}
            </FormField>
            <FormField label={t("flat")} error={errors.flat} optional>
              {(field) => <Input {...field} placeholder="3-A" {...form.register("flat")} />}
            </FormField>
            <FormField label={t("capacity")} error={errors.capacity}>
              {(field) => <Input {...field} type="number" min={1} max={20} {...form.register("capacity")} />}
            </FormField>
            <FormField label={t("rent")} hint={t("rentHint")} error={errors.monthlyRent}>
              {(field) => <Input {...field} type="number" min={0} {...form.register("monthlyRent")} />}
            </FormField>
          </div>
          <FormError error={error} />
          <LoadingButton type="submit" loading={pending}>
            {t("save")}
          </LoadingButton>
        </form>
      </ResponsiveDialog>
    </section>
  );
}

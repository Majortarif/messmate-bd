"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, MoreVertical, Pencil, Plus, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { FormError, FormField, LoadingButton } from "@/components/shared/form";
import { ResponsiveDialog } from "@/components/shared/responsive-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { deleteRentPayment, deleteRentRecord, saveRentPayment, saveRentRecord } from "@/lib/actions/housing";
import type { ErrorKey } from "@/lib/errors";
import { PAYMENT_METHODS, type RentPaymentInput, rentPaymentSchema, type RentRecordInput, rentRecordSchema } from "@/lib/validations/community";

// ------------------------------------------------------------ record form ---
export const EMPTY_RENT_RECORD: RentRecordInput = {
  title: "",
  landlordName: "",
  landlordPhone: "",
  propertyAddress: "",
  monthlyRent: "",
  advancePaid: 0,
  securityDeposit: 0,
  rentDueDay: 5,
  agreementStart: "",
  agreementEnd: "",
  noticePeriodDays: "",
  agreementNotes: "",
  isActive: true,
};

function RentRecordForm({ recordId, initial, onDone }: { recordId?: string; initial: RentRecordInput; onDone: () => void }) {
  const t = useTranslations("housing.rent.form");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(null);
  const form = useForm<RentRecordInput, unknown, z.output<typeof rentRecordSchema>>({
    resolver: zodResolver(rentRecordSchema),
    defaultValues: initial,
  });
  const { errors } = form.formState;

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={form.handleSubmit(() =>
        startTransition(async () => {
          setError(null);
          const result = await saveRentRecord(form.getValues(), recordId);
          if (!result.ok) return setError(result.error);
          toast.success(t("saved"));
          onDone();
        }),
      )}
    >
      <FormField label={t("title")} hint={t("titleHint")} error={errors.title}>
        {(field) => <Input {...field} maxLength={80} placeholder={t("titlePlaceholder")} {...form.register("title")} />}
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label={t("monthlyRent")} error={errors.monthlyRent}>
          {(field) => <Input {...field} type="number" inputMode="numeric" min={0} {...form.register("monthlyRent")} />}
        </FormField>
        <FormField label={t("dueDay")} hint={t("dueDayHint")} error={errors.rentDueDay}>
          {(field) => <Input {...field} type="number" inputMode="numeric" min={1} max={28} {...form.register("rentDueDay")} />}
        </FormField>
        <FormField label={t("advance")} error={errors.advancePaid}>
          {(field) => <Input {...field} type="number" inputMode="numeric" min={0} {...form.register("advancePaid")} />}
        </FormField>
        <FormField label={t("deposit")} error={errors.securityDeposit}>
          {(field) => <Input {...field} type="number" inputMode="numeric" min={0} {...form.register("securityDeposit")} />}
        </FormField>
        <FormField label={t("landlord")} error={errors.landlordName} optional>
          {(field) => <Input {...field} maxLength={80} {...form.register("landlordName")} />}
        </FormField>
        <FormField label={t("landlordPhone")} error={errors.landlordPhone} optional>
          {(field) => <Input {...field} type="tel" inputMode="tel" placeholder="01XXXXXXXXX" {...form.register("landlordPhone")} />}
        </FormField>
      </div>
      <FormField label={t("address")} error={errors.propertyAddress} optional>
        {(field) => <Input {...field} maxLength={200} {...form.register("propertyAddress")} />}
      </FormField>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <FormField label={t("start")} error={errors.agreementStart} optional>
          {(field) => <Input {...field} type="date" {...form.register("agreementStart")} />}
        </FormField>
        <FormField label={t("end")} error={errors.agreementEnd} optional>
          {(field) => <Input {...field} type="date" {...form.register("agreementEnd")} />}
        </FormField>
        <FormField label={t("notice")} error={errors.noticePeriodDays} optional className="col-span-2 sm:col-span-1">
          {(field) => <Input {...field} type="number" inputMode="numeric" min={0} max={365} placeholder="30" {...form.register("noticePeriodDays")} />}
        </FormField>
      </div>
      <FormField label={t("notes")} hint={t("notesHint")} error={errors.agreementNotes} optional>
        {(field) => <Textarea {...field} rows={4} maxLength={3000} placeholder={t("notesPlaceholder")} {...form.register("agreementNotes")} />}
      </FormField>
      <Controller
        control={form.control}
        name="isActive"
        render={({ field }) => (
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2.5">
            <span>
              <span className="block text-sm font-medium">{t("active")}</span>
              <span className="block text-xs text-muted-foreground">{t("activeHint")}</span>
            </span>
            <Switch checked={field.value} onCheckedChange={field.onChange} />
          </label>
        )}
      />
      <FormError error={error} />
      <LoadingButton type="submit" loading={pending}>
        {t("save")}
      </LoadingButton>
    </form>
  );
}

export function AddRentRecordButton() {
  const t = useTranslations("housing.rent");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden="true" />
        {t("add")}
      </Button>
      <ResponsiveDialog open={open} onOpenChange={setOpen} title={t("addTitle")} description={t("addBody")}>
        <RentRecordForm initial={EMPTY_RENT_RECORD} onDone={() => setOpen(false)} />
      </ResponsiveDialog>
    </>
  );
}

/** Edit / delete menu for one rent record. */
export function RentRecordMenu({ recordId, title, initial }: { recordId: string; title: string; initial: RentRecordInput }) {
  const t = useTranslations("housing.rent");
  const te = useTranslations("errors");
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [, startTransition] = useTransition();
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t("menu", { title })}>
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEdit(true)}>
            <Pencil className="size-4" />
            {t("edit")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirm(true)}>
            <Trash2 className="size-4" />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ResponsiveDialog open={edit} onOpenChange={setEdit} title={t("editTitle")}>
        <RentRecordForm recordId={recordId} initial={initial} onDone={() => setEdit(false)} />
      </ResponsiveDialog>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle", { title })}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteRentRecord(recordId);
                  if (!result.ok) toast.error(te(result.error));
                  else toast.success(t("deleted"));
                })
              }
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ---------------------------------------------------------------- payment ---
/** "Mark paid" for a month, pre-filled with the monthly rent and today's date. */
export function PayRentButton({
  recordId,
  month,
  monthLabel,
  amount,
  today,
  variant = "default",
}: {
  recordId: string;
  month: string;
  monthLabel: string;
  amount: number;
  today: string;
  variant?: "default" | "outline";
}) {
  const t = useTranslations("housing.rent.pay");
  const tm = useTranslations("wallet.add.methods");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(null);
  const form = useForm<RentPaymentInput, unknown, z.output<typeof rentPaymentSchema>>({
    resolver: zodResolver(rentPaymentSchema),
    defaultValues: { recordId, month, amount, paidOn: today, method: "cash", note: "" },
  });
  const { errors } = form.formState;

  return (
    <>
      <Button size="sm" variant={variant} onClick={() => setOpen(true)}>
        <CheckCircle2 className="size-4" aria-hidden="true" />
        {t("button")}
      </Button>
      <ResponsiveDialog open={open} onOpenChange={setOpen} title={t("title", { month: monthLabel })}>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={form.handleSubmit(() =>
            startTransition(async () => {
              setError(null);
              const result = await saveRentPayment(form.getValues());
              if (!result.ok) return setError(result.error);
              toast.success(t("saved", { month: monthLabel }));
              setOpen(false);
            }),
          )}
        >
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t("amount")} error={errors.amount}>
              {(field) => <Input {...field} type="number" inputMode="numeric" min={1} {...form.register("amount")} />}
            </FormField>
            <FormField label={t("paidOn")} error={errors.paidOn}>
              {(field) => <Input {...field} type="date" max={today} {...form.register("paidOn")} />}
            </FormField>
          </div>
          <FormField label={t("method")} error={errors.method}>
            {(field) => (
              <Controller
                control={form.control}
                name="method"
                render={({ field: f }) => (
                  <Select value={f.value} onValueChange={f.onChange}>
                    <SelectTrigger id={field.id} className="h-11 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {tm(m)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <FormField label={t("note")} error={errors.note} optional>
            {(field) => <Input {...field} maxLength={200} placeholder={t("notePlaceholder")} {...form.register("note")} />}
          </FormField>
          <FormError error={error} />
          <LoadingButton type="submit" loading={pending}>
            {t("save")}
          </LoadingButton>
        </form>
      </ResponsiveDialog>
    </>
  );
}

export function DeletePaymentButton({ paymentId, label }: { paymentId: string; label: string }) {
  const te = useTranslations("errors");
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={pending}
      aria-label={label}
      onClick={() =>
        startTransition(async () => {
          const result = await deleteRentPayment(paymentId);
          if (!result.ok) toast.error(te(result.error));
        })
      }
    >
      <X className="size-4" />
    </Button>
  );
}

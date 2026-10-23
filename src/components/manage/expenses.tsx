"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { FormError, FormField, LoadingButton } from "@/components/shared/form";
import { ImagePicker } from "@/components/shared/image-picker";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deleteExpense, saveExpense } from "@/lib/actions/manage";
import { toErrorKey, type ErrorKey } from "@/lib/errors";
import { dhakaToday, formatDate, formatTaka } from "@/lib/format";
import { uploadImage } from "@/lib/image";
import { cn } from "@/lib/utils";
import { EXPENSE_CATEGORIES, expenseSchema } from "@/lib/validations/manage";
import type { Enums } from "@/types/database";

export type ExpenseRow = {
  id: string;
  category: Enums<"expense_category">;
  amount: number;
  date: string;
  description: string | null;
  paidFrom: Enums<"expense_payer">;
  payerId: string | null;
  payerName: string | null;
  reimbursed: boolean;
  receiptUrl: string | null;
};
type Member = { userId: string; name: string };
type FormIn = z.input<typeof expenseSchema>;
type FormOut = z.output<typeof expenseSchema>;

function ExpenseDialog({
  messId,
  members,
  editing,
  open,
  onOpenChange,
}: {
  messId: string;
  members: Member[];
  editing: ExpenseRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("manage.expenses");
  const tc = useTranslations("expenseCategories");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [error, setError] = useState<ErrorKey | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(expenseSchema),
    values: editing
      ? {
          category: editing.category,
          amount: editing.amount,
          expenseDate: editing.date,
          description: editing.description ?? "",
          paidFrom: editing.paidFrom,
          paidBy: editing.payerId ?? undefined,
        }
      : { category: "bazar", amount: "", expenseDate: dhakaToday(), description: "", paidFrom: "mess_fund", paidBy: undefined },
  });
  const paidFrom = useWatch({ control: form.control, name: "paidFrom" });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      setError(null);
      try {
        const receiptPath = receipt ? await uploadImage("receipts", messId, receipt) : undefined;
        const result = await saveExpense(messId, { ...values, receiptPath }, editing?.id);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast.success(editing ? t("updated") : t("added"));
        setReceipt(null);
        onOpenChange(false);
      } catch (e) {
        setError(toErrorKey(e));
      }
    }),
  );

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title={editing ? t("editTitle") : t("addTitle")} description={t("dialogBody")}>
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t("category")} error={errors.category}>
            {(field) => (
              <Controller
                control={form.control}
                name="category"
                render={({ field: f }) => (
                  <Select value={f.value} onValueChange={f.onChange}>
                    <SelectTrigger id={field.id} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map((c) => (
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
          <FormField label={t("amount")} error={errors.amount}>
            {(field) => <Input {...field} type="number" inputMode="decimal" min={1} readOnly={editing?.reimbursed} {...form.register("amount")} />}
          </FormField>
        </div>
        <FormField label={t("date")} error={errors.expenseDate}>
          {(field) => <Input {...field} type="date" max={dhakaToday()} readOnly={editing?.reimbursed} {...form.register("expenseDate")} />}
        </FormField>
        <FormField label={t("description")} error={errors.description} optional>
          {(field) => <Input {...field} maxLength={300} placeholder={t("descriptionPlaceholder")} {...form.register("description")} />}
        </FormField>

        {!editing && (
          <>
            <Controller
              control={form.control}
              name="paidFrom"
              render={({ field }) => (
                <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-2 sm:grid-cols-2" aria-label={t("paidFrom")}>
                  {(["mess_fund", "member"] as const).map((v) => (
                    <label key={v} className={cn("flex cursor-pointer items-start gap-2.5 rounded-xl border p-3", field.value === v && "border-primary/60 bg-mint-soft")}>
                      <RadioGroupItem value={v} className="mt-1" />
                      <span className="grid">
                        <span className="text-sm font-medium">{t(`payer.${v}.title`)}</span>
                        <span className="text-xs text-muted-foreground">{t(`payer.${v}.body`)}</span>
                      </span>
                    </label>
                  ))}
                </RadioGroup>
              )}
            />
            {paidFrom === "member" && (
              <FormField label={t("paidBy")} error={errors.paidBy}>
                {(field) => (
                  <Controller
                    control={form.control}
                    name="paidBy"
                    render={({ field: f }) => (
                      <Select value={f.value ?? ""} onValueChange={f.onChange}>
                        <SelectTrigger id={field.id} aria-invalid={field["aria-invalid"]} className="w-full">
                          <SelectValue placeholder={t("paidByPlaceholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          {members.map((m) => (
                            <SelectItem key={m.userId} value={m.userId}>
                              {m.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                )}
              </FormField>
            )}
          </>
        )}
        {editing?.reimbursed && <p className="text-xs text-muted-foreground">{t("reimbursedLocked")}</p>}

        <ImagePicker label={t("receipt")} hint={editing?.receiptUrl ? t("receiptReplace") : t("receiptHint")} file={receipt} onChange={setReceipt} />
        <FormError error={error} />
        <LoadingButton type="submit" loading={pending}>
          {editing ? t("save") : t("add")}
        </LoadingButton>
      </form>
    </ResponsiveDialog>
  );
}

export function ExpenseManager({
  messId,
  rows,
  members,
  closed,
}: {
  messId: string;
  rows: ExpenseRow[];
  members: Member[];
  closed: boolean;
}) {
  const t = useTranslations("manage.expenses");
  const tc = useTranslations("expenseCategories");
  const te = useTranslations("errors");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [, startTransition] = useTransition();

  return (
    <div className="grid gap-3">
      {!closed && (
        <Button
          className="w-full sm:w-fit"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="size-4" aria-hidden="true" />
          {t("add")}
        </Button>
      )}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.description || tc(r.category)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatDate(r.date, locale, { weekday: "short", day: "numeric", month: "short" })} · {tc(r.category)}
                  {r.paidFrom === "member" && r.payerName ? ` · ${t("paidByName", { name: r.payerName })}` : ""}
                </p>
              </div>
              {r.receiptUrl && (
                <a
                  href={r.receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent"
                  aria-label={t("receipt")}
                >
                  <Receipt className="size-4" />
                </a>
              )}
              <span className="num text-sm font-semibold">{formatTaka(r.amount, locale)}</span>
              {!closed && (
                <div className="flex">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("edit")}
                    onClick={() => {
                      setEditing(r);
                      setOpen(true);
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={t("delete")}>
                        <Trash2 className="size-4 text-coral" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
                        <AlertDialogDescription>{r.reimbursed ? t("deleteReimbursed") : t("deleteBody")}</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-white hover:bg-destructive/90"
                          onClick={() =>
                            startTransition(async () => {
                              const result = await deleteExpense(r.id);
                              if (result.ok) toast.success(t("deleted"));
                              else toast.error(te(result.error));
                            })
                          }
                        >
                          {t("delete")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <ExpenseDialog messId={messId} members={members} editing={editing} open={open} onOpenChange={setOpen} />
    </div>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { HandCoins, MoreVertical, Plus, Target, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { FormError, FormField, LoadingButton } from "@/components/shared/form";
import { ResponsiveDialog } from "@/components/shared/responsive-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addBudgetEntry, addLoanPayment, deleteBudgetEntry, deleteLoan, deleteLoanPayment, saveLoan, saveMonthlyBudget } from "@/lib/actions/care";
import type { ErrorKey } from "@/lib/errors";
import { cn } from "@/lib/utils";
import {
  type BudgetEntryInput,
  budgetEntrySchema,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  type LoanInput,
  type LoanPaymentInput,
  loanPaymentSchema,
  loanSchema,
  type MonthlyBudgetInput,
  monthlyBudgetSchema,
} from "@/lib/validations/care";

// ------------------------------------------------------------ month budget ---
export function BudgetButton({ month, initial }: { month: string; initial: { limit: number | null; income: number | null } }) {
  const t = useTranslations("care.money.budget");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(null);
  const form = useForm<MonthlyBudgetInput, unknown, z.output<typeof monthlyBudgetSchema>>({
    resolver: zodResolver(monthlyBudgetSchema),
    defaultValues: { month, limitAmount: initial.limit ?? "", expectedIncome: initial.income ?? "" },
  });
  const { errors } = form.formState;
  return (
    <>
      <Button variant={initial.limit ? "outline" : "default"} onClick={() => setOpen(true)}>
        <Target className="size-4" aria-hidden="true" />
        {initial.limit ? t("change") : t("set")}
      </Button>
      <ResponsiveDialog open={open} onOpenChange={setOpen} title={t("title")} description={t("body")}>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={form.handleSubmit(() =>
            startTransition(async () => {
              setError(null);
              const result = await saveMonthlyBudget(form.getValues());
              if (!result.ok) return setError(result.error);
              toast.success(t("saved"));
              setOpen(false);
            }),
          )}
        >
          <FormField label={t("limit")} hint={t("limitHint")} error={errors.limitAmount}>
            {(field) => <Input {...field} type="number" inputMode="numeric" min={1} {...form.register("limitAmount")} />}
          </FormField>
          <FormField label={t("income")} error={errors.expectedIncome} optional>
            {(field) => <Input {...field} type="number" inputMode="numeric" min={0} {...form.register("expectedIncome")} />}
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

// ----------------------------------------------------------------- entries ---
export function AddEntryButton({ today }: { today: string }) {
  const t = useTranslations("care.money.entry");
  const tc = useTranslations("budgetCategories");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(null);
  const form = useForm<BudgetEntryInput, unknown, z.output<typeof budgetEntrySchema>>({
    resolver: zodResolver(budgetEntrySchema),
    defaultValues: { entryType: "expense", category: "food", amount: "", entryDate: today, note: "" },
  });
  const entryType = useWatch({ control: form.control, name: "entryType" });
  const { errors } = form.formState;
  const categories = entryType === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden="true" />
        {t("add")}
      </Button>
      <ResponsiveDialog open={open} onOpenChange={setOpen} title={t("title")}>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={form.handleSubmit(() =>
            startTransition(async () => {
              setError(null);
              const result = await addBudgetEntry(form.getValues());
              if (!result.ok) return setError(result.error);
              toast.success(t("saved"));
              form.reset({ entryType, category: entryType === "income" ? "salary" : "food", amount: "", entryDate: today, note: "" });
              setOpen(false);
            }),
          )}
        >
          <Controller
            control={form.control}
            name="entryType"
            render={({ field }) => (
              <div className="grid grid-cols-2 gap-1 rounded-xl border p-1" role="radiogroup" aria-label={t("type")}>
                {(["expense", "income"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={field.value === k}
                    onClick={() => {
                      field.onChange(k);
                      form.setValue("category", k === "income" ? "salary" : "food");
                    }}
                    className={cn("h-10 rounded-lg text-sm", field.value === k ? (k === "expense" ? "bg-coral-soft font-medium" : "bg-mint-soft font-medium") : "text-muted-foreground")}
                  >
                    {t(k)}
                  </button>
                ))}
              </div>
            )}
          />
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t("amount")} error={errors.amount}>
              {(field) => <Input {...field} type="number" inputMode="numeric" min={1} autoFocus {...form.register("amount")} />}
            </FormField>
            <FormField label={t("date")} error={errors.entryDate}>
              {(field) => <Input {...field} type="date" max={today} {...form.register("entryDate")} />}
            </FormField>
          </div>
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
                      {categories.map((c) => (
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

export function DeleteEntryButton({ id, label }: { id: string; label: string }) {
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
          const result = await deleteBudgetEntry(id);
          if (!result.ok) toast.error(te(result.error));
        })
      }
    >
      <X className="size-4" />
    </Button>
  );
}

// ------------------------------------------------------------------- loans ---
const EMPTY_LOAN: LoanInput = { direction: "lent", counterpartyName: "", counterpartyPhone: "", amount: "", dueDate: "", note: "" };

function LoanForm({ loanId, initial, onDone }: { loanId?: string; initial: LoanInput; onDone: () => void }) {
  const t = useTranslations("care.money.loan");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(null);
  const form = useForm<LoanInput, unknown, z.output<typeof loanSchema>>({ resolver: zodResolver(loanSchema), defaultValues: initial });
  const { errors } = form.formState;
  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={form.handleSubmit(() =>
        startTransition(async () => {
          setError(null);
          const result = await saveLoan(form.getValues(), loanId);
          if (!result.ok) return setError(result.error);
          toast.success(t("saved"));
          onDone();
        }),
      )}
    >
      <Controller
        control={form.control}
        name="direction"
        render={({ field }) => (
          <div className="grid grid-cols-2 gap-1 rounded-xl border p-1" role="radiogroup" aria-label={t("direction")}>
            {(["lent", "borrowed"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={field.value === k}
                onClick={() => field.onChange(k)}
                className={cn("h-10 rounded-lg text-sm", field.value === k ? "bg-mint-soft font-medium" : "text-muted-foreground")}
              >
                {t(k)}
              </button>
            ))}
          </div>
        )}
      />
      <div className="grid grid-cols-2 gap-4">
        <FormField label={t("name")} error={errors.counterpartyName}>
          {(field) => <Input {...field} maxLength={80} {...form.register("counterpartyName")} />}
        </FormField>
        <FormField label={t("phone")} error={errors.counterpartyPhone} optional>
          {(field) => <Input {...field} type="tel" inputMode="tel" placeholder="01XXXXXXXXX" {...form.register("counterpartyPhone")} />}
        </FormField>
        <FormField label={t("amount")} error={errors.amount}>
          {(field) => <Input {...field} type="number" inputMode="numeric" min={1} {...form.register("amount")} />}
        </FormField>
        <FormField label={t("due")} error={errors.dueDate} optional>
          {(field) => <Input {...field} type="date" {...form.register("dueDate")} />}
        </FormField>
      </div>
      <FormField label={t("note")} error={errors.note} optional>
        {(field) => <Input {...field} maxLength={300} placeholder={t("notePlaceholder")} {...form.register("note")} />}
      </FormField>
      <FormError error={error} />
      <LoadingButton type="submit" loading={pending}>
        {t("save")}
      </LoadingButton>
    </form>
  );
}

export function AddLoanButton() {
  const t = useTranslations("care.money.loan");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden="true" />
        {t("add")}
      </Button>
      <ResponsiveDialog open={open} onOpenChange={setOpen} title={t("addTitle")} description={t("addBody")}>
        <LoanForm initial={EMPTY_LOAN} onDone={() => setOpen(false)} />
      </ResponsiveDialog>
    </>
  );
}

export function LoanPaymentButton({ loanId, remaining, today, label }: { loanId: string; remaining: number; today: string; label: string }) {
  const t = useTranslations("care.money.loan");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(null);
  const form = useForm<LoanPaymentInput, unknown, z.output<typeof loanPaymentSchema>>({
    resolver: zodResolver(loanPaymentSchema),
    defaultValues: { loanId, amount: remaining, paidOn: today, note: "" },
  });
  const { errors } = form.formState;
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <HandCoins className="size-4" aria-hidden="true" />
        {label}
      </Button>
      <ResponsiveDialog open={open} onOpenChange={setOpen} title={label}>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={form.handleSubmit(() =>
            startTransition(async () => {
              setError(null);
              const result = await addLoanPayment(form.getValues());
              if (!result.ok) return setError(result.error);
              toast.success(t("paymentSaved"));
              setOpen(false);
            }),
          )}
        >
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t("amount")} error={errors.amount}>
              {(field) => <Input {...field} type="number" inputMode="numeric" min={1} max={remaining} {...form.register("amount")} />}
            </FormField>
            <FormField label={t("paidOn")} error={errors.paidOn}>
              {(field) => <Input {...field} type="date" max={today} {...form.register("paidOn")} />}
            </FormField>
          </div>
          <FormField label={t("note")} error={errors.note} optional>
            {(field) => <Input {...field} maxLength={200} {...form.register("note")} />}
          </FormField>
          <FormError error={error} />
          <LoadingButton type="submit" loading={pending}>
            {t("savePayment")}
          </LoadingButton>
        </form>
      </ResponsiveDialog>
    </>
  );
}

export function LoanMenu({ id, name, initial, lastPaymentId }: { id: string; name: string; initial: LoanInput; lastPaymentId: string | null }) {
  const t = useTranslations("care.money.loan");
  const te = useTranslations("errors");
  const [edit, setEdit] = useState(false);
  const [, startTransition] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: ErrorKey }>) =>
    startTransition(async () => {
      const result = await fn();
      if (!result.ok && result.error) toast.error(te(result.error));
    });
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={t("menu", { name })}>
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEdit(true)}>{t("edit")}</DropdownMenuItem>
          {lastPaymentId && <DropdownMenuItem onSelect={() => run(() => deleteLoanPayment(lastPaymentId))}>{t("undoPayment")}</DropdownMenuItem>}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => run(() => deleteLoan(id))}>
            <Trash2 className="size-4" />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ResponsiveDialog open={edit} onOpenChange={setEdit} title={t("editTitle")}>
        <LoanForm loanId={id} initial={initial} onDone={() => setEdit(false)} />
      </ResponsiveDialog>
    </>
  );
}

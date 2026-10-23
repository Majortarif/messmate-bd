"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Banknote, Check, Copy, Info, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { FormError, FormField, LoadingButton } from "@/components/shared/form";
import { ImagePicker } from "@/components/shared/image-picker";
import { ResponsiveDialog } from "@/components/shared/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { submitDeposit } from "@/lib/actions/wallet";
import { toErrorKey, type ErrorKey } from "@/lib/errors";
import { formatTaka } from "@/lib/format";
import { uploadImage } from "@/lib/image";
import { cn } from "@/lib/utils";
import { depositSchema, PAYMENT_METHODS } from "@/lib/validations/wallet";

export type PaymentNumbers = { bkash: string | null; nagad: string | null; rocket: string | null; note: string | null };

// Brand colours are only used as small accents for recognition.
const METHOD_STYLE: Record<(typeof PAYMENT_METHODS)[number], string> = {
  bkash: "bg-[#e2136e]",
  nagad: "bg-[#f6921e]",
  rocket: "bg-[#8c3494]",
  cash: "bg-primary",
};

const QUICK = [500, 1000, 2000, 5000];

type FormInput = z.input<typeof depositSchema>;
type FormOutput = z.output<typeof depositSchema>;

function localNow() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function AddMoneyButton({
  messId,
  userId,
  numbers,
  defaultOpen = false,
  className,
}: {
  messId: string;
  userId: string;
  numbers: PaymentNumbers;
  defaultOpen?: boolean;
  className?: string;
}) {
  const t = useTranslations("wallet.add");
  const locale = useLocale();
  const [open, setOpen] = useState(defaultOpen);
  const [proof, setProof] = useState<File | null>(null);
  const [error, setError] = useState<ErrorKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(depositSchema),
    defaultValues: { method: "bkash", amount: "", trxId: "", senderNumber: "", paidAt: localNow(), note: "" },
  });
  const method = useWatch({ control: form.control, name: "method" });
  const isCash = method === "cash";
  const number = isCash ? null : numbers[method];
  const { errors } = form.formState;

  const close = () => {
    setOpen(false);
    setProof(null);
    setError(null);
    form.reset({ method: "bkash", amount: "", trxId: "", senderNumber: "", paidAt: localNow(), note: "" });
  };

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      setError(null);
      try {
        const proofPath = proof ? await uploadImage("deposit-proofs", `${messId}/${userId}`, proof) : undefined;
        const result = await submitDeposit({
          ...values,
          paidAt: values.paidAt ? new Date(values.paidAt).toISOString() : undefined,
          proofPath,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast.success(t("sent"), { description: t("sentBody") });
        close();
      } catch (e) {
        setError(toErrorKey(e));
      }
    }),
  );

  return (
    <>
      <Button onClick={() => setOpen(true)} className={className}>
        <Plus className="size-4" aria-hidden="true" />
        {t("button")}
      </Button>
      <ResponsiveDialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())} title={t("title")} description={t("subtitle")}>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <p className="flex gap-2 rounded-xl border border-sky/30 bg-sky-soft px-3 py-2.5 text-xs leading-relaxed">
            <Info className="mt-0.5 size-4 shrink-0 text-sky" aria-hidden="true" />
            {t("manualNotice")}
          </p>

          <Controller
            control={form.control}
            name="method"
            render={({ field }) => (
              <RadioGroup value={field.value} onValueChange={field.onChange} className="grid grid-cols-4 gap-2" aria-label={t("method")}>
                {PAYMENT_METHODS.map((m) => (
                  <label
                    key={m}
                    className={cn(
                      "flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border px-1 py-2.5 text-xs font-medium transition-colors",
                      field.value === m ? "border-primary bg-mint-soft" : "hover:bg-accent/60",
                    )}
                  >
                    <RadioGroupItem value={m} className="sr-only" />
                    <span className={cn("flex size-8 items-center justify-center rounded-lg text-white", METHOD_STYLE[m])}>
                      {m === "cash" ? <Banknote className="size-4" aria-hidden="true" /> : <span className="text-[11px] font-bold">{t(`methods.${m}`).slice(0, 1)}</span>}
                    </span>
                    {t(`methods.${m}`)}
                  </label>
                ))}
              </RadioGroup>
            )}
          />

          {!isCash && (
            <div className="rounded-xl bg-muted px-3 py-2.5 text-sm">
              {number ? (
                <div className="flex items-center justify-between gap-2">
                  <span>
                    {t("sendTo", { method: t(`methods.${method}`) })}{" "}
                    <span className="num font-semibold tracking-wide">{number}</span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("copyNumber")}
                    onClick={async () => {
                      await navigator.clipboard.writeText(number);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                  >
                    {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
                  </Button>
                </div>
              ) : (
                <span className="text-muted-foreground">{t("askManagerNumber")}</span>
              )}
              {numbers.note && <p className="mt-1 text-xs text-muted-foreground">{numbers.note}</p>}
            </div>
          )}

          <FormField label={t("amount")} error={errors.amount}>
            {(field) => (
              <div className="grid gap-2">
                <Input {...field} type="number" inputMode="decimal" min={10} step="1" placeholder="1000" {...form.register("amount")} />
                <div className="flex flex-wrap gap-1.5">
                  {QUICK.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => form.setValue("amount", q, { shouldValidate: true })}
                      className="num rounded-full border px-3 py-1 text-xs hover:border-primary/50 hover:bg-accent"
                    >
                      {formatTaka(q, locale)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </FormField>

          {!isCash && (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label={t("trxId")} hint={t("trxHint")} error={errors.trxId}>
                {(field) => (
                  <Input {...field} autoCapitalize="characters" autoComplete="off" className="font-mono uppercase" placeholder="8N7A5KX2QP" {...form.register("trxId")} />
                )}
              </FormField>
              <FormField label={t("sender")} error={errors.senderNumber} optional>
                {(field) => <Input {...field} type="tel" inputMode="tel" placeholder="01XXXXXXXXX" {...form.register("senderNumber")} />}
              </FormField>
            </div>
          )}

          <FormField label={t("paidAt")} error={errors.paidAt}>
            {(field) => <Input {...field} type="datetime-local" max={localNow()} {...form.register("paidAt")} />}
          </FormField>

          <FormField label={t("note")} error={errors.note} optional>
            {(field) => <Textarea {...field} rows={2} maxLength={300} placeholder={t("notePlaceholder")} {...form.register("note")} />}
          </FormField>

          {!isCash && <ImagePicker label={t("proof")} hint={t("proofHint")} file={proof} onChange={setProof} />}

          <FormError error={error} />
          <LoadingButton type="submit" loading={pending} className="h-11">
            {t("submit")}
          </LoadingButton>
        </form>
      </ResponsiveDialog>
    </>
  );
}

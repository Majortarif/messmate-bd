"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { BadgeCheck, Check, Copy, ImageIcon, PlusCircle, Undo2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { EmptyState } from "@/components/shared/states";
import { FormError, FormField, LoadingButton } from "@/components/shared/form";
import { ResponsiveDialog } from "@/components/shared/responsive-dialog";
import { ToneBadge } from "@/components/shared/tone-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { managerLedgerEntry, reverseLedgerEntry, reviewDeposit } from "@/lib/actions/wallet";
import type { ErrorKey } from "@/lib/errors";
import { formatDate, formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";
import { managerEntrySchema } from "@/lib/validations/wallet";
import type { Enums } from "@/types/database";

export type PendingDeposit = {
  id: string;
  amount: number;
  method: Enums<"payment_method">;
  trxId: string | null;
  sender: string | null;
  paidAt: string | null;
  note: string | null;
  proofUrl: string | null;
  createdAt: string;
  memberName: string;
  memberPhone: string | null;
  balance: number;
};

export function PendingDeposits({ items }: { items: PendingDeposit[] }) {
  const t = useTranslations("manage.approvals");
  const tm = useTranslations("wallet.add.methods");
  const te = useTranslations("errors");
  const locale = useLocale();
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<PendingDeposit | null>(null);
  const [reason, setReason] = useState("");
  const [, startTransition] = useTransition();

  const decide = (item: PendingDeposit, approve: boolean, note?: string) => {
    setBusy(item.id);
    startTransition(async () => {
      const result = await reviewDeposit({ requestId: item.id, approve, note });
      setBusy(null);
      if (!result.ok) toast.error(te(result.error));
      else toast.success(approve ? t("approved", { amount: formatTaka(item.amount, locale), name: item.memberName }) : t("rejected"));
    });
  };

  if (items.length === 0) return <EmptyState icon={BadgeCheck} title={t("empty")} body={t("emptyBody")} />;

  return (
    <>
      <ul className="grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-2xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{item.memberName}</p>
                <p className="text-xs text-muted-foreground">
                  {t("balanceNow", { amount: formatTaka(item.balance, locale) })}
                  {item.memberPhone ? ` · ${item.memberPhone}` : ""}
                </p>
              </div>
              <p className="num text-2xl font-bold text-mint">{formatTaka(item.amount, locale)}</p>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-xl bg-muted/60 p-3 text-xs">
              <dt className="text-muted-foreground">{t("method")}</dt>
              <dd>
                <ToneBadge tone="sky">{tm(item.method === "bank" ? "cash" : item.method)}</ToneBadge>
              </dd>
              {item.trxId && (
                <>
                  <dt className="text-muted-foreground">TrxID</dt>
                  <dd className="flex items-center gap-1">
                    <span className="font-mono font-semibold tracking-wide">{item.trxId}</span>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(item.trxId!).then(() => toast.success(t("copied")))}
                      className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                      aria-label={t("copyTrx")}
                    >
                      <Copy className="size-3.5" />
                    </button>
                  </dd>
                </>
              )}
              {item.sender && (
                <>
                  <dt className="text-muted-foreground">{t("sender")}</dt>
                  <dd className="num">{item.sender}</dd>
                </>
              )}
              <dt className="text-muted-foreground">{t("paidAt")}</dt>
              <dd>{formatDate(item.paidAt ?? item.createdAt, locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</dd>
            </dl>
            {item.note && <p className="mt-2 text-sm">“{item.note}”</p>}
            {item.proofUrl && (
              <a
                href={item.proofUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <ImageIcon className="size-4" aria-hidden="true" />
                {t("viewProof")}
              </a>
            )}
            <p className="mt-3 text-[11px] text-muted-foreground">{t("checkHint")}</p>
            <div className="mt-3 flex gap-2">
              <Button className="flex-1" disabled={busy === item.id} onClick={() => decide(item, true)}>
                <Check className="size-4" aria-hidden="true" />
                {t("approve")}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={busy === item.id}
                onClick={() => {
                  setReason("");
                  setRejecting(item);
                }}
              >
                <X className="size-4" aria-hidden="true" />
                {t("reject")}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <ResponsiveDialog
        open={Boolean(rejecting)}
        onOpenChange={(o) => !o && setRejecting(null)}
        title={t("rejectTitle")}
        description={t("rejectBody")}
      >
        <div className="grid gap-3">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={300} placeholder={t("rejectPlaceholder")} />
          <Button
            variant="destructive"
            onClick={() => {
              if (rejecting) decide(rejecting, false, reason.trim() || undefined);
              setRejecting(null);
            }}
          >
            {t("reject")}
          </Button>
        </div>
      </ResponsiveDialog>
    </>
  );
}

export type MemberOption = { userId: string; name: string; balance: number };
type EntryForm = z.input<typeof managerEntrySchema>;
type EntryOut = z.output<typeof managerEntrySchema>;

export function ManualEntryButton({ members }: { members: MemberOption[] }) {
  const t = useTranslations("manage.approvals.manual");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<ErrorKey | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<EntryForm, unknown, EntryOut>({
    resolver: zodResolver(managerEntrySchema),
    defaultValues: { userId: "", type: "deposit", direction: "credit", amount: "", note: "" },
  });
  const type = useWatch({ control: form.control, name: "type" });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      setError(null);
      const result = await managerLedgerEntry(values);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(t("done"));
      setOpen(false);
      form.reset();
    }),
  );

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <PlusCircle className="size-4" aria-hidden="true" />
        {t("button")}
      </Button>
      <ResponsiveDialog open={open} onOpenChange={setOpen} title={t("title")} description={t("subtitle")}>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <FormField label={t("member")} error={errors.userId}>
            {(field) => (
              <Controller
                control={form.control}
                name="userId"
                render={({ field: f }) => (
                  <Select value={f.value} onValueChange={f.onChange}>
                    <SelectTrigger id={field.id} aria-invalid={field["aria-invalid"]} className="w-full">
                      <SelectValue placeholder={t("memberPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((m) => (
                        <SelectItem key={m.userId} value={m.userId}>
                          {m.name} · {formatTaka(m.balance, locale)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <Controller
            control={form.control}
            name="type"
            render={({ field }) => (
              <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-2" aria-label={t("type")}>
                {(["deposit", "adjustment", "refund_payout"] as const).map((v) => (
                  <label
                    key={v}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-3",
                      field.value === v && "border-primary/60 bg-mint-soft",
                    )}
                  >
                    <RadioGroupItem value={v} className="mt-1" />
                    <span className="grid">
                      <span className="text-sm font-medium">{t(`types.${v}.title`)}</span>
                      <span className="text-xs text-muted-foreground">{t(`types.${v}.body`)}</span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            )}
          />
          {type === "adjustment" && (
            <Controller
              control={form.control}
              name="direction"
              render={({ field }) => (
                <RadioGroup value={field.value} onValueChange={field.onChange} className="flex gap-2">
                  {(["credit", "debit"] as const).map((d) => (
                    <label key={d} className={cn("flex flex-1 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm", field.value === d && "border-primary/60 bg-mint-soft")}>
                      <RadioGroupItem value={d} />
                      {t(`direction.${d}`)}
                    </label>
                  ))}
                </RadioGroup>
              )}
            />
          )}
          <FormField label={t("amount")} error={errors.amount}>
            {(field) => <Input {...field} type="number" inputMode="decimal" min={1} {...form.register("amount")} />}
          </FormField>
          <FormField label={t("note")} error={errors.note} optional={type !== "adjustment"}>
            {(field) => <Input {...field} maxLength={200} placeholder={t("notePlaceholder")} {...form.register("note")} />}
          </FormField>
          <FormError error={error} />
          <LoadingButton type="submit" loading={pending}>
            {t("submit")}
          </LoadingButton>
        </form>
      </ResponsiveDialog>
    </>
  );
}

export type RecentEntry = {
  id: string;
  type: Enums<"ledger_type">;
  amount: number;
  description: string | null;
  createdAt: string;
  memberName: string;
  reversible: boolean;
};

export function RecentEntries({ entries }: { entries: RecentEntry[] }) {
  const t = useTranslations("manage.approvals.recent");
  const tl = useTranslations("ledgerTypes");
  const te = useTranslations("errors");
  const locale = useLocale();
  const [target, setTarget] = useState<RecentEntry | null>(null);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <>
      <ul className="divide-y">
        {entries.map((e) => (
          <li key={e.id} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">
                <span className="font-medium">{e.memberName}</span> · {tl(e.type)}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {e.description ? `${e.description} · ` : ""}
                {formatDate(e.createdAt, locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
              </p>
            </div>
            <span className={cn("num text-sm font-semibold", e.amount > 0 ? "text-mint" : "text-coral")}>{formatTaka(e.amount, locale)}</span>
            {e.reversible && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  setReason("");
                  setTarget(e);
                }}
                aria-label={t("reverse")}
                title={t("reverse")}
              >
                <Undo2 className="size-4" />
              </Button>
            )}
          </li>
        ))}
      </ul>
      <ResponsiveDialog open={Boolean(target)} onOpenChange={(o) => !o && setTarget(null)} title={t("title")} description={t("body")}>
        <div className="grid gap-3">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={150} placeholder={t("placeholder")} aria-label={t("placeholder")} />
          <LoadingButton
            variant="destructive"
            loading={pending}
            disabled={reason.trim().length < 3}
            onClick={() =>
              startTransition(async () => {
                if (!target) return;
                const result = await reverseLedgerEntry(target.id, reason);
                if (!result.ok) toast.error(te(result.error));
                else {
                  toast.success(t("done"));
                  setTarget(null);
                }
              })
            }
          >
            {t("reverse")}
          </LoadingButton>
        </div>
      </ResponsiveDialog>
    </>
  );
}

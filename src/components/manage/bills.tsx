"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, Plus, Send, Trash2, XCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { FormError, FormField, LoadingButton } from "@/components/shared/form";
import { ResponsiveDialog } from "@/components/shared/responsive-dialog";
import { billTone, ToneBadge } from "@/components/shared/tone-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createBill, deleteBill, postBill, voidBill } from "@/lib/actions/manage";
import type { ErrorKey } from "@/lib/errors";
import { formatDate, formatNumber, formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BILL_TYPES, billSchema } from "@/lib/validations/manage";
import type { Enums } from "@/types/database";

export type BillRow = {
  id: string;
  type: Enums<"bill_type">;
  total: number;
  split: Enums<"split_mode">;
  dueDate: string | null;
  description: string | null;
  status: Enums<"bill_status">;
  voidReason: string | null;
  shares: { userId: string; name: string; amount: number }[];
};
type Member = { userId: string; name: string };
type FormIn = z.input<typeof billSchema>;
type FormOut = z.output<typeof billSchema>;

function CreateBill({ messId, month, roomRentTotal }: { messId: string; month: string; roomRentTotal: number }) {
  const t = useTranslations("manage.bills");
  const tb = useTranslations("billTypes");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<ErrorKey | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(billSchema),
    defaultValues: { billType: "wifi", splitMode: "equal", totalAmount: "", dueDate: "", description: "" },
  });
  const split = useWatch({ control: form.control, name: "splitMode" });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      setError(null);
      const result = await createBill(messId, month, values);
      if (!result.ok) return setError(result.error);
      toast.success(t("created"));
      setOpen(false);
      form.reset();
    }),
  );

  return (
    <>
      <Button onClick={() => setOpen(true)} className="w-full sm:w-fit">
        <Plus className="size-4" aria-hidden="true" />
        {t("add")}
      </Button>
      <ResponsiveDialog open={open} onOpenChange={setOpen} title={t("addTitle")} description={t("addBody")}>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <FormField label={t("type")} error={errors.billType}>
            {(field) => (
              <Controller
                control={form.control}
                name="billType"
                render={({ field: f }) => (
                  <Select value={f.value} onValueChange={f.onChange}>
                    <SelectTrigger id={field.id} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BILL_TYPES.map((b) => (
                        <SelectItem key={b} value={b}>
                          {tb(b)}
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
            name="splitMode"
            render={({ field }) => (
              <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-2" aria-label={t("split")}>
                {(["equal", "by_room", "custom"] as const).map((v) => (
                  <label key={v} className={cn("flex cursor-pointer items-start gap-2.5 rounded-xl border p-3", field.value === v && "border-primary/60 bg-mint-soft")}>
                    <RadioGroupItem value={v} className="mt-1" />
                    <span className="grid">
                      <span className="text-sm font-medium">{t(`splits.${v}.title`)}</span>
                      <span className="text-xs text-muted-foreground">
                        {v === "by_room" ? t("splits.by_room.body", { total: formatTaka(roomRentTotal, locale) }) : t(`splits.${v}.body`)}
                      </span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            )}
          />
          {split !== "by_room" && (
            <FormField label={t("amount")} error={errors.totalAmount}>
              {(field) => <Input {...field} type="number" inputMode="decimal" min={1} {...form.register("totalAmount")} />}
            </FormField>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t("dueDate")} error={errors.dueDate} optional>
              {(field) => <Input {...field} type="date" {...form.register("dueDate")} />}
            </FormField>
            <FormField label={t("description")} error={errors.description} optional>
              {(field) => <Input {...field} maxLength={300} placeholder={t("descriptionPlaceholder")} {...form.register("description")} />}
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

function CustomSplit({ bill, members, onClose }: { bill: BillRow; members: Member[]; onClose: () => void }) {
  const t = useTranslations("manage.bills");
  const te = useTranslations("errors");
  const locale = useLocale();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const sum = Object.values(amounts).reduce((s, v) => s + (Number(v) || 0), 0);
  const matches = Math.abs(sum - bill.total) < 0.01;

  const splitEqually = () => {
    const cents = Math.round(bill.total * 100);
    const base = Math.floor(cents / members.length);
    const rem = cents - base * members.length;
    setAmounts(Object.fromEntries(members.map((m, i) => [m.userId, ((base + (i < rem ? 1 : 0)) / 100).toFixed(2)])));
  };

  return (
    <ResponsiveDialog open onOpenChange={(o) => !o && onClose()} title={t("customTitle")} description={t("customBody", { total: formatTaka(bill.total, locale) })}>
      <div className="grid gap-3">
        <Button variant="outline" size="sm" onClick={splitEqually} className="w-fit">
          {t("splitEqually")}
        </Button>
        <ul className="grid gap-2">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center justify-between gap-3">
              <span className="truncate text-sm">{m.name}</span>
              <Input
                value={amounts[m.userId] ?? ""}
                onChange={(e) => setAmounts((a) => ({ ...a, [m.userId]: e.target.value.replace(/[^\d.]/g, "") }))}
                inputMode="decimal"
                placeholder="0"
                className="num h-9 w-28"
                aria-label={m.name}
              />
            </li>
          ))}
        </ul>
        <p className={cn("num text-sm font-medium", matches ? "text-mint" : "text-coral")}>
          {t("customSum", { sum: formatTaka(sum, locale), total: formatTaka(bill.total, locale) })}
        </p>
        <LoadingButton
          loading={pending}
          disabled={!matches}
          onClick={() =>
            startTransition(async () => {
              const custom = members
                .map((m) => ({ user_id: m.userId, amount: Math.round((Number(amounts[m.userId]) || 0) * 100) / 100 }))
                .filter((s) => s.amount > 0);
              const result = await postBill(bill.id, custom);
              if (!result.ok) toast.error(te(result.error));
              else {
                toast.success(t("posted"));
                onClose();
              }
            })
          }
        >
          <Send className="size-4" aria-hidden="true" />
          {t("post")}
        </LoadingButton>
      </div>
    </ResponsiveDialog>
  );
}

export function BillManager({
  messId,
  month,
  bills,
  members,
  roomRentTotal,
  closed,
}: {
  messId: string;
  month: string;
  bills: BillRow[];
  members: Member[];
  roomRentTotal: number;
  closed: boolean;
}) {
  const t = useTranslations("manage.bills");
  const tb = useTranslations("billTypes");
  const te = useTranslations("errors");
  const locale = useLocale();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [custom, setCustom] = useState<BillRow | null>(null);
  const [voiding, setVoiding] = useState<BillRow | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const run = (id: string, fn: () => Promise<{ ok: boolean; error?: ErrorKey }>, success: string) => {
    setBusy(id);
    startTransition(async () => {
      const result = await fn();
      setBusy(null);
      if (!result.ok && result.error) toast.error(te(result.error));
      else toast.success(success);
    });
  };

  return (
    <div className="grid gap-3">
      {!closed && <CreateBill messId={messId} month={month} roomRentTotal={roomRentTotal} />}
      {bills.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="grid gap-3">
          {bills.map((b) => (
            <li key={b.id} className="rounded-2xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 font-semibold">
                    {tb(b.type)}
                    <ToneBadge tone={billTone[b.status]}>{t(`status.${b.status}`)}</ToneBadge>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t(`splits.${b.split}.title`)}
                    {b.dueDate ? ` · ${t("due", { date: formatDate(b.dueDate, locale) })}` : ""}
                    {b.description ? ` · ${b.description}` : ""}
                  </p>
                  {b.status === "void" && b.voidReason && <p className="mt-1 text-xs text-coral">{b.voidReason}</p>}
                </div>
                <p className={cn("num text-xl font-bold", b.status === "void" && "text-muted-foreground line-through")}>
                  {b.split === "by_room" && b.status === "draft" ? formatTaka(roomRentTotal, locale) : formatTaka(b.total, locale)}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {b.status === "draft" && !closed && (
                  <>
                    <Button
                      size="sm"
                      disabled={busy === b.id}
                      onClick={() =>
                        b.split === "custom"
                          ? setCustom(b)
                          : run(b.id, () => postBill(b.id), t("posted"))
                      }
                    >
                      <Send className="size-4" aria-hidden="true" />
                      {b.split === "custom" ? t("splitAndPost") : t("postTo", { count: formatNumber(members.length, locale) })}
                    </Button>
                    <Button size="sm" variant="ghost" disabled={busy === b.id} onClick={() => run(b.id, () => deleteBill(b.id), t("deleted"))}>
                      <Trash2 className="size-4 text-coral" aria-hidden="true" />
                      {t("delete")}
                    </Button>
                  </>
                )}
                {b.status === "posted" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setExpanded(expanded === b.id ? null : b.id)} aria-expanded={expanded === b.id}>
                      <ChevronDown className={cn("size-4 transition-transform", expanded === b.id && "rotate-180")} aria-hidden="true" />
                      {t("shares", { count: formatNumber(b.shares.length, locale) })}
                    </Button>
                    {!closed && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setReason("");
                          setVoiding(b);
                        }}
                      >
                        <XCircle className="size-4 text-coral" aria-hidden="true" />
                        {t("void")}
                      </Button>
                    )}
                  </>
                )}
              </div>
              {expanded === b.id && (
                <ul className="mt-3 divide-y rounded-xl border">
                  {b.shares.map((s) => (
                    <li key={s.userId} className="flex justify-between px-3 py-2 text-sm">
                      <span>{s.name}</span>
                      <span className="num">{formatTaka(s.amount, locale)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      {custom && <CustomSplit bill={custom} members={members} onClose={() => setCustom(null)} />}
      <ResponsiveDialog open={Boolean(voiding)} onOpenChange={(o) => !o && setVoiding(null)} title={t("voidTitle")} description={t("voidBody")}>
        <div className="grid gap-3">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder={t("voidPlaceholder")} aria-label={t("voidPlaceholder")} />
          <Button
            variant="destructive"
            disabled={reason.trim().length < 3}
            onClick={() => {
              if (voiding) run(voiding.id, () => voidBill(voiding.id, reason), t("voided"));
              setVoiding(null);
            }}
          >
            {t("void")}
          </Button>
        </div>
      </ResponsiveDialog>
    </div>
  );
}

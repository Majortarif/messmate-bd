"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Lock, MoreVertical, Plus, Trash2, Users, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { FormError, FormField, LoadingButton } from "@/components/shared/form";
import { ResponsiveDialog } from "@/components/shared/responsive-dialog";
import { ToneBadge } from "@/components/shared/tone-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { castVote, closePoll, createPoll, deletePoll } from "@/lib/actions/mess";
import type { ErrorKey } from "@/lib/errors";
import { formatDate, formatNumber, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { type PollInput, pollSchema } from "@/lib/validations/mess-life";
import type { MessPoll } from "@/types/app";

// ------------------------------------------------------------------ create ---
export function NewPollButton() {
  const t = useTranslations("mess.polls.form");
  const tp = useTranslations("mess.polls");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(null);
  const form = useForm<PollInput, unknown, z.output<typeof pollSchema>>({
    resolver: zodResolver(pollSchema),
    defaultValues: { question: "", description: "", options: [{ label: "" }, { label: "" }], allowMultiple: false, isAnonymous: false, closesAt: "" },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "options" });
  const { errors } = form.formState;

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden="true" />
        {tp("new")}
      </Button>
      <ResponsiveDialog open={open} onOpenChange={setOpen} title={tp("newTitle")} description={tp("newBody")}>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={form.handleSubmit(() =>
            startTransition(async () => {
              setError(null);
              const result = await createPoll(form.getValues());
              if (!result.ok) return setError(result.error);
              toast.success(t("created"));
              form.reset();
              setOpen(false);
            }),
          )}
        >
          <FormField label={t("question")} error={errors.question}>
            {(field) => <Input {...field} maxLength={200} placeholder={t("questionPlaceholder")} {...form.register("question")} />}
          </FormField>
          <div className="grid gap-2">
            <p className="text-[0.9rem] font-medium">{t("options")}</p>
            {fields.map((f, i) => (
              <div key={f.id} className="flex gap-2">
                <Input maxLength={100} placeholder={t("optionPlaceholder", { n: i + 1 })} aria-label={t("optionPlaceholder", { n: i + 1 })} {...form.register(`options.${i}.label`)} />
                {fields.length > 2 && (
                  <Button type="button" variant="ghost" size="icon" aria-label={t("removeOption")} onClick={() => remove(i)}>
                    <X className="size-4" />
                  </Button>
                )}
              </div>
            ))}
            {errors.options?.root?.message || errors.options?.message ? (
              <p role="alert" className="text-[0.8rem] text-destructive">
                {t("optionsError")}
              </p>
            ) : null}
            {fields.length < 10 && (
              <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => append({ label: "" })}>
                <Plus className="size-4" aria-hidden="true" />
                {t("addOption")}
              </Button>
            )}
          </div>
          <FormField label={t("description")} error={errors.description} optional>
            {(field) => <Textarea {...field} rows={2} maxLength={1000} {...form.register("description")} />}
          </FormField>
          <FormField label={t("closesAt")} hint={t("closesAtHint")} error={errors.closesAt} optional>
            {(field) => <Input {...field} type="datetime-local" {...form.register("closesAt")} />}
          </FormField>
          <div className="grid gap-2 sm:grid-cols-2">
            <Controller
              control={form.control}
              name="allowMultiple"
              render={({ field }) => (
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2.5">
                  <span className="text-sm font-medium">{t("multiple")}</span>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </label>
              )}
            />
            <Controller
              control={form.control}
              name="isAnonymous"
              render={({ field }) => (
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2.5">
                  <span className="text-sm font-medium">{t("anonymous")}</span>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </label>
              )}
            />
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

// -------------------------------------------------------------------- card ---
export function PollCard({ poll, canManage }: { poll: MessPoll; canManage: boolean }) {
  const t = useTranslations("mess.polls");
  const te = useTranslations("errors");
  const locale = useLocale();
  const myChoice = poll.options.filter((o) => o.mine).map((o) => o.id);
  const voted = myChoice.length > 0;
  const [changing, setChanging] = useState(false);
  const [selected, setSelected] = useState<string[]>(myChoice);
  const [pending, startTransition] = useTransition();
  const showResults = poll.is_closed || (voted && !changing);
  const total = poll.options.reduce((s, o) => s + o.votes, 0);
  const top = Math.max(0, ...poll.options.map((o) => o.votes));

  const toggle = (id: string) =>
    setSelected((s) => (poll.allow_multiple ? (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]) : [id]));

  const submit = () =>
    startTransition(async () => {
      const result = await castVote(poll.id, selected);
      if (!result.ok) return void toast.error(te(result.error));
      toast.success(t("voted"));
      setChanging(false);
    });

  return (
    <article className="rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {poll.is_closed ? (
              <ToneBadge tone="muted">
                <Lock className="size-3" aria-hidden="true" />
                {t("closed")}
              </ToneBadge>
            ) : (
              <ToneBadge tone="mint">{t("open")}</ToneBadge>
            )}
            {poll.allow_multiple && <ToneBadge tone="sky">{t("multipleBadge")}</ToneBadge>}
            {poll.is_anonymous && <ToneBadge tone="muted">{t("anonymousBadge")}</ToneBadge>}
          </div>
          <h2 className="mt-1.5 font-semibold leading-snug">{poll.question}</h2>
          {poll.description && <p className="mt-1 text-sm text-muted-foreground">{poll.description}</p>}
        </div>
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={t("menu", { question: poll.question })}>
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!poll.is_closed && (
                <DropdownMenuItem
                  onSelect={() =>
                    startTransition(async () => {
                      const result = await closePoll(poll.id);
                      if (!result.ok) toast.error(te(result.error));
                    })
                  }
                >
                  <Lock className="size-4" />
                  {t("close")}
                </DropdownMenuItem>
              )}
              {!poll.is_closed && <DropdownMenuSeparator />}
              <DropdownMenuItem
                variant="destructive"
                onSelect={() =>
                  startTransition(async () => {
                    const result = await deletePoll(poll.id);
                    if (!result.ok) toast.error(te(result.error));
                  })
                }
              >
                <Trash2 className="size-4" />
                {t("delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {showResults ? (
        <ul className="mt-3 grid gap-2">
          {poll.options.map((o) => {
            const pct = total ? Math.round((o.votes / total) * 100) : 0;
            return (
              <li key={o.id} className="relative overflow-hidden rounded-xl border px-3 py-2.5">
                <div
                  className={cn("absolute inset-y-0 left-0 transition-[width] duration-700", o.votes === top && top > 0 ? "bg-mint-soft" : "bg-muted/70")}
                  style={{ width: `${pct}%` }}
                  aria-hidden="true"
                />
                <div className="relative flex items-center gap-2 text-sm">
                  {o.mine && <Check className="size-4 shrink-0 text-mint" aria-label={t("yourChoice")} />}
                  <span className="min-w-0 flex-1 font-medium">{o.label}</span>
                  <span className="num shrink-0 text-muted-foreground">
                    {formatNumber(pct, locale)}% · {t("votes", { count: o.votes })}
                  </span>
                </div>
                {!poll.is_anonymous && o.names.length > 0 && (
                  <p className="relative mt-0.5 truncate text-xs text-muted-foreground">{o.names.join(", ")}</p>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <fieldset className="mt-3 grid gap-2">
          <legend className="sr-only">{poll.question}</legend>
          {poll.options.map((o) => {
            const on = selected.includes(o.id);
            return (
              <label
                key={o.id}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 text-sm transition-colors",
                  on ? "border-primary/60 bg-mint-soft" : "hover:bg-accent",
                )}
              >
                {poll.allow_multiple ? (
                  <Checkbox checked={on} onCheckedChange={() => toggle(o.id)} />
                ) : (
                  <input type="radio" name={`poll-${poll.id}`} checked={on} onChange={() => toggle(o.id)} className="size-4 accent-[var(--primary)]" />
                )}
                {o.label}
              </label>
            );
          })}
        </fieldset>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="size-3.5" aria-hidden="true" />
          {t("voters", { count: poll.voters })} · {t("by", { name: poll.creator_name })}
          {poll.closes_at &&
            !poll.is_closed &&
            ` · ${t("closesAt", { date: `${formatDate(poll.closes_at, locale, { day: "numeric", month: "short" })} ${formatTime(poll.closes_at, locale)}` })}`}
        </p>
        {!poll.is_closed &&
          (showResults ? (
            <Button variant="ghost" size="sm" onClick={() => setChanging(true)}>
              {t("changeVote")}
            </Button>
          ) : (
            <div className="flex gap-2">
              {voted && (
                <Button variant="ghost" size="sm" onClick={() => setChanging(false)}>
                  {t("cancel")}
                </Button>
              )}
              <LoadingButton size="sm" loading={pending} disabled={selected.length === 0} onClick={submit}>
                {t("vote")}
              </LoadingButton>
            </div>
          ))}
      </div>
    </article>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarPlus, Check, MoreVertical, SkipForward, Trash2, Undo2, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { FormError, FormField, LoadingButton } from "@/components/shared/form";
import { ResponsiveDialog } from "@/components/shared/responsive-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deleteChore, generateRoster, reassignChore, setChoreStatus } from "@/lib/actions/mess";
import type { ErrorKey } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { CHORE_TYPES, type RosterInput, rosterSchema } from "@/lib/validations/mess-life";

export type RosterMember = { id: string; name: string };

/** Manager: round-robin roster for one kind of duty. */
export function RosterGenerator({ members, today }: { members: RosterMember[]; today: string }) {
  const t = useTranslations("mess.roster.form");
  const tr = useTranslations("mess.roster");
  const tc = useTranslations("choreTypes");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(null);
  const form = useForm<RosterInput, unknown, z.output<typeof rosterSchema>>({
    resolver: zodResolver(rosterSchema),
    defaultValues: { choreType: "bazar", title: "", start: today, days: 14, everyDays: 1, userIds: members.map((m) => m.id) },
  });
  const { errors } = form.formState;

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <CalendarPlus className="size-4" aria-hidden="true" />
        {tr("generate")}
      </Button>
      <ResponsiveDialog open={open} onOpenChange={setOpen} title={tr("generateTitle")} description={tr("generateBody")}>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={form.handleSubmit(() =>
            startTransition(async () => {
              setError(null);
              const result = await generateRoster(form.getValues());
              if (!result.ok) return setError(result.error);
              toast.success(t("created", { count: result.data.count }));
              setOpen(false);
            }),
          )}
        >
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t("type")} error={errors.choreType}>
              {(field) => (
                <Controller
                  control={form.control}
                  name="choreType"
                  render={({ field: f }) => (
                    <Select
                      value={f.value}
                      onValueChange={(v) => {
                        f.onChange(v);
                        if (!form.getValues("title")) form.setValue("title", tc(v as (typeof CHORE_TYPES)[number]));
                      }}
                    >
                      <SelectTrigger id={field.id} className="h-11 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CHORE_TYPES.map((c) => (
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
            <FormField label={t("title")} error={errors.title}>
              {(field) => <Input {...field} maxLength={100} placeholder={t("titlePlaceholder")} {...form.register("title")} />}
            </FormField>
            <FormField label={t("start")} error={errors.start}>
              {(field) => <Input {...field} type="date" min={today} {...form.register("start")} />}
            </FormField>
            <div className="grid grid-cols-2 gap-2">
              <FormField label={t("days")} error={errors.days}>
                {(field) => <Input {...field} type="number" inputMode="numeric" min={1} max={62} {...form.register("days")} />}
              </FormField>
              <FormField label={t("every")} error={errors.everyDays}>
                {(field) => <Input {...field} type="number" inputMode="numeric" min={1} max={31} {...form.register("everyDays")} />}
              </FormField>
            </div>
          </div>
          <div className="grid gap-1.5">
            <p className="text-[0.9rem] font-medium">{t("members")}</p>
            <p className="text-[0.8rem] text-muted-foreground">{t("membersHint")}</p>
            <Controller
              control={form.control}
              name="userIds"
              render={({ field }) => (
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {members.map((m) => {
                    const position = field.value.indexOf(m.id);
                    const on = position >= 0;
                    return (
                      <li key={m.id}>
                        <button
                          type="button"
                          aria-pressed={on}
                          onClick={() => field.onChange(on ? field.value.filter((x) => x !== m.id) : [...field.value, m.id])}
                          className={cn(
                            "flex min-h-11 w-full items-center gap-2.5 rounded-xl border px-3 text-left text-sm transition-colors",
                            on ? "border-primary/50 bg-mint-soft" : "text-muted-foreground hover:bg-accent",
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                              on ? "bg-primary text-primary-foreground" : "bg-muted",
                            )}
                          >
                            {on ? position + 1 : ""}
                          </span>
                          <span className="truncate">{m.name}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            />
            {errors.userIds && (
              <p role="alert" className="text-[0.8rem] text-destructive">
                {t("pickMembers")}
              </p>
            )}
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

/** Buttons on one duty: the assignee ticks it off / skips; the manager can also reassign or delete. */
export function ChoreActions({
  id,
  title,
  status,
  isAssignee,
  isManager,
  members,
}: {
  id: string;
  title: string;
  status: "pending" | "done" | "skipped";
  isAssignee: boolean;
  isManager: boolean;
  members: RosterMember[];
}) {
  const t = useTranslations("mess.roster");
  const te = useTranslations("errors");
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: ErrorKey }>, success?: string) =>
    startTransition(async () => {
      const result = await fn();
      if (!result.ok && result.error) toast.error(te(result.error));
      else if (success) toast.success(success);
    });

  return (
    <div className="flex shrink-0 items-center gap-1">
      {(isAssignee || isManager) &&
        (status === "pending" ? (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setChoreStatus(id, "done"), t("doneToast"))}>
            <Check className="size-4" aria-hidden="true" />
            {t("markDone")}
          </Button>
        ) : (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setChoreStatus(id, "pending"))}>
            <Undo2 className="size-4" aria-hidden="true" />
            {t("undo")}
          </Button>
        ))}
      {(isAssignee || isManager) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" disabled={pending} aria-label={t("menu", { title })}>
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {status === "pending" && (
              <DropdownMenuItem onSelect={() => run(() => setChoreStatus(id, "skipped"))}>
                <SkipForward className="size-4" />
                {t("skip")}
              </DropdownMenuItem>
            )}
            {isManager && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">{t("giveTo")}</DropdownMenuLabel>
                {members.map((m) => (
                  <DropdownMenuItem key={m.id} onSelect={() => run(() => reassignChore(id, m.id), t("reassigned", { name: m.name }))}>
                    <UserRound className="size-4" />
                    {m.name}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => run(() => deleteChore(id))}>
                  <Trash2 className="size-4" />
                  {t("delete")}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

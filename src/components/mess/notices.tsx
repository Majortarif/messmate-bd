"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MoreVertical, Pencil, Pin, PinOff, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { deleteNotice, saveNotice, setNoticePinned } from "@/lib/actions/mess";
import type { ErrorKey } from "@/lib/errors";
import { type NoticeInput, noticeSchema, PRIORITIES } from "@/lib/validations/mess-life";

const EMPTY: NoticeInput = { title: "", body: "", priority: "normal", isPinned: false, expiresOn: "" };

function NoticeForm({ noticeId, initial, onDone }: { noticeId?: string; initial: NoticeInput; onDone: () => void }) {
  const t = useTranslations("mess.notices.form");
  const tp = useTranslations("priorities");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(null);
  const form = useForm<NoticeInput, unknown, z.output<typeof noticeSchema>>({ resolver: zodResolver(noticeSchema), defaultValues: initial });
  const { errors } = form.formState;

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={form.handleSubmit(() =>
        startTransition(async () => {
          setError(null);
          const result = await saveNotice(form.getValues(), noticeId);
          if (!result.ok) return setError(result.error);
          toast.success(noticeId ? t("updated") : t("posted"));
          onDone();
        }),
      )}
    >
      <FormField label={t("title")} error={errors.title}>
        {(field) => <Input {...field} maxLength={120} placeholder={t("titlePlaceholder")} {...form.register("title")} />}
      </FormField>
      <FormField label={t("body")} error={errors.body}>
        {(field) => <Textarea {...field} rows={5} maxLength={3000} placeholder={t("bodyPlaceholder")} {...form.register("body")} />}
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label={t("priority")} hint={t("priorityHint")} error={errors.priority}>
          {(field) => (
            <Controller
              control={form.control}
              name="priority"
              render={({ field: f }) => (
                <Select value={f.value} onValueChange={f.onChange}>
                  <SelectTrigger id={field.id} className="h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {tp(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </FormField>
        <FormField label={t("expires")} hint={t("expiresHint")} error={errors.expiresOn} optional>
          {(field) => <Input {...field} type="date" {...form.register("expiresOn")} />}
        </FormField>
      </div>
      <Controller
        control={form.control}
        name="isPinned"
        render={({ field }) => (
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2.5">
            <span className="text-sm font-medium">{t("pin")}</span>
            <Switch checked={field.value} onCheckedChange={field.onChange} />
          </label>
        )}
      />
      <FormError error={error} />
      <LoadingButton type="submit" loading={pending}>
        {noticeId ? t("save") : t("post")}
      </LoadingButton>
    </form>
  );
}

export function NewNoticeButton() {
  const t = useTranslations("mess.notices");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden="true" />
        {t("new")}
      </Button>
      <ResponsiveDialog open={open} onOpenChange={setOpen} title={t("newTitle")} description={t("newBody")}>
        <NoticeForm initial={EMPTY} onDone={() => setOpen(false)} />
      </ResponsiveDialog>
    </>
  );
}

export function NoticeMenu({ id, title, initial }: { id: string; title: string; initial: NoticeInput }) {
  const t = useTranslations("mess.notices");
  const te = useTranslations("errors");
  const [edit, setEdit] = useState(false);
  const [, startTransition] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: ErrorKey }>, success: string) =>
    startTransition(async () => {
      const result = await fn();
      if (!result.ok && result.error) toast.error(te(result.error));
      else toast.success(success);
    });
  return (
    <>
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
          <DropdownMenuItem onSelect={() => run(() => setNoticePinned(id, !initial.isPinned), initial.isPinned ? t("unpinned") : t("pinned"))}>
            {initial.isPinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
            {initial.isPinned ? t("unpin") : t("pin")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => run(() => deleteNotice(id), t("deleted"))}>
            <Trash2 className="size-4" />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ResponsiveDialog open={edit} onOpenChange={setEdit} title={t("editTitle")}>
        <NoticeForm noticeId={id} initial={initial} onDone={() => setEdit(false)} />
      </ResponsiveDialog>
    </>
  );
}

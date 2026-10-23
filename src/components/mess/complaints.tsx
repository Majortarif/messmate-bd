"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MessageCircle, MoreVertical, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { FormError, FormField, LoadingButton } from "@/components/shared/form";
import { ImagePicker } from "@/components/shared/image-picker";
import { ResponsiveDialog } from "@/components/shared/responsive-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { deleteComplaint, replyToComplaint, saveComplaint } from "@/lib/actions/mess";
import { type ErrorKey, toErrorKey } from "@/lib/errors";
import { formatDate, formatTime } from "@/lib/format";
import { uploadImage } from "@/lib/image";
import { cn } from "@/lib/utils";
import { COMPLAINT_CATEGORIES, COMPLAINT_STATUSES, type ComplaintInput, complaintSchema } from "@/lib/validations/mess-life";

const EMPTY: ComplaintInput = { category: "wifi", title: "", description: "", priority: "normal" };

function ComplaintForm({
  messId,
  userId,
  complaintId,
  initial,
  isManager,
  onDone,
}: {
  messId: string;
  userId: string;
  complaintId?: string;
  initial: ComplaintInput;
  isManager: boolean;
  onDone: () => void;
}) {
  const t = useTranslations("mess.complaints.form");
  const tc = useTranslations("complaintCategories");
  const tp = useTranslations("priorities");
  const te = useTranslations("errors");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const form = useForm<ComplaintInput, unknown, z.output<typeof complaintSchema>>({ resolver: zodResolver(complaintSchema), defaultValues: initial });
  const { errors } = form.formState;
  const priorities = isManager ? (["low", "normal", "high", "urgent"] as const) : (["low", "normal", "high"] as const);

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={form.handleSubmit(() =>
        startTransition(async () => {
          setError(null);
          let photoPath: string | undefined;
          if (photo) {
            try {
              photoPath = await uploadImage("complaint-photos", `${messId}/${userId}`, photo);
            } catch (e) {
              return void toast.error(te(toErrorKey(e)));
            }
          }
          const result = await saveComplaint({ ...form.getValues(), ...(photoPath ? { photoPath } : {}) }, complaintId);
          if (!result.ok) return setError(result.error);
          toast.success(complaintId ? t("updated") : t("sent"));
          onDone();
        }),
      )}
    >
      <div className="grid grid-cols-2 gap-4">
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
                    {COMPLAINT_CATEGORIES.map((c) => (
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
        <FormField label={t("priority")} error={errors.priority}>
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
                    {priorities.map((p) => (
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
      </div>
      <FormField label={t("title")} error={errors.title}>
        {(field) => <Input {...field} maxLength={120} placeholder={t("titlePlaceholder")} {...form.register("title")} />}
      </FormField>
      <FormField label={t("description")} error={errors.description} optional>
        {(field) => <Textarea {...field} rows={4} maxLength={2000} placeholder={t("descriptionPlaceholder")} {...form.register("description")} />}
      </FormField>
      <ImagePicker label={t("photo")} hint={t("photoHint")} file={photo} onChange={setPhoto} />
      <FormError error={error} />
      <LoadingButton type="submit" loading={pending}>
        {complaintId ? t("save") : t("send")}
      </LoadingButton>
    </form>
  );
}

export function NewComplaintButton({ messId, userId, isManager }: { messId: string; userId: string; isManager: boolean }) {
  const t = useTranslations("mess.complaints");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden="true" />
        {t("new")}
      </Button>
      <ResponsiveDialog open={open} onOpenChange={setOpen} title={t("newTitle")} description={t("newBody")}>
        <ComplaintForm messId={messId} userId={userId} initial={EMPTY} isManager={isManager} onDone={() => setOpen(false)} />
      </ResponsiveDialog>
    </>
  );
}

/** Author's menu while the complaint is still open (managers can always delete). */
export function ComplaintMenu({
  id,
  title,
  messId,
  userId,
  initial,
  canEdit,
  isManager,
}: {
  id: string;
  title: string;
  messId: string;
  userId: string;
  initial: ComplaintInput;
  canEdit: boolean;
  isManager: boolean;
}) {
  const t = useTranslations("mess.complaints");
  const te = useTranslations("errors");
  const [edit, setEdit] = useState(false);
  const [, startTransition] = useTransition();
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={t("menu", { title })}>
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canEdit && (
            <DropdownMenuItem onSelect={() => setEdit(true)}>
              <Pencil className="size-4" />
              {t("edit")}
            </DropdownMenuItem>
          )}
          {canEdit && <DropdownMenuSeparator />}
          <DropdownMenuItem
            variant="destructive"
            onSelect={() =>
              startTransition(async () => {
                const result = await deleteComplaint(id);
                if (!result.ok) toast.error(te(result.error));
                else toast.success(t("deleted"));
              })
            }
          >
            <Trash2 className="size-4" />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ResponsiveDialog open={edit} onOpenChange={setEdit} title={t("editTitle")}>
        <ComplaintForm messId={messId} userId={userId} complaintId={id} initial={initial} isManager={isManager} onDone={() => setEdit(false)} />
      </ResponsiveDialog>
    </>
  );
}

export type ComplaintUpdate = { id: string; author: string; message: string; statusChange: string | null; createdAt: string; mine: boolean };

/** Replies under a complaint; the manager can move its status along with a note. */
export function ComplaintThread({
  complaintId,
  status,
  updates,
  isManager,
}: {
  complaintId: string;
  status: (typeof COMPLAINT_STATUSES)[number];
  updates: ComplaintUpdate[];
  isManager: boolean;
}) {
  const t = useTranslations("mess.complaints");
  const ts = useTranslations("complaintStatus");
  const te = useTranslations("errors");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [next, setNext] = useState<string>("keep");
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-3 border-t pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <MessageCircle className="size-4" aria-hidden="true" />
        {updates.length > 0 ? t("replies", { count: updates.length }) : t("reply")}
      </button>
      {open && (
        <div className="mt-2 grid gap-3">
          {updates.length > 0 && (
            <ol className="grid gap-2">
              {updates.map((u) => (
                <li key={u.id} className={cn("rounded-xl px-3 py-2 text-sm", u.mine ? "bg-mint-soft" : "bg-muted/60")}>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{u.author}</span> · {formatDate(u.createdAt, locale, { day: "numeric", month: "short" })},{" "}
                    {formatTime(u.createdAt, locale)}
                    {u.statusChange && ` · ${t("movedTo", { status: ts(u.statusChange as "open") })}`}
                  </p>
                  <p className="mt-0.5 whitespace-pre-line">{u.message}</p>
                </li>
              ))}
            </ol>
          )}
          <form
            className="grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!message.trim()) return;
              startTransition(async () => {
                const result = await replyToComplaint({
                  complaintId,
                  message,
                  statusChange: next === "keep" ? null : (next as (typeof COMPLAINT_STATUSES)[number]),
                });
                if (!result.ok) return void toast.error(te(result.error));
                setMessage("");
                setNext("keep");
              });
            }}
          >
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} maxLength={1000} placeholder={t("replyPlaceholder")} aria-label={t("reply")} />
            <div className="flex flex-wrap gap-2">
              {isManager && (
                <Select value={next} onValueChange={setNext}>
                  <SelectTrigger className="h-10 w-48" aria-label={t("statusLabel")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="keep">{t("keepStatus", { status: ts(status) })}</SelectItem>
                    {COMPLAINT_STATUSES.filter((s) => s !== status).map((s) => (
                      <SelectItem key={s} value={s}>
                        {t("markAs", { status: ts(s) })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <LoadingButton type="submit" loading={pending} disabled={!message.trim()} className="h-10">
                <Send className="size-4" aria-hidden="true" />
                {t("send")}
              </LoadingButton>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

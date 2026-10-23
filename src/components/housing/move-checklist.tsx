"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, CheckCircle2, Plus, Printer, StickyNote, Trash2, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useOptimistic, useRef, useState, useTransition } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import {
  addChecklistItem,
  createMoveChecklist,
  deleteChecklistItem,
  deleteMoveChecklist,
  saveHandover,
  updateChecklistItem,
} from "@/lib/actions/housing";
import { type ErrorKey, toErrorKey } from "@/lib/errors";
import { uploadImage } from "@/lib/image";
import { cn } from "@/lib/utils";
import { type HandoverInput, handoverSchema, type MoveChecklistInput, moveChecklistSchema } from "@/lib/validations/community";

// ------------------------------------------------------------------ create ---
export function NewChecklistButton() {
  const t = useTranslations("housing.move");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(null);
  const form = useForm<MoveChecklistInput, unknown, z.output<typeof moveChecklistSchema>>({
    resolver: zodResolver(moveChecklistSchema),
    defaultValues: { kind: "move_in", title: "", address: "", date: "" },
  });
  const { errors } = form.formState;

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden="true" />
        {t("new")}
      </Button>
      <ResponsiveDialog open={open} onOpenChange={setOpen} title={t("newTitle")} description={t("newBody")}>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={form.handleSubmit(() =>
            startTransition(async () => {
              setError(null);
              const result = await createMoveChecklist(form.getValues());
              if (!result.ok) return setError(result.error);
              setOpen(false);
              router.push(`/housing/move/${result.data.id}`);
            }),
          )}
        >
          <Controller
            control={form.control}
            name="kind"
            render={({ field }) => (
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("kind")}>
                {(["move_in", "move_out"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={field.value === k}
                    onClick={() => field.onChange(k)}
                    className={cn(
                      "rounded-xl border px-3 py-3 text-left transition-colors",
                      field.value === k ? "border-primary bg-mint-soft" : "hover:bg-accent",
                    )}
                  >
                    <span className="block font-medium">{t(`kinds.${k}`)}</span>
                    <span className="block text-xs text-muted-foreground">{t(`kindHints.${k}`)}</span>
                  </button>
                ))}
              </div>
            )}
          />
          <FormField label={t("titleLabel")} error={errors.title}>
            {(field) => <Input {...field} maxLength={100} placeholder={t("titlePlaceholder")} {...form.register("title")} />}
          </FormField>
          <FormField label={t("address")} error={errors.address} optional>
            {(field) => <Input {...field} maxLength={200} {...form.register("address")} />}
          </FormField>
          <FormField label={t("date")} error={errors.date} optional>
            {(field) => <Input {...field} type="date" {...form.register("date")} />}
          </FormField>
          <FormError error={error} />
          <LoadingButton type="submit" loading={pending}>
            {t("create")}
          </LoadingButton>
        </form>
      </ResponsiveDialog>
    </>
  );
}

// ------------------------------------------------------------------- items ---
export type ChecklistItem = { id: string; label: string; isDone: boolean; note: string | null; photoUrl: string | null };

export function ChecklistItems({ checklistId, userId, items }: { checklistId: string; userId: string; items: ChecklistItem[] }) {
  const t = useTranslations("housing.move");
  const te = useTranslations("errors");
  const [optimistic, setDone] = useOptimistic(items, (state, change: { id: string; isDone: boolean }) =>
    state.map((i) => (i.id === change.id ? { ...i, isDone: change.isDone } : i)),
  );
  const [, startTransition] = useTransition();
  const [newLabel, setNewLabel] = useState("");
  const [adding, startAdding] = useTransition();
  const done = optimistic.filter((i) => i.isDone).length;

  return (
    <section className="grid gap-3 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">{t("itemsTitle")}</h2>
        <span className="text-sm text-muted-foreground">{t("progress", { done, total: optimistic.length })}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={optimistic.length} aria-valuenow={done} aria-label={t("itemsTitle")}>
        <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${optimistic.length ? (done / optimistic.length) * 100 : 0}%` }} />
      </div>
      <ul className="grid gap-2">
        {optimistic.map((item) => (
          <ChecklistRow
            key={item.id}
            item={item}
            checklistId={checklistId}
            userId={userId}
            onToggle={(isDone) =>
              startTransition(async () => {
                setDone({ id: item.id, isDone });
                const result = await updateChecklistItem(item.id, { isDone });
                if (!result.ok) toast.error(te(result.error));
              })
            }
          />
        ))}
      </ul>
      <form
        className="flex gap-2 print:hidden"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newLabel.trim()) return;
          startAdding(async () => {
            const result = await addChecklistItem(checklistId, newLabel);
            if (!result.ok) return void toast.error(te(result.error));
            setNewLabel("");
          });
        }}
      >
        <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} maxLength={150} placeholder={t("addPlaceholder")} aria-label={t("addItem")} className="h-11" />
        <LoadingButton type="submit" variant="outline" loading={adding} disabled={!newLabel.trim()} className="h-11">
          <Plus className="size-4" aria-hidden="true" />
          {t("addItem")}
        </LoadingButton>
      </form>
    </section>
  );
}

function ChecklistRow({
  item,
  checklistId,
  userId,
  onToggle,
}: {
  item: ChecklistItem;
  checklistId: string;
  userId: string;
  onToggle: (isDone: boolean) => void;
}) {
  const t = useTranslations("housing.move");
  const te = useTranslations("errors");
  const [noteOpen, setNoteOpen] = useState(Boolean(item.note));
  const [note, setNote] = useState(item.note ?? "");
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const saveNote = () =>
    startTransition(async () => {
      if ((item.note ?? "") === note.trim()) return;
      const result = await updateChecklistItem(item.id, { note: note.trim() || null });
      if (!result.ok) toast.error(te(result.error));
    });

  const upload = (file: File) =>
    startTransition(async () => {
      try {
        const path = await uploadImage("personal", `${userId}/move/${checklistId}`, file);
        const result = await updateChecklistItem(item.id, { photoPath: path });
        if (!result.ok) toast.error(te(result.error));
      } catch (e) {
        toast.error(te(toErrorKey(e)));
      }
    });

  return (
    <li className={cn("rounded-xl border px-3 py-2.5 transition-colors", item.isDone && "bg-mint-soft/60")}>
      <div className="flex items-start gap-3">
        <Checkbox checked={item.isDone} onCheckedChange={(v) => onToggle(v === true)} className="mt-0.5 size-5" aria-label={item.label} />
        <p className={cn("min-w-0 flex-1 text-sm leading-snug", item.isDone && "text-muted-foreground line-through")}>{item.label}</p>
        <div className="flex shrink-0 items-center gap-0.5 print:hidden">
          <Button type="button" variant="ghost" size="icon-sm" aria-label={t("note")} onClick={() => setNoteOpen((o) => !o)}>
            <StickyNote className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={t("photo")} disabled={pending} onClick={() => fileInput.current?.click()}>
            <Camera className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("deleteItem")}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await deleteChecklistItem(item.id);
                if (!result.ok) toast.error(te(result.error));
              })
            }
          >
            <Trash2 className="size-4 text-muted-foreground" />
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload(file);
              e.target.value = "";
            }}
          />
        </div>
      </div>
      {(noteOpen || item.photoUrl) && (
        <div className="mt-2 grid gap-2 pl-8">
          {noteOpen && (
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={saveNote}
              rows={2}
              maxLength={300}
              placeholder={t("notePlaceholder")}
              aria-label={t("note")}
              className="min-h-0 text-sm"
            />
          )}
          {item.photoUrl && (
            <a href={item.photoUrl} target="_blank" rel="noreferrer" className="w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
              <img src={item.photoUrl} alt={t("photoOf", { item: item.label })} className="h-24 rounded-lg border object-cover" />
            </a>
          )}
        </div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------- handover ---
export function HandoverForm({
  checklistId,
  initial,
  completed,
}: {
  checklistId: string;
  initial: HandoverInput;
  completed: boolean;
}) {
  const t = useTranslations("housing.move.handover");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(null);
  const form = useForm<HandoverInput, unknown, z.output<typeof handoverSchema>>({ resolver: zodResolver(handoverSchema), defaultValues: initial });
  const { errors } = form.formState;

  const save = (complete?: boolean) =>
    form.handleSubmit(() =>
      startTransition(async () => {
        setError(null);
        const result = await saveHandover(checklistId, form.getValues(), complete);
        if (!result.ok) return setError(result.error);
        toast.success(complete === true ? t("completed") : complete === false ? t("reopened") : t("saved"));
      }),
    )();

  return (
    <section className="grid gap-4 rounded-2xl border bg-card p-4 sm:p-5">
      <div>
        <h2 className="font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("body")}</p>
      </div>
      <form
        noValidate
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField label={t("to")} error={errors.handoverTo} optional>
            {(field) => <Input {...field} maxLength={80} {...form.register("handoverTo")} />}
          </FormField>
          <FormField label={t("phone")} error={errors.handoverPhone} optional>
            {(field) => <Input {...field} type="tel" inputMode="tel" placeholder="01XXXXXXXXX" {...form.register("handoverPhone")} />}
          </FormField>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <FormField label={t("electricity")} error={errors.electricityMeter} optional>
            {(field) => <Input {...field} type="number" inputMode="decimal" step="0.01" min={0} {...form.register("electricityMeter")} />}
          </FormField>
          <FormField label={t("gas")} error={errors.gasMeter} optional>
            {(field) => <Input {...field} type="number" inputMode="decimal" step="0.01" min={0} {...form.register("gasMeter")} />}
          </FormField>
          <FormField label={t("water")} error={errors.waterMeter} optional>
            {(field) => <Input {...field} type="number" inputMode="decimal" step="0.01" min={0} {...form.register("waterMeter")} />}
          </FormField>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <FormField label={t("keys")} error={errors.keysCount} optional>
            {(field) => <Input {...field} type="number" inputMode="numeric" min={0} max={50} {...form.register("keysCount")} />}
          </FormField>
          <FormField label={t("deposit")} error={errors.depositAmount} optional>
            {(field) => <Input {...field} type="number" inputMode="numeric" min={0} {...form.register("depositAmount")} />}
          </FormField>
          <FormField label={t("returned")} error={errors.depositReturned} optional>
            {(field) => <Input {...field} type="number" inputMode="numeric" min={0} {...form.register("depositReturned")} />}
          </FormField>
        </div>
        <FormField label={t("notes")} error={errors.handoverNotes} optional>
          {(field) => <Textarea {...field} rows={4} maxLength={2000} placeholder={t("notesPlaceholder")} {...form.register("handoverNotes")} />}
        </FormField>
        <FormError error={error} />
        <div className="flex flex-wrap gap-2 print:hidden">
          <LoadingButton type="submit" variant="outline" loading={pending}>
            {t("save")}
          </LoadingButton>
          {completed ? (
            <Button type="button" variant="ghost" disabled={pending} onClick={() => save(false)}>
              <Undo2 className="size-4" aria-hidden="true" />
              {t("reopen")}
            </Button>
          ) : (
            <Button type="button" disabled={pending} onClick={() => save(true)}>
              <CheckCircle2 className="size-4" aria-hidden="true" />
              {t("complete")}
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden="true" />
            {t("print")}
          </Button>
        </div>
      </form>
    </section>
  );
}

export function DeleteChecklistButton({ checklistId, title }: { checklistId: string; title: string }) {
  const t = useTranslations("housing.move");
  const te = useTranslations("errors");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  return (
    <>
      <Button variant="ghost" size="sm" className="text-coral hover:text-coral print:hidden" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" aria-hidden="true" />
        {t("delete")}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
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
                  const result = await deleteMoveChecklist(checklistId);
                  if (!result.ok) return void toast.error(te(result.error));
                  router.push("/housing/move");
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

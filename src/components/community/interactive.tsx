"use client";

import { Flag, Heart, ImagePlus, Star, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { ResponsiveDialog } from "@/components/shared/responsive-dialog";
import { LoadingButton } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { reportContent, setListingSaved } from "@/lib/actions/community";
import { cn } from "@/lib/utils";
import type { REPORT_KINDS } from "@/lib/validations/community";

export type AreaOption = { id: number; name_bn: string; name_en: string };

/** Area dropdown; `anyLabel` adds an "any area" choice with value "". */
export function AreaSelect({
  areas,
  value,
  onChange,
  anyLabel,
  id,
  invalid,
  className,
  placeholder,
}: {
  areas: AreaOption[];
  value: string;
  onChange: (value: string) => void;
  anyLabel?: string;
  id?: string;
  invalid?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const locale = useLocale();
  return (
    <Select value={value || (anyLabel ? "any" : "")} onValueChange={(v) => onChange(v === "any" ? "" : v)}>
      <SelectTrigger id={id} aria-invalid={invalid} className={cn("h-11 w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {anyLabel && <SelectItem value="any">{anyLabel}</SelectItem>}
        {areas.map((a) => (
          <SelectItem key={a.id} value={String(a.id)}>
            {locale === "en" ? a.name_en : a.name_bn}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Heart toggle for saving a listing; flips instantly, rolls back on error. */
export function SaveButton({ listingId, saved, className }: { listingId: string; saved: boolean; className?: string }) {
  const t = useTranslations("housing");
  const te = useTranslations("errors");
  const [optimistic, setOptimistic] = useOptimistic(saved);
  const [, startTransition] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={optimistic}
      aria-label={optimistic ? t("unsave") : t("save")}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        startTransition(async () => {
          setOptimistic(!optimistic);
          const result = await setListingSaved(listingId, !optimistic);
          if (!result.ok) toast.error(te(result.error));
        });
      }}
      className={cn(
        "flex size-10 items-center justify-center rounded-full bg-background/85 shadow-sm backdrop-blur transition-transform active:scale-90",
        className,
      )}
    >
      <Heart className={cn("size-5", optimistic ? "fill-coral text-coral" : "text-foreground")} />
    </button>
  );
}

/** "Report" link that sends a reason to the platform admins. */
export function ReportButton({ kind, id, title }: { kind: (typeof REPORT_KINDS)[number]; id: string; title: string }) {
  const t = useTranslations("community.report");
  const te = useTranslations("errors");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const fieldId = useId();
  return (
    <>
      <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setOpen(true)}>
        <Flag className="size-4" aria-hidden="true" />
        {t("button")}
      </Button>
      <ResponsiveDialog open={open} onOpenChange={setOpen} title={t("title")} description={t("body")}>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const result = await reportContent({ kind, id, title, reason });
              if (!result.ok) return void toast.error(te(result.error));
              toast.success(t("sent"));
              setReason("");
              setOpen(false);
            });
          }}
        >
          <label htmlFor={fieldId} className="sr-only">
            {t("reason")}
          </label>
          <Textarea
            id={fieldId}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            minLength={5}
            maxLength={1000}
            rows={4}
            placeholder={t("placeholder")}
            required
          />
          <LoadingButton type="submit" loading={pending} disabled={reason.trim().length < 5}>
            {t("send")}
          </LoadingButton>
        </form>
      </ResponsiveDialog>
    </>
  );
}

/** 1–5 star picker (radio group under the hood). */
export function StarInput({ value, onChange, label }: { value: number; onChange: (value: number) => void; label: string }) {
  const t = useTranslations("community.rating");
  const name = useId();
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <fieldset className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
      <legend className="sr-only">{label}</legend>
      {[1, 2, 3, 4, 5].map((n) => (
        <label key={n} className="cursor-pointer rounded-md p-1 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring" onMouseEnter={() => setHover(n)}>
          <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} className="sr-only" />
          <Star className={cn("size-7 transition-colors", n <= shown ? "fill-marigold text-marigold" : "text-muted-foreground/40")} aria-hidden="true" />
          <span className="sr-only">{t("stars", { count: n })}</span>
        </label>
      ))}
    </fieldset>
  );
}

export type ExistingPhoto = { id: string; url: string };

/**
 * Pick up to `max` photos. Existing ones can be removed; new files show a local
 * preview and are uploaded by the form after it saves.
 */
export function PhotoPicker({
  existing,
  onRemoveExisting,
  files,
  onFilesChange,
  max,
}: {
  existing: ExistingPhoto[];
  onRemoveExisting: (id: string) => void;
  files: File[];
  onFilesChange: (files: File[]) => void;
  max: number;
}) {
  const t = useTranslations("community.photos");
  const inputId = useId();
  const [previews, setPreviews] = useState<{ file: File; url: string }[]>([]);
  const room = max - existing.length - files.length;

  // previews for picked files (read as data URLs; no object URLs to revoke)
  useEffect(() => {
    let alive = true;
    Promise.all(
      files.map(
        (file) =>
          new Promise<{ file: File; url: string }>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ file, url: String(reader.result) });
            reader.readAsDataURL(file);
          }),
      ),
    ).then((list) => alive && setPreviews(list));
    return () => {
      alive = false;
    };
  }, [files]);

  return (
    <div className="grid gap-2">
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {existing.map((p) => (
          <li key={p.id} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element -- Storage photo */}
            <img src={p.url} alt="" className="aspect-square w-full rounded-xl border object-cover" />
            <RemoveButton label={t("remove")} onClick={() => onRemoveExisting(p.id)} />
          </li>
        ))}
        {previews.map((p, i) => (
          <li key={`${p.file.name}-${i}`} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
            <img src={p.url} alt="" className="aspect-square w-full rounded-xl border object-cover" />
            <RemoveButton label={t("remove")} onClick={() => onFilesChange(files.filter((f) => f !== p.file))} />
          </li>
        ))}
        {room > 0 && (
          <li>
            <label
              htmlFor={inputId}
              className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent/40"
            >
              <ImagePlus className="size-5" aria-hidden="true" />
              {t("add")}
            </label>
            <input
              id={inputId}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
                onFilesChange([...files, ...picked].slice(0, max - existing.length));
                e.target.value = "";
              }}
            />
          </li>
        )}
      </ul>
      <p className="text-[0.8rem] text-muted-foreground">{t("hint", { max })}</p>
    </div>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="absolute -right-1.5 -top-1.5 flex size-7 items-center justify-center rounded-full bg-foreground text-background shadow"
    >
      <X className="size-4" />
    </button>
  );
}

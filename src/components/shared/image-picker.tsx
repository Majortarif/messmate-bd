"use client";

import { Camera, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";

/** Photo field with preview; the caller compresses + uploads on submit. */
export function ImagePicker({
  label,
  hint,
  file,
  onChange,
  className,
}: {
  label: string;
  hint?: string;
  file: File | null;
  onChange: (file: File | null) => void;
  className?: string;
}) {
  const t = useTranslations("common");
  const id = useId();
  const [loaded, setLoaded] = useState<{ file: File; url: string } | null>(null);
  // Only show a preview that belongs to the current file.
  const preview = file && loaded?.file === file ? loaded.url : null;

  useEffect(() => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLoaded({ file, url: reader.result as string });
    reader.readAsDataURL(file);
    return () => reader.abort();
  }, [file]);

  return (
    <div className={cn("grid gap-1.5", className)}>
      <span className="text-[0.9rem] font-medium">
        {label} <span className="font-normal text-muted-foreground">({t("optional")})</span>
      </span>
      {preview ? (
        <div className="relative w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
          <img src={preview} alt="" className="h-32 rounded-xl border object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -right-2 -top-2 flex size-7 items-center justify-center rounded-full bg-foreground text-background"
            aria-label={t("removePhoto")}
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <label
          htmlFor={id}
          className="flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent/40"
        >
          <Camera className="size-5" aria-hidden="true" />
          {t("addPhoto")}
        </label>
      )}
      <input
        id={id}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          onChange(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      {hint && <p className="text-[0.8rem] text-muted-foreground">{hint}</p>}
    </div>
  );
}

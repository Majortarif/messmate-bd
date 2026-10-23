"use client";

import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { forwardRef, useId, useState, type ComponentProps, type ReactNode } from "react";
import type { FieldError } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ErrorKey } from "@/lib/errors";
import { cn } from "@/lib/utils";
import type messages from "../../../messages/bn.json";

export type ValidationKey = keyof (typeof messages)["validation"];

/** Label + control + hint/error, wired up for screen readers. */
export function FormField({
  label,
  hint,
  error,
  optional,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: FieldError;
  optional?: boolean;
  className?: string;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode;
}) {
  const t = useTranslations();
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      <Label htmlFor={id} className="text-[0.9rem]">
        {label}
        {optional && <span className="font-normal text-muted-foreground"> ({t("common.optional")})</span>}
      </Label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}
      {error?.message ? (
        <p id={`${id}-error`} role="alert" className="text-[0.8rem] text-destructive">
          {t(`validation.${error.message as ValidationKey}`)}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[0.8rem] text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const PasswordInput = forwardRef<HTMLInputElement, ComponentProps<typeof Input>>(function PasswordInput(
  { className, ...props },
  ref,
) {
  const t = useTranslations("auth");
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input ref={ref} type={visible ? "text" : "password"} className={cn("pr-10", className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        aria-label={visible ? t("hidePassword") : t("showPassword")}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
});

export function LoadingButton({
  loading,
  children,
  disabled,
  ...props
}: ComponentProps<typeof Button> & { loading?: boolean }) {
  return (
    <Button disabled={disabled || loading} aria-busy={loading} {...props}>
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </Button>
  );
}

/** Inline error banner for a failed action. */
export function FormError({ error, className }: { error?: ErrorKey | null; className?: string }) {
  const t = useTranslations("errors");
  if (!error) return null;
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive",
        className,
      )}
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{t(error)}</span>
    </div>
  );
}

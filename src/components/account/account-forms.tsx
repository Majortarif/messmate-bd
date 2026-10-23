"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, Download, LogOut, Trash2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { FormError, FormField, LoadingButton, PasswordInput } from "@/components/shared/form";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { deleteAccount, leaveMess, saveProfile, setAvatar } from "@/lib/actions/account";
import { updatePassword } from "@/lib/actions/auth";
import { type ErrorKey, toErrorKey } from "@/lib/errors";
import { initials } from "@/lib/format";
import { uploadImage } from "@/lib/image";
import { BLOOD_GROUPS, DELETE_WORD, GENDER_OPTIONS, OCCUPATION_OPTIONS, type ProfileInput, profileSchema } from "@/lib/validations/account";
import { type ResetPasswordInput, resetPasswordSchema } from "@/lib/validations/auth";

// ------------------------------------------------------------------ avatar ---
export function AvatarEditor({ userId, name, url }: { userId: string; name: string; url: string | null }) {
  const t = useTranslations("settings.profile");
  const te = useTranslations("errors");
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-20">
        {url && <AvatarImage src={url} alt="" />}
        <AvatarFallback className="bg-mint-soft text-xl font-semibold text-mint">{initials(name)}</AvatarFallback>
      </Avatar>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => input.current?.click()}>
          <Camera className="size-4" aria-hidden="true" />
          {url ? t("changePhoto") : t("addPhoto")}
        </Button>
        {url && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await setAvatar(null);
                if (!result.ok) toast.error(te(result.error));
              })
            }
          >
            <X className="size-4" aria-hidden="true" />
            {t("removePhoto")}
          </Button>
        )}
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            startTransition(async () => {
              try {
                const path = await uploadImage("avatars", userId, file);
                const result = await setAvatar(path);
                if (!result.ok) return void toast.error(te(result.error));
                toast.success(t("photoSaved"));
              } catch (err) {
                toast.error(te(toErrorKey(err)));
              }
            });
          }}
        />
      </div>
    </div>
  );
}

// ----------------------------------------------------------------- profile ---
function EnumField<T extends string>({
  id,
  value,
  onChange,
  options,
  render,
  none,
}: {
  id: string;
  value: T | null;
  onChange: (v: T | null) => void;
  options: readonly T[];
  render: (v: T) => string;
  none: string;
}) {
  return (
    <Select value={value ?? "none"} onValueChange={(v) => onChange(v === "none" ? null : (v as T))}>
      <SelectTrigger id={id} className="h-11 w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">{none}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {render(o)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ProfileForm({ initial }: { initial: ProfileInput }) {
  const t = useTranslations("settings.profile");
  const tg = useTranslations("housing.roommates.gender");
  const to = useTranslations("housing.roommates.occupation");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(null);
  const form = useForm<ProfileInput, unknown, z.output<typeof profileSchema>>({ resolver: zodResolver(profileSchema), defaultValues: initial });
  const { errors } = form.formState;

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={form.handleSubmit(() =>
        startTransition(async () => {
          setError(null);
          const result = await saveProfile(form.getValues());
          if (!result.ok) return setError(result.error);
          toast.success(t("saved"));
        }),
      )}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={t("name")} error={errors.fullName}>
          {(field) => <Input {...field} maxLength={80} autoComplete="name" {...form.register("fullName")} />}
        </FormField>
        <FormField label={t("phone")} hint={t("phoneHint")} error={errors.phone} optional>
          {(field) => <Input {...field} type="tel" inputMode="tel" placeholder="01XXXXXXXXX" autoComplete="tel" {...form.register("phone")} />}
        </FormField>
        <FormField label={t("gender")} error={errors.gender} optional>
          {(field) => (
            <Controller
              control={form.control}
              name="gender"
              render={({ field: f }) => (
                <EnumField id={field.id} value={f.value ?? null} onChange={f.onChange} options={GENDER_OPTIONS} render={(g) => tg(g)} none={t("notSay")} />
              )}
            />
          )}
        </FormField>
        <FormField label={t("occupation")} error={errors.occupation} optional>
          {(field) => (
            <Controller
              control={form.control}
              name="occupation"
              render={({ field: f }) => (
                <EnumField id={field.id} value={f.value ?? null} onChange={f.onChange} options={OCCUPATION_OPTIONS} render={(o) => to(o)} none={t("notSay")} />
              )}
            />
          )}
        </FormField>
        <FormField label={t("institution")} hint={t("institutionHint")} error={errors.institution} optional>
          {(field) => <Input {...field} maxLength={120} {...form.register("institution")} />}
        </FormField>
        <FormField label={t("homeDistrict")} error={errors.homeDistrict} optional>
          {(field) => <Input {...field} maxLength={60} placeholder={t("homeDistrictPlaceholder")} {...form.register("homeDistrict")} />}
        </FormField>
        <FormField label={t("bloodGroup")} hint={t("bloodGroupHint")} error={errors.bloodGroup} optional>
          {(field) => (
            <Controller
              control={form.control}
              name="bloodGroup"
              render={({ field: f }) => (
                <EnumField id={field.id} value={f.value ?? null} onChange={f.onChange} options={BLOOD_GROUPS} render={(b) => b} none={t("notSay")} />
              )}
            />
          )}
        </FormField>
        <FormField label={t("language")} error={errors.preferredLocale}>
          {(field) => (
            <Controller
              control={form.control}
              name="preferredLocale"
              render={({ field: f }) => (
                <Select value={f.value} onValueChange={f.onChange}>
                  <SelectTrigger id={field.id} className="h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bn">বাংলা</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </FormField>
      </div>
      <FormField label={t("bio")} error={errors.bio} optional>
        {(field) => <Textarea {...field} rows={2} maxLength={300} placeholder={t("bioPlaceholder")} {...form.register("bio")} />}
      </FormField>
      <div className="grid gap-1.5 rounded-xl border p-3">
        <p className="text-sm font-medium">{t("guardian")}</p>
        <p className="text-xs text-muted-foreground">{t("guardianHint")}</p>
        <div className="mt-1 grid gap-3 sm:grid-cols-2">
          <FormField label={t("guardianName")} error={errors.guardianName} optional>
            {(field) => <Input {...field} maxLength={80} {...form.register("guardianName")} />}
          </FormField>
          <FormField label={t("guardianPhone")} error={errors.guardianPhone} optional>
            {(field) => <Input {...field} type="tel" inputMode="tel" placeholder="01XXXXXXXXX" {...form.register("guardianPhone")} />}
          </FormField>
        </div>
      </div>
      <FormError error={error} />
      <LoadingButton type="submit" loading={pending} className="w-fit">
        {t("save")}
      </LoadingButton>
    </form>
  );
}

// ---------------------------------------------------------------- password ---
export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const t = useTranslations("settings.password");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(null);
  const form = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { password: "", confirmPassword: "" } });
  const { errors } = form.formState;
  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={form.handleSubmit((values) =>
        startTransition(async () => {
          setError(null);
          const result = await updatePassword(values);
          if (!result.ok) return setError(result.error);
          toast.success(t("changed"));
          form.reset();
        }),
      )}
    >
      {!hasPassword && <p className="text-sm text-muted-foreground">{t("googleNote")}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={t("new")} hint={t("rules")} error={errors.password}>
          {(field) => <PasswordInput {...field} autoComplete="new-password" {...form.register("password")} />}
        </FormField>
        <FormField label={t("confirm")} error={errors.confirmPassword}>
          {(field) => <PasswordInput {...field} autoComplete="new-password" {...form.register("confirmPassword")} />}
        </FormField>
      </div>
      <FormError error={error} />
      <LoadingButton type="submit" loading={pending} className="w-fit">
        {hasPassword ? t("change") : t("set")}
      </LoadingButton>
    </form>
  );
}

// -------------------------------------------------------------- leave mess ---
export function LeaveMessButton({ messName, balance }: { messName: string; balance: string }) {
  const t = useTranslations("settings.mess");
  const te = useTranslations("errors");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button variant="outline" className="text-coral hover:text-coral" onClick={() => setOpen(true)}>
        <LogOut className="size-4" aria-hidden="true" />
        {t("leave")}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("leaveTitle", { mess: messName })}</AlertDialogTitle>
            <AlertDialogDescription>{t("leaveBody", { balance })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                startTransition(async () => {
                  const result = await leaveMess();
                  if (!result.ok) {
                    setOpen(false);
                    return void toast.error(te(result.error));
                  }
                  toast.success(t("left"));
                  router.push("/onboarding");
                });
              }}
            >
              {t("leaveConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ------------------------------------------------------------ data rights ---
export function ExportDataButton() {
  const t = useTranslations("settings.data");
  return (
    <Button asChild variant="outline">
      <a href="/api/export/me" download>
        <Download className="size-4" aria-hidden="true" />
        {t("export")}
      </a>
    </Button>
  );
}

export function DeleteAccountButton() {
  const t = useTranslations("settings.data");
  const te = useTranslations("errors");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [pending, startTransition] = useTransition();
  const ready = word.trim().toUpperCase() === DELETE_WORD;
  return (
    <>
      <Button variant="outline" className="text-coral hover:text-coral" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" aria-hidden="true" />
        {t("delete")}
      </Button>
      <AlertDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setWord("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="grid gap-2 text-sm">
                <p>{t("deleteBody")}</p>
                <ul className="grid list-disc gap-1 pl-5">
                  <li>{t("deleteGone")}</li>
                  <li>{t("deleteKept")}</li>
                  <li>{t("deleteManager")}</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="grid gap-1.5 text-sm">
            {t("typeToConfirm", { word: DELETE_WORD })}
            <Input value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" autoCapitalize="characters" />
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={!ready || pending}
              onClick={(e) => {
                e.preventDefault();
                startTransition(async () => {
                  const result = await deleteAccount(word);
                  if (!result.ok) {
                    setOpen(false);
                    return void toast.error(te(result.error));
                  }
                  // full reload: the session is gone
                  window.location.assign(locale === "bn" ? "/account-deleted" : `/${locale}/account-deleted`);
                });
              }}
            >
              {pending ? t("deleting") : t("deleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

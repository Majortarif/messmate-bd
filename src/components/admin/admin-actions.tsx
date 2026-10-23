"use client";

import { Power, PowerOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { setMessActive, setPlatformRole } from "@/lib/actions/admin";
import { PLATFORM_ROLES, type PlatformRole } from "@/types/app";

/** Switch a mess off (with a reason the manager sees) or back on. */
export function MessStatusButton({ messId, name, active }: { messId: string; name: string; active: boolean }) {
  const t = useTranslations("admin.messes");
  const te = useTranslations("errors");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  const run = (next: boolean) =>
    startTransition(async () => {
      const result = await setMessActive(messId, next, reason);
      if (!result.ok) return void toast.error(te(result.error));
      toast.success(next ? t("activated", { name }) : t("deactivated", { name }));
      setOpen(false);
      setReason("");
    });

  if (!active) {
    return (
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(true)}>
        <Power className="size-4" aria-hidden="true" />
        {t("activate")}
      </Button>
    );
  }
  return (
    <>
      <Button size="sm" variant="ghost" className="text-coral hover:text-coral" disabled={pending} onClick={() => setOpen(true)}>
        <PowerOff className="size-4" aria-hidden="true" />
        {t("deactivate")}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deactivateTitle", { name })}</AlertDialogTitle>
            <AlertDialogDescription>{t("deactivateBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            placeholder={t("reasonPlaceholder")}
            aria-label={t("reason")}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                run(false);
              }}
            >
              {t("deactivate")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Platform role picker; a super admin cannot change their own role. */
export function RoleSelect({ userId, name, role, disabled }: { userId: string; name: string; role: PlatformRole; disabled?: boolean }) {
  const t = useTranslations("admin.users");
  const tr = useTranslations("platformRoles");
  const te = useTranslations("errors");
  const [value, setValue] = useState<PlatformRole>(role);
  const [confirm, setConfirm] = useState<PlatformRole | null>(null);
  const [pending, startTransition] = useTransition();

  const apply = (next: PlatformRole) =>
    startTransition(async () => {
      const previous = value;
      setValue(next);
      const result = await setPlatformRole(userId, next);
      if (!result.ok) {
        setValue(previous);
        return void toast.error(te(result.error));
      }
      toast.success(t("roleChanged", { name, role: tr(next) }));
    });

  return (
    <>
      <Select
        value={value}
        disabled={disabled || pending}
        onValueChange={(next) => {
          const picked = next as PlatformRole;
          // granting or removing platform admin is double-checked
          if (picked === "super_admin" || value === "super_admin") setConfirm(picked);
          else apply(picked);
        }}
      >
        <SelectTrigger className="h-9 w-44" aria-label={t("roleFor", { name })}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PLATFORM_ROLES.map((r) => (
            <SelectItem key={r} value={r}>
              {tr(r)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "super_admin" ? t("grantAdminTitle", { name }) : t("revokeAdminTitle", { name })}
            </AlertDialogTitle>
            <AlertDialogDescription>{confirm === "super_admin" ? t("grantAdminBody") : t("revokeAdminBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirm) apply(confirm);
                setConfirm(null);
              }}
            >
              {t("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

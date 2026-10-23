"use client";

import { Check, Trash2, X } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { moderate } from "@/lib/actions/admin";
import type { ModerationKind } from "@/types/app";

/**
 * Pre-moderated content (listings, services, recipes, events) is approved or
 * rejected; post-moderated content (jobs, market items) can only be removed.
 * Either way the owner gets a notification with the reason.
 */
export function ModerationActions({ kind, id, title }: { kind: ModerationKind; id: string; title: string }) {
  const t = useTranslations("admin.moderation");
  const te = useTranslations("errors");
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState(false);
  const [reason, setReason] = useState("");
  const [verified, setVerified] = useState(false);
  const removeOnly = kind === "job" || kind === "market";

  const run = (status: "approved" | "rejected" | "removed") =>
    startTransition(async () => {
      const result = await moderate({
        kind,
        id,
        status,
        reason: status === "approved" ? undefined : reason,
        verified: kind === "service" && status === "approved" ? verified : undefined,
      });
      if (!result.ok) return void toast.error(te(result.error));
      toast.success(t(`done.${status}`, { title }));
      setDialog(false);
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!removeOnly && (
        <>
          {kind === "service" && (
            <div className="mr-1 flex items-center gap-2">
              <Checkbox id={`verify-${id}`} checked={verified} onCheckedChange={(v) => setVerified(v === true)} />
              <Label htmlFor={`verify-${id}`} className="text-sm font-normal">
                {t("verify")}
              </Label>
            </div>
          )}
          <Button size="sm" disabled={pending} onClick={() => run("approved")}>
            <Check className="size-4" aria-hidden="true" />
            {t("approve")}
          </Button>
        </>
      )}
      <Button size="sm" variant="outline" className="text-coral hover:text-coral" disabled={pending} onClick={() => setDialog(true)}>
        {removeOnly ? <Trash2 className="size-4" aria-hidden="true" /> : <X className="size-4" aria-hidden="true" />}
        {removeOnly ? t("remove") : t("reject")}
      </Button>

      <AlertDialog open={dialog} onOpenChange={setDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{removeOnly ? t("removeTitle", { title }) : t("rejectTitle", { title })}</AlertDialogTitle>
            <AlertDialogDescription>{t("reasonBody")}</AlertDialogDescription>
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
                run(removeOnly ? "removed" : "rejected");
              }}
            >
              {removeOnly ? t("remove") : t("reject")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

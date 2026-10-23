"use client";

import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { LoadingButton } from "@/components/shared/form";
import { closeMonth } from "@/lib/actions/manage";

export function CloseMonthButton({ messId, month, monthLabel }: { messId: string; month: string; monthLabel: string }) {
  const t = useTranslations("manage.closing");
  const te = useTranslations("errors");
  const [pending, startTransition] = useTransition();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <LoadingButton loading={pending}>
          <Lock className="size-4" aria-hidden="true" />
          {t("close", { month: monthLabel })}
        </LoadingButton>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("confirmTitle", { month: monthLabel })}</AlertDialogTitle>
          <AlertDialogDescription>{t("confirmBody")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              startTransition(async () => {
                const result = await closeMonth(messId, month);
                if (result.ok) toast.success(t("closed", { month: monthLabel }));
                else toast.error(te(result.error));
              })
            }
          >
            {t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

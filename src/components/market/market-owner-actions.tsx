"use client";

import { CheckCircle2, Clock3, MoreVertical, Pencil, RotateCcw, Trash2 } from "lucide-react";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link, useRouter } from "@/i18n/navigation";
import { deleteMarketItem, setMarketStatus } from "@/lib/actions/market";

type Status = "available" | "reserved" | "sold" | "removed";

/** Seller menu: edit, reserved / sold / available again, delete. */
export function MarketOwnerActions({ id, title, status, afterDelete }: { id: string; title: string; status: Status; afterDelete?: string }) {
  const t = useTranslations("market.owner");
  const te = useTranslations("errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);

  const set = (next: "available" | "reserved" | "sold") =>
    startTransition(async () => {
      const result = await setMarketStatus(id, next);
      if (!result.ok) return void toast.error(te(result.error));
      toast.success(t(`done.${next}`));
    });

  if (status === "removed") return null;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" disabled={pending} aria-label={t("menu", { title })}>
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem asChild>
            <Link href={`/market/${id}/edit`}>
              <Pencil className="size-4" />
              {t("edit")}
            </Link>
          </DropdownMenuItem>
          {status !== "reserved" && status !== "sold" && (
            <DropdownMenuItem onSelect={() => set("reserved")}>
              <Clock3 className="size-4" />
              {t("reserve")}
            </DropdownMenuItem>
          )}
          {status !== "sold" && (
            <DropdownMenuItem onSelect={() => set("sold")}>
              <CheckCircle2 className="size-4" />
              {t("sold")}
            </DropdownMenuItem>
          )}
          {status !== "available" && (
            <DropdownMenuItem onSelect={() => set("available")}>
              <RotateCcw className="size-4" />
              {t("available")}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirm(true)}>
            <Trash2 className="size-4" />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
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
                  const result = await deleteMarketItem(id);
                  if (!result.ok) return void toast.error(te(result.error));
                  toast.success(t("done.delete"));
                  if (afterDelete) router.push(afterDelete);
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

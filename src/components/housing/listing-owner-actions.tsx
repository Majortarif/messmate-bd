"use client";

import { Archive, CheckCircle2, MoreVertical, Pencil, RotateCcw, Trash2, Undo2 } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useRouter } from "@/i18n/navigation";
import { deleteListing, updateListingState } from "@/lib/actions/housing";

/** Owner menu: edit, filled / open, archive / restore, delete. */
export function ListingOwnerActions({
  id,
  title,
  status,
  filled,
  afterDelete,
}: {
  id: string;
  title: string;
  status: "pending" | "approved" | "rejected" | "archived";
  filled: boolean;
  afterDelete?: string;
}) {
  const t = useTranslations("housing.owner");
  const te = useTranslations("errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);

  const change = (what: "fill" | "reopen" | "archive" | "restore") =>
    startTransition(async () => {
      const result = await updateListingState(id, what);
      if (!result.ok) return void toast.error(te(result.error));
      toast.success(t(`done.${what}`));
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" disabled={pending} aria-label={t("menu", { title })}>
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem asChild>
            <Link href={`/housing/${id}/edit`}>
              <Pencil className="size-4" />
              {t("edit")}
            </Link>
          </DropdownMenuItem>
          {status === "approved" &&
            (filled ? (
              <DropdownMenuItem onSelect={() => change("reopen")}>
                <Undo2 className="size-4" />
                {t("reopen")}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => change("fill")}>
                <CheckCircle2 className="size-4" />
                {t("fill")}
              </DropdownMenuItem>
            ))}
          {status === "archived" ? (
            <DropdownMenuItem onSelect={() => change("restore")}>
              <RotateCcw className="size-4" />
              {t("restore")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => change("archive")}>
              <Archive className="size-4" />
              {t("archive")}
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
                  const result = await deleteListing(id);
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

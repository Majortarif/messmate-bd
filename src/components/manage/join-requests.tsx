"use client";

import { Check, Phone, UserPlus, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/states";
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
import { Textarea } from "@/components/ui/textarea";
import { decideJoinRequest } from "@/lib/actions/members";
import { formatDate, initials } from "@/lib/format";

export type JoinRequest = {
  id: string;
  requestedAt: string;
  note: string | null;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  occupation: string | null;
};

export function JoinRequests({ requests }: { requests: JoinRequest[] }) {
  const t = useTranslations("members.requests");
  const te = useTranslations("errors");
  const locale = useLocale();
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<JoinRequest | null>(null);
  const [reason, setReason] = useState("");
  const [, startTransition] = useTransition();

  const decide = (request: JoinRequest, approve: boolean, note?: string) => {
    setBusy(request.id);
    startTransition(async () => {
      const result = await decideJoinRequest({ membershipId: request.id, approve, note });
      setBusy(null);
      if (!result.ok) toast.error(te(result.error));
      else toast.success(approve ? t("approved", { name: request.name }) : t("rejected", { name: request.name }));
    });
  };

  if (requests.length === 0) {
    return <EmptyState icon={UserPlus} title={t("empty")} body={t("emptyBody")} />;
  }

  return (
    <>
      <ul className="grid gap-3">
        {requests.map((r) => (
          <li key={r.id} className="rounded-xl border p-4">
            <div className="flex items-start gap-3">
              <Avatar className="size-11">
                {r.avatarUrl && <AvatarImage src={r.avatarUrl} alt="" />}
                <AvatarFallback className="bg-marigold-soft font-semibold text-marigold">{initials(r.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{r.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t("requestedAt", {
                    time: formatDate(r.requestedAt, locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }),
                  })}
                  {r.occupation ? ` · ${r.occupation}` : ""}
                </p>
                {r.phone && (
                  <a href={`tel:${r.phone}`} className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    <Phone className="size-3" aria-hidden="true" />
                    {r.phone}
                  </a>
                )}
                {r.note && <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-sm">“{r.note}”</p>}
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button className="flex-1" disabled={busy === r.id} onClick={() => decide(r, true)}>
                <Check className="size-4" aria-hidden="true" />
                {t("approve")}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={busy === r.id}
                onClick={() => {
                  setReason("");
                  setRejecting(r);
                }}
              >
                <X className="size-4" aria-hidden="true" />
                {t("reject")}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <AlertDialog open={Boolean(rejecting)} onOpenChange={(open) => !open && setRejecting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("rejectTitle", { name: rejecting?.name ?? "" })}</AlertDialogTitle>
            <AlertDialogDescription>{t("rejectBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder={t("rejectPlaceholder")}
            aria-label={t("rejectPlaceholder")}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => rejecting && decide(rejecting, false, reason.trim() || undefined)}
            >
              {t("reject")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

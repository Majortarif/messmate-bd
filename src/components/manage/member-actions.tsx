"use client";

import { BedDouble, MoreVertical, PauseCircle, PlayCircle, ShieldCheck, ShieldOff, UserMinus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ResponsiveDialog } from "@/components/shared/responsive-dialog";
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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateMember } from "@/lib/actions/manage";

export type RoomOption = { id: string; label: string; free: number };

export function MemberActions({
  membershipId,
  name,
  role,
  status,
  roomId,
  seat,
  rooms,
  isSelf,
}: {
  membershipId: string;
  name: string;
  role: "manager" | "member";
  status: "active" | "inactive";
  roomId: string | null;
  seat: string | null;
  rooms: RoomOption[];
  isSelf: boolean;
}) {
  const t = useTranslations("manage.memberActions");
  const te = useTranslations("errors");
  const [pending, startTransition] = useTransition();
  const [roomOpen, setRoomOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [room, setRoom] = useState<string>(roomId ?? "none");
  const [seatLabel, setSeatLabel] = useState(seat ?? "");

  const run = (patch: Parameters<typeof updateMember>[0], success: string) =>
    startTransition(async () => {
      const result = await updateMember(patch);
      if (result.ok) toast.success(success);
      else toast.error(te(result.error));
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" disabled={pending} aria-label={t("open", { name })}>
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => setRoomOpen(true)}>
            <BedDouble className="size-4" />
            {t("room")}
          </DropdownMenuItem>
          {role === "member" ? (
            <DropdownMenuItem onSelect={() => run({ membershipId, role: "manager" }, t("madeManager", { name }))}>
              <ShieldCheck className="size-4" />
              {t("makeManager")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => run({ membershipId, role: "member" }, t("removedManager", { name }))}>
              <ShieldOff className="size-4" />
              {isSelf ? t("stepDown") : t("removeManager")}
            </DropdownMenuItem>
          )}
          {status === "active" ? (
            <DropdownMenuItem onSelect={() => run({ membershipId, status: "inactive" }, t("pausedDone", { name }))}>
              <PauseCircle className="size-4" />
              {t("pause")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => run({ membershipId, status: "active" }, t("resumedDone", { name }))}>
              <PlayCircle className="size-4" />
              {t("resume")}
            </DropdownMenuItem>
          )}
          {!isSelf && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setRemoveOpen(true)}>
                <UserMinus className="size-4" />
                {t("remove")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ResponsiveDialog open={roomOpen} onOpenChange={setRoomOpen} title={t("roomTitle", { name })}>
        <div className="grid gap-3">
          <Select value={room} onValueChange={setRoom}>
            <SelectTrigger className="w-full" aria-label={t("room")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("noRoom")}</SelectItem>
              {rooms.map((r) => (
                <SelectItem key={r.id} value={r.id} disabled={r.free <= 0 && r.id !== roomId}>
                  {r.label} · {t("free", { count: Math.max(r.free, 0) })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input value={seatLabel} onChange={(e) => setSeatLabel(e.target.value)} maxLength={20} placeholder={t("seatPlaceholder")} aria-label={t("seat")} />
          <Button
            disabled={pending}
            onClick={() => {
              run({ membershipId, roomId: room === "none" ? null : room, seatLabel }, t("roomSaved"));
              setRoomOpen(false);
            }}
          >
            {t("save")}
          </Button>
        </div>
      </ResponsiveDialog>

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("removeTitle", { name })}</AlertDialogTitle>
            <AlertDialogDescription>{t("removeBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => run({ membershipId, status: "left" }, t("removedDone", { name }))}
            >
              {t("remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

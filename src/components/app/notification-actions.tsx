"use client";

import { CheckCheck, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { clearReadNotifications, markAllNotificationsRead } from "@/lib/actions/notifications";

export function NotificationActions({ unread, read }: { unread: number; read: number }) {
  const t = useTranslations("notifications");
  const te = useTranslations("errors");
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={pending || unread === 0}
        onClick={() =>
          startTransition(async () => {
            const result = await markAllNotificationsRead();
            if (!result.ok) toast.error(te(result.error));
          })
        }
      >
        <CheckCheck className="size-4" aria-hidden="true" />
        {t("markAll")}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending || read === 0}
        onClick={() =>
          startTransition(async () => {
            const result = await clearReadNotifications();
            if (!result.ok) toast.error(te(result.error));
            else toast.success(t("cleared"));
          })
        }
      >
        <Trash2 className="size-4" aria-hidden="true" />
        {t("clearRead")}
      </Button>
    </div>
  );
}

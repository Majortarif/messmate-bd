"use client";

import { Check, Copy, RefreshCw, Share2 } from "lucide-react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { regenerateInviteCode, setInviteEnabled } from "@/lib/actions/members";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";

export function InviteCard({
  messId,
  messName,
  code,
  enabled,
  compact = false,
}: {
  messId: string;
  messName: string;
  code: string;
  enabled: boolean;
  compact?: boolean;
}) {
  const t = useTranslations("invite");
  const te = useTranslations("errors");
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [pending, startTransition] = useTransition();
  const link = `${env.siteUrl}/join/${code}`;
  const shareText = t("shareText", { mess: messName, code, link });

  const copy = async (what: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(what === "code" ? code : link);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      toast.error(te("generic"));
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: messName, text: shareText, url: link });
        return;
      } catch {
        // cancelled: fall back to WhatsApp below only if sharing isn't supported
        return;
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <section className={cn("rounded-2xl border bg-card p-5", !enabled && "opacity-90")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{t("title")}</h2>
          {!compact && <p className="mt-1 text-sm text-muted-foreground">{t("body")}</p>}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={enabled}
            disabled={pending}
            onCheckedChange={(next) =>
              startTransition(async () => {
                const result = await setInviteEnabled(messId, next);
                if (!result.ok) toast.error(te(result.error));
              })
            }
            aria-label={t("toggle")}
          />
          {enabled ? t("on") : t("off")}
        </label>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <p
          className={cn(
            "num flex-1 rounded-xl border border-dashed border-primary/40 bg-mint-soft py-3 text-center font-mono text-2xl font-semibold tracking-[0.35em] text-mint",
            !enabled && "line-through decoration-2",
          )}
          aria-label={t("codeLabel")}
        >
          {code}
        </p>
        <Button variant="outline" size="icon-lg" onClick={() => copy("code")} aria-label={t("copyCode")}>
          {copied === "code" ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
        </Button>
      </div>

      {!enabled && <p className="mt-2 text-xs text-muted-foreground">{t("disabledHint")}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={share} disabled={!enabled} className="flex-1 sm:flex-none">
          <Share2 className="size-4" aria-hidden="true" />
          {t("share")}
        </Button>
        <Button variant="outline" onClick={() => copy("link")} disabled={!enabled} className="flex-1 sm:flex-none">
          {copied === "link" ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
          {copied === "link" ? t("copied") : t("copyLink")}
        </Button>
        {!compact && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" disabled={pending} className="text-muted-foreground">
                <RefreshCw className="size-4" aria-hidden="true" />
                {t("regenerate")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("regenerateTitle")}</AlertDialogTitle>
                <AlertDialogDescription>{t("regenerateBody")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() =>
                    startTransition(async () => {
                      const result = await regenerateInviteCode(messId);
                      if (result.ok) toast.success(t("regenerated"));
                      else toast.error(te(result.error));
                    })
                  }
                >
                  {t("regenerate")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </section>
  );
}

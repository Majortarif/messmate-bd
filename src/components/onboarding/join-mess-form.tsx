"use client";

import { Building2, MapPin, Search, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { FormError, LoadingButton, type ValidationKey } from "@/components/shared/form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { previewInvite, requestJoin } from "@/lib/actions/onboarding";
import type { ErrorKey } from "@/lib/errors";
import { formatNumber } from "@/lib/format";
import { inviteCodeField } from "@/lib/validations/mess";
import type { MessInvitePreview } from "@/types/app";

export function JoinMessForm({ initialCode = "" }: { initialCode?: string }) {
  const t = useTranslations("onboarding.join");
  const tv = useTranslations("validation");
  const locale = useLocale();
  const [code, setCode] = useState(initialCode);
  const [codeError, setCodeError] = useState<ValidationKey | null>(null);
  const [preview, setPreview] = useState<MessInvitePreview | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<ErrorKey | null>(null);
  const [checking, startCheck] = useTransition();
  const [sending, startSend] = useTransition();
  const autoChecked = useRef(false);

  const check = (value: string) => {
    const parsed = inviteCodeField.safeParse(value);
    if (!parsed.success) {
      setCodeError("inviteCode");
      return;
    }
    setCodeError(null);
    setError(null);
    startCheck(async () => {
      const result = await previewInvite(parsed.data);
      if (!result.ok) setError(result.error);
      else if (!result.data) setError("invalid_invite");
      else if (!result.data.invite_enabled) setError("invite_disabled");
      else {
        setCode(parsed.data);
        setPreview(result.data);
      }
    });
  };

  // Invite links (/join/CODE) open with the code already filled in.
  useEffect(() => {
    if (initialCode && !autoChecked.current) {
      autoChecked.current = true;
      check(initialCode);
    }
  }, [initialCode]);

  if (preview) {
    const area = locale === "bn" ? preview.area_name_bn : preview.area_name_en;
    return (
      <div className="grid gap-5">
        <div className="rounded-2xl border border-primary/30 bg-mint-soft p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Building2 className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-lg font-semibold">{preview.name}</p>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {area && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" aria-hidden="true" />
                    {area}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3.5" aria-hidden="true" />
                  {t("members", { count: preview.member_count, formatted: formatNumber(preview.member_count, locale) })}
                </span>
              </div>
              {preview.gender_policy !== "any" && (
                <Badge variant="secondary" className="mt-2">
                  {t(`gender.${preview.gender_policy}`)}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="join-note">
            {t("note")} <span className="font-normal text-muted-foreground">({t("optional")})</span>
          </Label>
          <Textarea
            id="join-note"
            rows={3}
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("notePlaceholder")}
          />
        </div>

        <FormError error={error} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <LoadingButton
            className="h-11"
            loading={sending}
            onClick={() =>
              startSend(async () => {
                setError(null);
                const result = await requestJoin({ code, note });
                if (!result.ok) setError(result.error);
                else toast.success(t("sent"));
              })
            }
          >
            {t("request")}
          </LoadingButton>
          <Button variant="ghost" className="h-11" onClick={() => setPreview(null)}>
            {t("changeCode")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        check(code);
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="invite-code">{t("code")}</Label>
        <Input
          id="invite-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="NEER2026"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={12}
          aria-invalid={Boolean(codeError)}
          aria-describedby="invite-code-help"
          className="h-12 text-center font-mono text-lg tracking-[0.3em] uppercase"
        />
        <p id="invite-code-help" className={codeError ? "text-[0.8rem] text-destructive" : "text-[0.8rem] text-muted-foreground"}>
          {codeError ? tv(codeError) : t("codeHint")}
        </p>
      </div>
      <FormError error={error} />
      <LoadingButton type="submit" loading={checking} className="h-11">
        <Search className="size-4" aria-hidden="true" />
        {t("check")}
      </LoadingButton>
    </form>
  );
}

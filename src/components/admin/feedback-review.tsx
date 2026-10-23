"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { LoadingButton } from "@/components/shared/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { updateFeedback } from "@/lib/actions/admin";

const STATUSES = ["new", "reviewing", "resolved"] as const;
type Status = (typeof STATUSES)[number];

/** Status + private admin note for one feedback message. */
export function FeedbackReview({ id, status, note }: { id: string; status: Status; note: string | null }) {
  const t = useTranslations("admin.feedback");
  const te = useTranslations("errors");
  const [value, setValue] = useState<Status>(status);
  const [text, setText] = useState(note ?? "");
  const [pending, startTransition] = useTransition();
  const dirty = value !== status || text !== (note ?? "");

  return (
    <form
      className="mt-3 grid gap-2 border-t pt-3 sm:grid-cols-[11rem_1fr_auto] sm:items-start"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await updateFeedback({ id, status: value, note: text });
          if (!result.ok) return void toast.error(te(result.error));
          toast.success(t("saved"));
        });
      }}
    >
      <Select value={value} onValueChange={(v) => setValue(v as Status)}>
        <SelectTrigger className="h-10 w-full" aria-label={t("status")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {t(`statuses.${s}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={1000}
        rows={1}
        placeholder={t("notePlaceholder")}
        aria-label={t("note")}
        className="min-h-10"
      />
      <LoadingButton type="submit" variant="outline" loading={pending} disabled={!dirty} className="h-10">
        {t("save")}
      </LoadingButton>
    </form>
  );
}

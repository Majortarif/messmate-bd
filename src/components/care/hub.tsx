"use client";

import { CheckCircle2, Droplet, Home, LocateFixed, MapPin, MessageCircle, Minus, Phone, PhoneCall, Plus, Siren, Thermometer, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { FormError, LoadingButton } from "@/components/shared/form";
import { ResponsiveDialog } from "@/components/shared/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import {
  finishCheckin,
  logFamilyCall,
  type RaisedAlert,
  raiseAlert,
  resolveAlert,
  respondToAlert,
  saveMood,
  setWater,
  startCheckin,
} from "@/lib/actions/care";
import type { ErrorKey } from "@/lib/errors";
import { formatNumber, formatTime } from "@/lib/format";
import { whatsappHref } from "@/lib/links";
import { cn } from "@/lib/utils";
import { CARE_NEEDS, MOODS } from "@/lib/validations/care";

export const MOOD_EMOJI: Record<(typeof MOODS)[number], string> = {
  great: "😄",
  good: "🙂",
  okay: "😐",
  tired: "😩",
  sad: "😢",
  stressed: "😣",
};

// -------------------------------------------------------------------- mood ---
export function MoodPicker({ current }: { current: (typeof MOODS)[number] | null }) {
  const t = useTranslations("care.mood");
  const te = useTranslations("errors");
  const [mood, setMood] = useOptimistic(current);
  const [, startTransition] = useTransition();
  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">{mood ? t("thanks") : t("question")}</p>
      <div className="grid grid-cols-6 gap-1.5" role="radiogroup" aria-label={t("question")}>
        {MOODS.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mood === m}
            aria-label={t(`levels.${m}`)}
            onClick={() =>
              startTransition(async () => {
                setMood(m);
                const result = await saveMood(m);
                if (!result.ok) toast.error(te(result.error));
              })
            }
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl border py-2 text-2xl transition-transform active:scale-95",
              mood === m ? "border-primary bg-mint-soft" : "hover:bg-accent",
            )}
          >
            <span aria-hidden="true">{MOOD_EMOJI[m]}</span>
            <span className="text-[0.65rem] text-muted-foreground">{t(`levels.${m}`)}</span>
          </button>
        ))}
      </div>
      {(mood === "sad" || mood === "stressed") && (
        <p className="rounded-xl bg-sky-soft px-3 py-2 text-sm">
          {t("gentle")}{" "}
          <Link href="/care/mind" className="font-medium underline underline-offset-2">
            {t("talk")}
          </Link>
        </p>
      )}
    </div>
  );
}

// ----------------------------------------------------------- SOS / sick mode ---
function locate(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: Number(p.coords.latitude.toFixed(6)), lng: Number(p.coords.longitude.toFixed(6)) }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  });
}

export function AlertButtons({ hasMess }: { hasMess: boolean }) {
  const t = useTranslations("care.alert");
  const [type, setType] = useState<"sos" | "sick" | null>(null);
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setType("sos")}
          className="flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-2xl bg-coral px-3 py-4 text-white shadow-lg shadow-coral/25 transition-transform active:scale-[0.98]"
        >
          <Siren className="size-7" aria-hidden="true" />
          <span className="text-lg font-bold">{t("sos")}</span>
          <span className="text-xs opacity-90">{t("sosHint")}</span>
        </button>
        <button
          type="button"
          onClick={() => setType("sick")}
          className="flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-2xl border border-marigold/40 bg-marigold-soft px-3 py-4 transition-transform active:scale-[0.98]"
        >
          <Thermometer className="size-7 text-marigold" aria-hidden="true" />
          <span className="text-lg font-bold">{t("sick")}</span>
          <span className="text-xs text-muted-foreground">{t("sickHint")}</span>
        </button>
      </div>
      {type && <AlertDialogFlow key={type} type={type} hasMess={hasMess} onClose={() => setType(null)} />}
    </>
  );
}

function AlertDialogFlow({ type, hasMess, onClose }: { type: "sos" | "sick"; hasMess: boolean; onClose: () => void }) {
  const t = useTranslations("care.alert");
  const [message, setMessage] = useState("");
  const [needs, setNeeds] = useState<(typeof CARE_NEEDS)[number][]>([]);
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [place, setPlace] = useState("");
  const [notifyMess, setNotifyMess] = useState(hasMess);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<ErrorKey | null>(null);
  const [sent, setSent] = useState<RaisedAlert | null>(null);
  const [pending, startTransition] = useTransition();
  const mapLink = point ? `https://maps.google.com/?q=${point.lat},${point.lng}` : "";
  const outsideText = [type === "sos" ? t("outsideSos") : t("outsideSick"), message, place, mapLink].filter(Boolean).join("\n");

  return (
    <ResponsiveDialog open onOpenChange={(o) => !o && onClose()} title={type === "sos" ? t("sosTitle") : t("sickTitle")} description={sent ? undefined : type === "sos" ? t("sosBody") : t("sickBody")}>
      {sent ? (
        <div className="grid gap-4">
          <p className="flex items-start gap-2 rounded-xl bg-mint-soft p-3 text-sm">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-mint" aria-hidden="true" />
            {sent.notifiedInApp > 0 ? t("sentInApp", { count: sent.notifiedInApp }) : t("sentNobody")}
          </p>
          {sent.external.length > 0 && (
            <div className="grid gap-2">
              <p className="text-sm font-medium">{t("alsoTell")}</p>
              {sent.external.map((c) => (
                <div key={c.phone} className="flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {c.name}
                    {c.relation && <span className="text-muted-foreground"> · {c.relation}</span>}
                  </span>
                  <Button asChild size="sm" variant="outline">
                    <a href={whatsappHref(c.phone, outsideText)} target="_blank" rel="noreferrer">
                      <MessageCircle className="size-4" aria-hidden="true" />
                      WhatsApp
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <a href={`sms:${c.phone}?body=${encodeURIComponent(outsideText)}`}>{t("sms")}</a>
                  </Button>
                  <Button asChild size="icon-sm" variant="ghost">
                    <a href={`tel:${c.phone}`} aria-label={t("callName", { name: c.name })}>
                      <Phone className="size-4" />
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          )}
          {type === "sos" && (
            <Button asChild className="h-12 bg-coral text-white hover:bg-coral/90">
              <a href="tel:999">
                <PhoneCall className="size-5" aria-hidden="true" />
                {t("call999")}
              </a>
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            {t("close")}
          </Button>
        </div>
      ) : (
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              setError(null);
              const result = await raiseAlert({ type, message, needs, lat: point?.lat ?? null, lng: point?.lng ?? null, locationText: place, notifyMess });
              if (!result.ok) return setError(result.error);
              setSent(result.data);
            });
          }}
        >
          {type === "sick" && (
            <div className="grid gap-1.5">
              <p className="text-sm font-medium">{t("needs")}</p>
              <div className="flex flex-wrap gap-1.5">
                {CARE_NEEDS.map((n) => {
                  const on = needs.includes(n);
                  return (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setNeeds((v) => (on ? v.filter((x) => x !== n) : [...v, n]))}
                      className={cn(
                        "h-10 rounded-full border px-3.5 text-sm transition-colors",
                        on ? "border-marigold/60 bg-marigold-soft font-medium" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t(`needList.${n}`)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={500} placeholder={type === "sos" ? t("sosPlaceholder") : t("sickPlaceholder")} aria-label={t("message")} />
          <div className="grid gap-2 rounded-xl border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <MapPin className="size-4" aria-hidden="true" />
                {point ? t("locationAdded") : t("location")}
              </p>
              <Button
                type="button"
                size="sm"
                variant={point ? "ghost" : "outline"}
                disabled={locating}
                onClick={async () => {
                  if (point) return setPoint(null);
                  setLocating(true);
                  const p = await locate();
                  setLocating(false);
                  if (p) setPoint(p);
                  else toast.error(t("locationFailed"));
                }}
              >
                {point ? <X className="size-4" aria-hidden="true" /> : <LocateFixed className="size-4" aria-hidden="true" />}
                {point ? t("removeLocation") : t("shareLocation")}
              </Button>
            </div>
            <Input value={place} onChange={(e) => setPlace(e.target.value)} maxLength={200} placeholder={t("placePlaceholder")} aria-label={t("place")} />
          </div>
          {hasMess && (
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2.5">
              <span className="text-sm">{t("notifyMess")}</span>
              <Switch checked={notifyMess} onCheckedChange={setNotifyMess} />
            </label>
          )}
          <p className="text-xs text-muted-foreground">{t("whoGetsIt")}</p>
          <FormError error={error} />
          <LoadingButton type="submit" loading={pending} className={cn("h-12 text-base", type === "sos" && "bg-coral text-white hover:bg-coral/90")}>
            {type === "sos" ? t("sendSos") : t("sendSick")}
          </LoadingButton>
        </form>
      )}
    </ResponsiveDialog>
  );
}

export function MyAlert({ id, type, responses, recipients }: { id: string; type: "sos" | "sick"; responses: number; recipients: number }) {
  const t = useTranslations("care.alert");
  const te = useTranslations("errors");
  const [pending, startTransition] = useTransition();
  return (
    <div className={cn("flex flex-wrap items-center gap-3 rounded-2xl border p-4", type === "sos" ? "border-coral/40 bg-coral-soft" : "border-marigold/40 bg-marigold-soft")}>
      {type === "sos" ? <Siren className="size-5 text-coral" aria-hidden="true" /> : <Thermometer className="size-5 text-marigold" aria-hidden="true" />}
      <div className="min-w-0 flex-1">
        <p className="font-medium">{type === "sos" ? t("mySosActive") : t("mySickActive")}</p>
        <p className="text-sm text-muted-foreground">{t("responses", { responses, recipients })}</p>
      </div>
      <div className="flex gap-2">
        <Button asChild size="sm" variant="ghost">
          <Link href={`/care/alerts/${id}`}>{t("details")}</Link>
        </Button>
        <LoadingButton
          size="sm"
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await resolveAlert(id);
              if (!result.ok) return void toast.error(te(result.error));
              toast.success(t("resolved"));
            })
          }
        >
          {t("imOk")}
        </LoadingButton>
      </div>
    </div>
  );
}

export function RespondButtons({ alertId, current }: { alertId: string; current: string | null }) {
  const t = useTranslations("care.alert");
  const te = useTranslations("errors");
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      {(["on_my_way", "called", "acknowledged"] as const).map((r) => (
        <Button
          key={r}
          size="sm"
          variant={current === r ? "default" : "outline"}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await respondToAlert(alertId, r);
              if (!result.ok) return void toast.error(te(result.error));
              toast.success(t("responseSent"));
            })
          }
        >
          {t(`respond.${r}`)}
        </Button>
      ))}
    </div>
  );
}

// ------------------------------------------------------- reached-home check ---
const DURATIONS = [30, 60, 120, 180, 360] as const;

export function CheckinCard({ active }: { active: { id: string; label: string; expected_by: string; status: string } | null }) {
  const t = useTranslations("care.checkin");
  const te = useTranslations("errors");
  const locale = useLocale();
  const [label, setLabel] = useState("");
  const [minutes, setMinutes] = useState<number>(60);
  const [pending, startTransition] = useTransition();

  if (active) {
    const overdue = active.status === "overdue";
    return (
      <div className={cn("grid gap-3 rounded-2xl border p-4", overdue ? "border-coral/40 bg-coral-soft" : "bg-card")}>
        <p className="flex items-center gap-2 font-medium">
          <Home className="size-5 text-mint" aria-hidden="true" />
          {overdue ? t("overdue") : t("running")}
        </p>
        <p className="text-sm">
          {active.label} · {t("expected", { time: formatTime(active.expected_by, locale) })}
        </p>
        <div className="flex flex-wrap gap-2">
          <LoadingButton
            loading={pending}
            className="h-11 flex-1"
            onClick={() =>
              startTransition(async () => {
                const result = await finishCheckin(active.id, "arrived");
                if (!result.ok) return void toast.error(te(result.error));
                toast.success(t("arrivedToast"));
              })
            }
          >
            <CheckCircle2 className="size-4" aria-hidden="true" />
            {t("arrived")}
          </LoadingButton>
          <Button
            variant="ghost"
            className="h-11"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await finishCheckin(active.id, "cancelled");
                if (!result.ok) toast.error(te(result.error));
              })
            }
          >
            {t("cancel")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="grid gap-3 rounded-2xl border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await startCheckin({ label: label || t("defaultLabel"), minutes });
          if (!result.ok) return void toast.error(te(result.error));
          toast.success(t("started"));
          setLabel("");
        });
      }}
    >
      <div>
        <p className="flex items-center gap-2 font-medium">
          <Home className="size-5 text-mint" aria-hidden="true" />
          {t("title")}
        </p>
        <p className="text-sm text-muted-foreground">{t("body")}</p>
      </div>
      <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={100} placeholder={t("labelPlaceholder")} aria-label={t("label")} />
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("within")}>
        {DURATIONS.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={minutes === m}
            onClick={() => setMinutes(m)}
            className={cn("h-9 rounded-full border px-3 text-sm", minutes === m ? "border-primary/50 bg-mint-soft font-medium" : "text-muted-foreground")}
          >
            {m < 60 ? t("minutes", { count: formatNumber(m, locale) }) : t("hours", { count: formatNumber(m / 60, locale) })}
          </button>
        ))}
      </div>
      <LoadingButton type="submit" loading={pending} variant="outline">
        {t("start")}
      </LoadingButton>
    </form>
  );
}

// -------------------------------------------------------------------- water ---
export function WaterCard({ glasses, goal }: { glasses: number; goal: number }) {
  const t = useTranslations("care.water");
  const te = useTranslations("errors");
  const locale = useLocale();
  const [state, setState] = useOptimistic({ glasses, goal });
  const [, startTransition] = useTransition();
  const set = (next: number) =>
    startTransition(async () => {
      setState({ glasses: next, goal: state.goal });
      const result = await setWater(next, state.goal);
      if (!result.ok) toast.error(te(result.error));
    });
  const pct = Math.min(100, Math.round((state.glasses / state.goal) * 100));
  return (
    <div className="grid gap-3 rounded-2xl border bg-card p-4">
      <p className="flex items-center gap-2 font-medium">
        <Droplet className="size-5 text-sky" aria-hidden="true" />
        {t("title")}
      </p>
      <div className="flex items-center gap-3">
        <Button size="icon" variant="outline" aria-label={t("less")} disabled={state.glasses <= 0} onClick={() => set(state.glasses - 1)}>
          <Minus className="size-4" />
        </Button>
        <div className="flex-1 text-center">
          <p className="text-2xl font-semibold">
            {formatNumber(state.glasses, locale)}
            <span className="text-base font-normal text-muted-foreground"> / {formatNumber(state.goal, locale)}</span>
          </p>
          <p className="text-xs text-muted-foreground">{t("glasses")}</p>
        </div>
        <Button size="icon" aria-label={t("more")} disabled={state.glasses >= 30} onClick={() => set(state.glasses + 1)}>
          <Plus className="size-4" />
        </Button>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-sky-soft" role="progressbar" aria-valuenow={state.glasses} aria-valuemin={0} aria-valuemax={state.goal} aria-label={t("title")}>
        <div className="h-full rounded-full bg-sky transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      {state.glasses >= state.goal && <p className="text-center text-sm text-mint">{t("goalMet")}</p>}
    </div>
  );
}

// ------------------------------------------------------------- call home ---
export function CallHomeCard({ daysAgo }: { daysAgo: number | null }) {
  const t = useTranslations("care.family");
  const te = useTranslations("errors");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  return (
    <div className="grid gap-3 rounded-2xl border bg-card p-4">
      <p className="flex items-center gap-2 font-medium">
        <PhoneCall className="size-5 text-mint" aria-hidden="true" />
        {t("title")}
      </p>
      <p className="text-sm text-muted-foreground">
        {daysAgo === null ? t("never") : daysAgo === 0 ? t("today") : t("daysAgo", { days: formatNumber(daysAgo, locale) })}
        {daysAgo !== null && daysAgo >= 4 && ` ${t("nudge")}`}
      </p>
      <LoadingButton
        variant="outline"
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await logFamilyCall();
            if (!result.ok) return void toast.error(te(result.error));
            toast.success(t("logged"));
          })
        }
      >
        {t("called")}
      </LoadingButton>
    </div>
  );
}

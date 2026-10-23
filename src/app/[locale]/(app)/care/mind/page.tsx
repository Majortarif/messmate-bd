import { HeartHandshake, Phone, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { CareNav } from "@/components/care/care-nav";
import { CallHomeCard, MOOD_EMOJI, MoodPicker } from "@/components/care/hub";
import { PageHeader } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { requireOnboarded } from "@/lib/dal";
import { addDays } from "@/lib/month";
import { dhakaDaysAgo, dhakaToday, formatDate, formatNumber, formatTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("care.mind");
  return { title: t("title") };
}

const LOW = new Set(["sad", "stressed", "tired"]);

export default async function MindPage() {
  await requireOnboarded();
  const today = dhakaToday();
  const from = addDays(today, -29);
  const supabase = await createClient();
  const [moodsRes, callsRes, helplinesRes, t, tm, locale] = await Promise.all([
    supabase.from("mood_checkins").select("checkin_date, mood, note").gte("checkin_date", from).order("checkin_date"),
    supabase.from("family_call_logs").select("id, called_at, person, note").order("called_at", { ascending: false }).limit(8),
    supabase.from("emergency_places").select("id, kind, name_bn, name_en, phone, notes, is_24h").in("kind", ["mental_health", "helpline"]).order("sort_order"),
    getTranslations("care.mind"),
    getTranslations("care.mood"),
    getLocale(),
  ]);
  const moods = new Map((moodsRes.data ?? []).map((m) => [m.checkin_date, m]));
  const days = Array.from({ length: 30 }, (_, i) => addDays(from, i));
  const logged = (moodsRes.data ?? []).length;
  const lowDays = (moodsRes.data ?? []).filter((m) => LOW.has(m.mood)).length;
  const recentLow = days.slice(-7).filter((d) => {
    const m = moods.get(d);
    return m && LOW.has(m.mood);
  }).length;
  const calls = callsRes.data ?? [];
  const lastCall = calls[0]?.called_at ?? null;
  const lastCallDays = lastCall ? dhakaDaysAgo(lastCall) : null;

  return (
    <div className="grid gap-5">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <CareNav active="mind" />

      <section className="grid gap-4 rounded-2xl border bg-card p-4 sm:p-5">
        <MoodPicker current={moods.get(today)?.mood ?? null} />
      </section>

      {recentLow >= 3 && (
        <section className="flex items-start gap-3 rounded-2xl border border-sky/30 bg-sky-soft p-4">
          <HeartHandshake className="mt-0.5 size-5 shrink-0 text-sky" aria-hidden="true" />
          <div>
            <p className="font-medium">{t("lowWeekTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("lowWeekBody")}</p>
          </div>
        </section>
      )}

      <section className="grid gap-3 rounded-2xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">{t("monthTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("monthStats", { logged: formatNumber(logged, locale), low: formatNumber(lowDays, locale) })}</p>
        </div>
        <ol className="grid grid-cols-6 gap-1.5 sm:grid-cols-10" aria-label={t("monthTitle")}>
          {days.map((d) => {
            const m = moods.get(d);
            return (
              <li
                key={d}
                title={m ? `${formatDate(d, locale, { day: "numeric", month: "short" })} · ${tm(`levels.${m.mood}`)}` : formatDate(d, locale, { day: "numeric", month: "short" })}
                className={cn(
                  "flex aspect-square flex-col items-center justify-center rounded-xl border text-lg",
                  d === today && "border-primary",
                  !m && "border-dashed text-muted-foreground/40",
                )}
              >
                <span aria-hidden="true">{m ? MOOD_EMOJI[m.mood] : "·"}</span>
                <span className="text-[0.6rem] text-muted-foreground">{formatDate(d, locale, { day: "numeric" })}</span>
                <span className="sr-only">{m ? tm(`levels.${m.mood}`) : t("noEntry")}</span>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="grid content-start gap-3 rounded-2xl border bg-card p-4 sm:p-5">
          <h2 className="font-semibold">{t("helplines")}</h2>
          <p className="text-sm text-muted-foreground">{t("helplinesBody")}</p>
          <ul className="grid gap-2">
            {(helplinesRes.data ?? []).map((h) => (
              <li key={h.id} className="flex items-center gap-3 rounded-xl border px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{locale === "en" ? h.name_en : h.name_bn}</p>
                  {h.notes && <p className="text-xs text-muted-foreground">{h.notes}</p>}
                </div>
                {h.phone && (
                  <Button asChild size="sm">
                    <a href={`tel:${h.phone.replace(/[^\d+]/g, "")}`}>
                      <Phone className="size-4" aria-hidden="true" />
                      <span className="num">{h.phone}</span>
                    </a>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>

        <div className="grid content-start gap-4">
          <CallHomeCard daysAgo={lastCallDays} />
          {calls.length > 0 && (
            <section className="rounded-2xl border bg-card p-4">
              <h2 className="mb-2 text-sm font-semibold">{t("callLog")}</h2>
              <ul className="grid gap-1 text-sm text-muted-foreground">
                {calls.map((c) => (
                  <li key={c.id}>
                    {formatDate(c.called_at, locale, { weekday: "short", day: "numeric", month: "short" })}, {formatTime(c.called_at, locale)}
                    {c.person && ` · ${c.person}`}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="rounded-2xl border bg-card p-4">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="size-4 text-marigold" aria-hidden="true" />
              {t("smallThings")}
            </h2>
            <ul className="grid gap-1.5 text-sm text-muted-foreground">
              <li>• {t("tip1")}</li>
              <li>• {t("tip2")}</li>
              <li>• {t("tip3")}</li>
              <li>• {t("tip4")}</li>
            </ul>
          </section>
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground">{t("privacy")}</p>
    </div>
  );
}

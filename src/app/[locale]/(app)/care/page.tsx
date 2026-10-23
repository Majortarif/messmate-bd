import { ArrowRight, BellRing, HeartHandshake, Siren, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { CareNav } from "@/components/care/care-nav";
import { AlertButtons, CallHomeCard, CheckinCard, MoodPicker, MyAlert, RespondButtons, WaterCard } from "@/components/care/hub";
import { PageHeader } from "@/components/shared/states";
import { Link } from "@/i18n/navigation";
import { requireOnboarded } from "@/lib/dal";
import { dhakaDaysAgo, formatNumber, formatTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { CareOverview } from "@/types/app";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("care");
  return { title: t("title") };
}

export default async function CareHubPage() {
  const viewer = await requireOnboarded();
  const supabase = await createClient();
  const [result, t, ta, locale] = await Promise.all([
    supabase.rpc("get_care_overview"),
    getTranslations("care"),
    getTranslations("care.alert"),
    getLocale(),
  ]);
  if (result.error) throw new Error(result.error.message);
  const c = result.data as unknown as CareOverview;
  const hasMess = viewer.context.membership?.status === "active" || viewer.context.membership?.status === "inactive";
  const firstName = viewer.context.profile?.full_name?.split(" ")[0] ?? "";
  const lastCallDays = c.last_family_call ? dhakaDaysAgo(c.last_family_call) : null;

  return (
    <div className="grid gap-5">
      <PageHeader title={t("title")} description={t("subtitle", { name: firstName })} />
      <CareNav active="hub" />

      {c.alerts_for_me.length > 0 && (
        <section className="grid gap-2" aria-label={t("othersNeed")}>
          {c.alerts_for_me.map((a) => (
            <div key={a.id} className={cn("grid gap-3 rounded-2xl border p-4", a.type === "sos" ? "border-coral/50 bg-coral-soft" : "border-marigold/40 bg-marigold-soft")}>
              <div className="flex items-start gap-3">
                <Siren className={cn("mt-0.5 size-5 shrink-0", a.type === "sos" ? "text-coral" : "text-marigold")} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{a.type === "sos" ? ta("needsHelpNow", { name: a.name }) : ta("isSick", { name: a.name })}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatTime(a.created_at, locale)}
                    {a.needs.length > 0 && ` · ${a.needs.map((n) => ta(`needList.${n as "light_food"}`)).join(", ")}`}
                  </p>
                  {a.message && <p className="mt-1 text-sm">“{a.message}”</p>}
                </div>
                <Link href={`/care/alerts/${a.id}`} className="shrink-0 text-sm font-medium underline-offset-2 hover:underline">
                  {ta("details")}
                </Link>
              </div>
              <RespondButtons alertId={a.id} current={a.my_response} />
            </div>
          ))}
        </section>
      )}

      {c.my_alerts.map((a) => (
        <MyAlert key={a.id} id={a.id} type={a.type} responses={a.responses} recipients={a.recipients} />
      ))}

      <section className="grid gap-3 rounded-2xl border bg-card p-4 sm:p-5">
        <AlertButtons hasMess={hasMess} />
        {c.contacts === 0 && (
          <Link href="/care/emergency#contacts" className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2.5 text-sm">
            <UsersRound className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="flex-1">{t("addContacts")}</span>
            <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
          </Link>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card p-4">
          <MoodPicker current={c.mood_today?.mood ?? null} />
        </section>
        <CheckinCard active={c.active_checkin} />
        <WaterCard glasses={c.water_today?.glasses ?? 0} goal={c.water_today?.goal ?? c.water_goal} />
        <CallHomeCard daysAgo={lastCallDays} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/care/reminders" className="card-hover flex items-center gap-3 rounded-2xl border bg-card p-4">
          <span className="flex size-10 items-center justify-center rounded-xl bg-sky-soft text-sky">
            <BellRing className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{t("tiles.reminders")}</span>
            <span className="block text-sm text-muted-foreground">{t("tiles.remindersBody", { count: formatNumber(c.reminders_active, locale) })}</span>
          </span>
          <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
        </Link>
        <Link href="/care/mind" className="card-hover flex items-center gap-3 rounded-2xl border bg-card p-4">
          <span className="flex size-10 items-center justify-center rounded-xl bg-mint-soft text-mint">
            <HeartHandshake className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{t("tiles.mind")}</span>
            <span className="block text-sm text-muted-foreground">{t("tiles.mindBody")}</span>
          </span>
          <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
        </Link>
      </div>
      <p className="text-center text-xs text-muted-foreground">{t("privacy")}</p>
    </div>
  );
}

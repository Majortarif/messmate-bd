import { CalendarDays, Cigarette, CigaretteOff, Moon, PhoneOff, Sparkles, UsersRound, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { ContactButtons } from "@/components/community/bits";
import { HousingTabs } from "@/components/housing/housing-tabs";
import { RoommateForm } from "@/components/housing/roommate-form";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { ToneBadge } from "@/components/shared/tone-badge";
import { getAreas } from "@/lib/community";
import { requireOnboarded } from "@/lib/dal";
import { formatDate, formatNumber, formatTaka, initials } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { RoommateInput } from "@/lib/validations/community";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("housing.roommates");
  return { title: t("title") };
}

export default async function RoommatesPage() {
  const viewer = await requireOnboarded();
  const supabase = await createClient();
  const [{ data: profile }, { data: prefs }, { data: me }, areas, t, locale] = await Promise.all([
    supabase.from("roommate_profiles").select("*").eq("user_id", viewer.id).maybeSingle(),
    supabase.from("roommate_area_prefs").select("area_id").eq("user_id", viewer.id),
    supabase.from("profiles").select("gender, occupation, phone").eq("id", viewer.id).maybeSingle(),
    getAreas(),
    getTranslations("housing.roommates"),
    getLocale(),
  ]);
  const matches = profile?.is_active ? ((await supabase.rpc("roommate_matches", { p_limit: 30 })).data ?? []) : [];

  const initial: RoommateInput = profile
    ? {
        isActive: profile.is_active,
        gender: profile.gender,
        occupation: profile.occupation,
        budgetMin: Number(profile.budget_min),
        budgetMax: Number(profile.budget_max),
        smoking: profile.smoking,
        sleepSchedule: profile.sleep_schedule as RoommateInput["sleepSchedule"],
        cleanliness: profile.cleanliness,
        foodPref: profile.food_pref as RoommateInput["foodPref"],
        guestsOk: profile.guests_ok,
        moveInDate: profile.move_in_date ?? "",
        about: profile.about ?? "",
        contactPhone: profile.contact_phone ?? "",
        showPhone: profile.show_phone,
        areaIds: (prefs ?? []).map((p) => p.area_id),
      }
    : {
        isActive: true,
        gender: me?.gender ?? "male",
        occupation: me?.occupation ?? "student",
        budgetMin: 3000,
        budgetMax: 6000,
        smoking: false,
        sleepSchedule: "flexible",
        cleanliness: 3,
        foodPref: "any",
        guestsOk: true,
        moveInDate: "",
        about: "",
        contactPhone: me?.phone ?? viewer.context.profile?.phone ?? "",
        showPhone: false,
        areaIds: [],
      };

  return (
    <div className="grid gap-5">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <HousingTabs active="roommates" />

      <details open={!profile} className="group rounded-2xl border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
          <span>
            <span className="block font-semibold">{profile ? t("myProfile") : t("createProfile")}</span>
            <span className="block text-sm text-muted-foreground">
              {profile ? (profile.is_active ? t("profileVisible") : t("profileHidden")) : t("createProfileBody")}
            </span>
          </span>
          <span className="shrink-0 rounded-lg border px-3 py-1.5 text-sm group-open:hidden">{t("edit")}</span>
        </summary>
        <div className="border-t p-4 sm:p-5">
          <RoommateForm areas={areas} initial={initial} />
        </div>
      </details>

      <section className="grid gap-3">
        <div>
          <h2 className="font-semibold">{t("matchesTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("matchesBody")}</p>
        </div>
        {!profile?.is_active ? (
          <EmptyState icon={UsersRound} title={t("needProfile")} body={t("needProfileBody")} className="rounded-2xl border bg-card py-10" />
        ) : matches.length === 0 ? (
          <EmptyState icon={UsersRound} title={t("noMatches")} body={t("noMatchesBody")} className="rounded-2xl border bg-card py-10" />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {matches.map((m) => {
              const areaNames = (locale === "en" ? m.area_names_en : m.area_names) ?? [];
              return (
                <li key={m.user_id} className="grid gap-3 rounded-2xl border bg-card p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-mint-soft font-semibold text-mint">
                      {initials(m.full_name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{m.full_name}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {[t(`occupation.${m.occupation}`), m.institution].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <ScoreRing score={m.score} text={formatNumber(m.score, locale)} label={t("score", { score: formatNumber(m.score, locale) })} />
                  </div>
                  {m.reasons.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5" aria-label={t("reasonsLabel")}>
                      {m.reasons.map((r) => (
                        <li key={r}>
                          <ToneBadge tone="mint">
                            <Sparkles className="size-3" aria-hidden="true" />
                            {t(`reasons.${r as "budget"}`)}
                          </ToneBadge>
                        </li>
                      ))}
                    </ul>
                  )}
                  <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
                    <li className="flex items-center gap-1.5">
                      <Wallet className="size-4 shrink-0" aria-hidden="true" />
                      {formatTaka(m.budget_min, locale)}–{formatTaka(m.budget_max, locale)}
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Moon className="size-4 shrink-0" aria-hidden="true" />
                      {t(`sleep.${m.sleep_schedule as "early"}`)}
                    </li>
                    <li className="flex items-center gap-1.5">
                      {m.smoking ? <Cigarette className="size-4 shrink-0" aria-hidden="true" /> : <CigaretteOff className="size-4 shrink-0" aria-hidden="true" />}
                      {m.smoking ? t("smokes") : t("noSmoking")}
                    </li>
                    {m.move_in_date && (
                      <li className="flex items-center gap-1.5">
                        <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
                        {formatDate(m.move_in_date, locale, { day: "numeric", month: "short" })}
                      </li>
                    )}
                  </ul>
                  {areaNames.length > 0 && <p className="text-sm">{t("wantsAreas", { areas: areaNames.join(", ") })}</p>}
                  {m.about && <p className="line-clamp-3 text-sm text-muted-foreground">“{m.about}”</p>}
                  {m.contact_phone ? (
                    <ContactButtons phone={m.contact_phone} name={m.full_name} message={t("whatsappText")} />
                  ) : (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <PhoneOff className="size-3.5" aria-hidden="true" />
                      {t("phoneHidden")}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">{t("howScored")}</p>
      </section>
    </div>
  );
}

/** Compatibility as a ring; the number is printed inside, so colour is not the only cue. */
function ScoreRing({ score, text, label }: { score: number; text: string; label: string }) {
  const tone = score >= 75 ? "var(--mint)" : score >= 50 ? "var(--marigold)" : "var(--muted-foreground)";
  return (
    <div
      className={cn("relative flex size-12 shrink-0 items-center justify-center rounded-full")}
      style={{ background: `conic-gradient(${tone} ${score * 3.6}deg, var(--muted) 0deg)` }}
      role="img"
      aria-label={label}
    >
      <span className="flex size-9 items-center justify-center rounded-full bg-card text-xs font-semibold">{text}%</span>
    </div>
  );
}

import { CalendarHeart, Clock, MapPin, Phone, Users } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { CareNav } from "@/components/care/care-nav";
import { ArchiveEventButton, NewEventButton, RsvpButton } from "@/components/care/community-care";
import { ReportButton } from "@/components/community/interactive";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { ToneBadge } from "@/components/shared/tone-badge";
import { areaName, getAreas, getDisplayNames } from "@/lib/community";
import { requireOnboarded } from "@/lib/dal";
import { formatDate, formatNumber, formatTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("care.events");
  return { title: t("title") };
}

export default async function EventsPage() {
  const viewer = await requireOnboarded();
  const supabase = await createClient();
  const now = new Date().toISOString();
  const [{ data, error }, areas, t, tt, locale] = await Promise.all([
    supabase
      .from("community_events")
      .select("*, rsvps:event_rsvps(user_id)")
      .eq("status", "approved")
      .gt("starts_at", now)
      .order("starts_at")
      .limit(60),
    getAreas(),
    getTranslations("care.events"),
    getTranslations("eventTypes"),
    getLocale(),
  ]);
  if (error) throw new Error(error.message);
  const events = data ?? [];
  const names = await getDisplayNames(supabase, events.map((e) => e.organizer_id));
  const areaById = new Map(areas.map((a) => [a.id, a]));

  return (
    <div className="grid gap-5">
      <PageHeader title={t("title")} description={t("subtitle")} actions={<NewEventButton areas={areas} />} />
      <CareNav active="events" />
      {events.length === 0 ? (
        <EmptyState icon={CalendarHeart} title={t("empty")} body={t("emptyBody")} action={<NewEventButton areas={areas} />} className="rounded-2xl border bg-card py-12" />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {events.map((e) => {
            const mine = e.organizer_id === viewer.id;
            const going = (e.rsvps ?? []).some((r) => r.user_id === viewer.id);
            const full = e.max_people !== null && e.rsvp_count >= e.max_people;
            return (
              <li key={e.id} className="grid gap-3 rounded-2xl border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className="flex w-14 shrink-0 flex-col items-center rounded-xl bg-mint-soft py-2 text-mint">
                    <span className="text-xs">{formatDate(e.starts_at, locale, { month: "short" })}</span>
                    <span className="text-xl font-bold">{formatDate(e.starts_at, locale, { day: "numeric" })}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <ToneBadge tone="sky">{tt(e.event_type)}</ToneBadge>
                    <h2 className="mt-1 font-semibold leading-snug">{e.title}</h2>
                    <p className="text-xs text-muted-foreground">{t("by", { name: mine ? t("you") : names.get(e.organizer_id)?.name ?? t("someone") })}</p>
                  </div>
                </div>
                {e.description && <p className="line-clamp-4 whitespace-pre-line text-sm">{e.description}</p>}
                <ul className="grid gap-1 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Clock className="size-4 shrink-0" aria-hidden="true" />
                    {formatDate(e.starts_at, locale, { weekday: "long" })}, {formatTime(e.starts_at, locale)}
                    {e.ends_at && ` – ${formatTime(e.ends_at, locale)}`}
                  </li>
                  {(e.venue || e.area_id) && (
                    <li className="flex items-center gap-2">
                      <MapPin className="size-4 shrink-0" aria-hidden="true" />
                      {[e.venue, e.area_id ? areaName(areaById.get(e.area_id), locale) : null].filter(Boolean).join(", ")}
                    </li>
                  )}
                  <li className="flex items-center gap-2">
                    <Users className="size-4 shrink-0" aria-hidden="true" />
                    {e.max_people
                      ? t("spots", { going: formatNumber(e.rsvp_count, locale), max: formatNumber(e.max_people, locale) })
                      : t("goingCount", { count: formatNumber(e.rsvp_count, locale) })}
                  </li>
                  {e.contact_phone && (
                    <li>
                      <a href={`tel:${e.contact_phone}`} className="inline-flex items-center gap-2 hover:text-foreground">
                        <Phone className="size-4 shrink-0" aria-hidden="true" />
                        {e.contact_phone}
                      </a>
                    </li>
                  )}
                </ul>
                <div className="flex flex-wrap items-center gap-2">
                  {!mine && <RsvpButton eventId={e.id} going={going} full={full} />}
                  {mine ? <ArchiveEventButton id={e.id} /> : <ReportButton kind="event" id={e.id} title={e.title} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">{t("safety")}</p>
    </div>
  );
}

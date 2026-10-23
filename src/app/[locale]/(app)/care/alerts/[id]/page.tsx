import { ArrowLeft, CheckCircle2, Clock3, MapPin, Navigation, Phone, Siren, Thermometer } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { GeoMap } from "@/components/community/geo-map";
import { MyAlert, RespondButtons } from "@/components/care/hub";
import { ToneBadge } from "@/components/shared/tone-badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requireOnboarded } from "@/lib/dal";
import { formatDate, formatTime } from "@/lib/format";
import { directionsHref } from "@/lib/links";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { CareAlertDetail } from "@/types/app";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("care.alert");
  return { title: t("pageTitle"), robots: { index: false } };
}

export default async function CareAlertPage({ params }: PageProps<"/[locale]/care/alerts/[id]">) {
  await requireOnboarded();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const [result, t, locale] = await Promise.all([supabase.rpc("get_care_alert", { p_alert_id: id }), getTranslations("care.alert"), getLocale()]);
  if (result.error || !result.data) notFound();
  const a = result.data as unknown as CareAlertDetail;
  const sos = a.type === "sos";
  const open = a.status !== "resolved";
  const lat = a.lat === null ? null : Number(a.lat);
  const lng = a.lng === null ? null : Number(a.lng);
  const when = `${formatDate(a.created_at, locale, { day: "numeric", month: "short" })}, ${formatTime(a.created_at, locale)}`;

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href="/care">
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("backToCare")}
        </Link>
      </Button>

      <section className={cn("grid gap-3 rounded-2xl border p-5", open && (sos ? "border-coral/50 bg-coral-soft" : "border-marigold/40 bg-marigold-soft"))}>
        <div className="flex items-start gap-3">
          {sos ? <Siren className="size-7 shrink-0 text-coral" aria-hidden="true" /> : <Thermometer className="size-7 shrink-0 text-marigold" aria-hidden="true" />}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold">
              {a.is_owner ? (sos ? t("yourSos") : t("yourSick")) : sos ? t("needsHelpNow", { name: a.name }) : t("isSick", { name: a.name })}
            </h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock3 className="size-4" aria-hidden="true" />
              {when}
            </p>
          </div>
          <ToneBadge tone={open ? (a.status === "acknowledged" ? "marigold" : "coral") : "mint"}>{t(`status.${a.status}`)}</ToneBadge>
        </div>
        {a.message && <p className="text-base">“{a.message}”</p>}
        {a.needs.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {a.needs.map((n) => (
              <li key={n}>
                <ToneBadge tone="marigold">{t(`needList.${n as "light_food"}`)}</ToneBadge>
              </li>
            ))}
          </ul>
        )}
        {!a.is_owner && open && (
          <div className="grid gap-2 pt-1">
            {a.phone && (
              <Button asChild className="h-12 text-base">
                <a href={`tel:${a.phone}`}>
                  <Phone className="size-5" aria-hidden="true" />
                  {t("callName", { name: a.name })}
                </a>
              </Button>
            )}
            <RespondButtons alertId={a.id} current={a.my_response} />
          </div>
        )}
      </section>

      {a.is_owner && open && <MyAlert id={a.id} type={a.type} responses={a.recipients.filter((r) => r.response).length} recipients={a.recipients.length} />}

      {(a.location_text || (lat !== null && lng !== null)) && (
        <section className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-1.5 font-semibold">
              <MapPin className="size-4" aria-hidden="true" />
              {t("whereTitle")}
            </h2>
            {lat !== null && lng !== null && (
              <Button asChild size="sm" variant="ghost">
                <a href={directionsHref(lat, lng)} target="_blank" rel="noreferrer">
                  <Navigation className="size-4" aria-hidden="true" />
                  {t("directions")}
                </a>
              </Button>
            )}
          </div>
          {a.location_text && <p className="text-sm">{a.location_text}</p>}
          {lat !== null && lng !== null && <GeoMap pins={[{ id: a.id, lat, lng, title: a.name }]} label={t("whereTitle")} className="h-60" />}
        </section>
      )}

      <section className="grid gap-2">
        <h2 className="font-semibold">{t("whoKnows", { count: a.recipients.length })}</h2>
        {a.recipients.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("nobodyInApp")}</p>
        ) : (
          <ul className="grid gap-1.5">
            {a.recipients.map((r, i) => (
              <li key={`${r.name}-${i}`} className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-sm">
                <span className="min-w-0 flex-1 truncate">{r.name}</span>
                {r.response ? (
                  <span className="inline-flex items-center gap-1 text-mint">
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                    {t(`respond.${r.response as "on_my_way"}`)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">{t("noReplyYet")}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

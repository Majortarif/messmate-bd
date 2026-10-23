import { ArrowLeft, BadgeCheck, MapPin, MessageSquareText, Pencil, ShieldAlert, Tag } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { ContactButtons, Stars } from "@/components/community/bits";
import { ReportButton } from "@/components/community/interactive";
import { ReviewForm } from "@/components/services/service-forms";
import { EmptyState } from "@/components/shared/states";
import { type Tone, ToneBadge } from "@/components/shared/tone-badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { areaName, getAreas, getDisplayNames } from "@/lib/community";
import { requireOnboarded } from "@/lib/dal";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("services");
  return { title: t("detailTitle"), robots: { index: false } };
}

const STATUS_TONE: Record<string, Tone> = { pending: "marigold", approved: "mint", rejected: "coral", archived: "muted" };

export default async function ServicePage({ params }: PageProps<"/[locale]/services/[id]">) {
  const viewer = await requireOnboarded();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const [{ data: p }, { data: reviews }, areas, t, tc, ts, locale] = await Promise.all([
    supabase.from("service_providers").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("service_reviews")
      .select("user_id, rating, comment, updated_at")
      .eq("provider_id", id)
      .order("updated_at", { ascending: false })
      .limit(50),
    getAreas(),
    getTranslations("services"),
    getTranslations("serviceCategories"),
    getTranslations("moderationStatus"),
    getLocale(),
  ]);
  if (!p) notFound();

  const isOwner = p.owner_id === viewer.id;
  const list = reviews ?? [];
  const mine = list.find((r) => r.user_id === viewer.id) ?? null;
  const others = list.filter((r) => r.user_id !== viewer.id);
  const names = await getDisplayNames(supabase, others.map((r) => r.user_id));
  const area = p.area_id ? areaName(areas.find((a) => a.id === p.area_id), locale) : t("allDhaka");

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/services">
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t("back")}
          </Link>
        </Button>
        {isOwner && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/services/${p.id}/edit`}>
              <Pencil className="size-4" aria-hidden="true" />
              {t("edit")}
            </Link>
          </Button>
        )}
      </div>

      {isOwner && p.status !== "approved" && (
        <div className="flex items-start gap-3 rounded-2xl border border-marigold/30 bg-marigold-soft p-4 text-sm">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-marigold" aria-hidden="true" />
          {t(`ownerNote.${p.status === "rejected" ? "rejected" : p.status === "archived" ? "archived" : "pending"}`)}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="grid min-w-0 content-start gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <ToneBadge tone="sky">{tc(p.category)}</ToneBadge>
              {p.is_verified && (
                <ToneBadge tone="mint">
                  <BadgeCheck className="size-3.5" aria-hidden="true" />
                  {t("verifiedLong")}
                </ToneBadge>
              )}
              {isOwner && <ToneBadge tone={STATUS_TONE[p.status]}>{ts(p.status)}</ToneBadge>}
            </div>
            <h1 className="mt-2 text-2xl font-semibold sm:text-[1.7rem]">{p.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <Stars value={Number(p.avg_rating)} count={p.rating_count} size="md" />
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-4" aria-hidden="true" />
                {area}
              </span>
              {p.price_note && (
                <span className="inline-flex items-center gap-1">
                  <Tag className="size-4" aria-hidden="true" />
                  {p.price_note}
                </span>
              )}
            </div>
          </div>
          {p.description && <p className="whitespace-pre-line leading-relaxed">{p.description}</p>}

          <section className="grid gap-3">
            <h2 className="font-semibold">{t("reviewsTitle")}</h2>
            {!isOwner && p.status === "approved" && (
              <div className="rounded-2xl border bg-card p-4">
                <p className="mb-2 text-sm font-medium">{mine ? t("yourReview") : t("rateThem")}</p>
                <ReviewForm providerId={p.id} initial={mine ? { rating: mine.rating, comment: mine.comment ?? "" } : null} />
              </div>
            )}
            {others.length === 0 ? (
              <EmptyState icon={MessageSquareText} title={t("noReviews")} body={t("noReviewsBody")} className="rounded-2xl border bg-card py-8" />
            ) : (
              <ul className="grid gap-2">
                {others.map((r) => (
                  <li key={r.user_id} className="rounded-2xl border bg-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">{names.get(r.user_id)?.name ?? t("someone")}</p>
                      <Stars value={r.rating} />
                    </div>
                    {r.comment && <p className="mt-1.5 text-sm text-muted-foreground">{r.comment}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(r.updated_at, locale, { day: "numeric", month: "short", year: "numeric" })}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="grid gap-3 rounded-2xl border bg-card p-5">
            <p className="font-semibold">{t("contactTitle")}</p>
            <ContactButtons phone={p.phone} name={p.name} message={t("whatsappText")} />
            {p.alt_phone && (
              <a href={`tel:${p.alt_phone}`} className="text-sm text-muted-foreground hover:text-foreground">
                {t("altPhone", { phone: p.alt_phone })}
              </a>
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">{p.is_verified ? t("verifiedNote") : t("unverifiedNote")}</p>
          </div>
          {!isOwner && (
            <div className="mt-2 flex justify-end">
              <ReportButton kind="service" id={p.id} title={p.name} />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

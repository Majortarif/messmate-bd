import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { ModerationActions } from "@/components/admin/moderation-actions";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { Link } from "@/i18n/navigation";
import { requireSuperAdmin } from "@/lib/dal";
import { formatDate, formatNumber, formatTaka } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { MODERATION_KINDS, type ModerationKind } from "@/types/app";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.moderation");
  return { title: t("title") };
}

type Item = { id: string; title: string; meta: string[]; body: string | null; by: string | null; createdAt: string };

export default async function ModerationPage({ searchParams }: PageProps<"/[locale]/admin/moderation">) {
  await requireSuperAdmin();
  const raw = (await searchParams).kind;
  const kind: ModerationKind = MODERATION_KINDS.find((k) => k === raw) ?? "listing";
  const supabase = await createClient();
  const head = { count: "exact" as const, head: true };

  const [counts, areas, t, tl, ts, te, tj, tmc, tic, locale] = await Promise.all([
    Promise.all([
      supabase.from("listings").select("id", head).eq("status", "pending"),
      supabase.from("service_providers").select("id", head).eq("status", "pending"),
      supabase.from("recipes").select("id", head).eq("status", "pending"),
      supabase.from("community_events").select("id", head).eq("status", "pending"),
      supabase.from("job_posts").select("id", head).eq("status", "open"),
      supabase.from("market_items").select("id", head).in("status", ["available", "reserved"]),
    ]),
    supabase.from("areas").select("id, name_bn, name_en"),
    getTranslations("admin.moderation"),
    getTranslations("listingTypes"),
    getTranslations("serviceCategories"),
    getTranslations("eventTypes"),
    getTranslations("jobTypes"),
    getTranslations("marketCategories"),
    getTranslations("itemConditions"),
    getLocale(),
  ]);
  const count: Record<ModerationKind, number> = Object.fromEntries(MODERATION_KINDS.map((k, i) => [k, counts[i].count ?? 0])) as Record<
    ModerationKind,
    number
  >;
  const areaName = new Map((areas.data ?? []).map((a) => [a.id, locale === "en" ? a.name_en : a.name_bn]));
  const area = (id: number | null) => (id ? areaName.get(id) : undefined);
  const when = (v: string) => formatDate(v, locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

  let items: Item[] = [];
  let error: unknown = null;
  switch (kind) {
    case "listing": {
      const r = await supabase
        .from("listings")
        .select("id, title, listing_type, description, rent, area_id, seats_available, contact_phone, created_at, owner:profiles!listings_owner_id_fkey(full_name)")
        .eq("status", "pending")
        .order("created_at")
        .limit(50);
      error = r.error;
      items = (r.data ?? []).map((x) => ({
        id: x.id,
        title: x.title,
        meta: [tl(x.listing_type), area(x.area_id), t("rent", { amount: formatTaka(x.rent, locale) }), x.contact_phone].filter(Boolean) as string[],
        body: x.description,
        by: x.owner?.full_name ?? null,
        createdAt: x.created_at,
      }));
      break;
    }
    case "service": {
      const r = await supabase
        .from("service_providers")
        .select("id, name, category, area_id, phone, description, price_note, created_at, owner:profiles!service_providers_owner_id_fkey(full_name)")
        .eq("status", "pending")
        .order("created_at")
        .limit(50);
      error = r.error;
      items = (r.data ?? []).map((x) => ({
        id: x.id,
        title: x.name,
        meta: [ts(x.category), area(x.area_id), x.phone, x.price_note].filter(Boolean) as string[],
        body: x.description,
        by: x.owner?.full_name ?? null,
        createdAt: x.created_at,
      }));
      break;
    }
    case "recipe": {
      const r = await supabase
        .from("recipes")
        .select("id, title_bn, title_en, description, cook_minutes, cost_estimate, created_at, author:profiles!recipes_created_by_fkey(full_name)")
        .eq("status", "pending")
        .order("created_at")
        .limit(50);
      error = r.error;
      items = (r.data ?? []).map((x) => ({
        id: x.id,
        title: (locale === "en" ? x.title_en : null) || x.title_bn,
        meta: [
          x.cook_minutes ? t("minutes", { count: formatNumber(x.cook_minutes, locale) }) : null,
          x.cost_estimate ? t("cost", { amount: formatTaka(x.cost_estimate, locale) }) : null,
        ].filter(Boolean) as string[],
        body: x.description,
        by: x.author?.full_name ?? null,
        createdAt: x.created_at,
      }));
      break;
    }
    case "event": {
      const r = await supabase
        .from("community_events")
        .select("id, title, event_type, description, area_id, venue, starts_at, created_at, organizer:profiles!community_events_organizer_id_fkey(full_name)")
        .eq("status", "pending")
        .order("starts_at")
        .limit(50);
      error = r.error;
      items = (r.data ?? []).map((x) => ({
        id: x.id,
        title: x.title,
        meta: [te(x.event_type), when(x.starts_at), x.venue, area(x.area_id)].filter(Boolean) as string[],
        body: x.description,
        by: x.organizer?.full_name ?? null,
        createdAt: x.created_at,
      }));
      break;
    }
    case "job": {
      const r = await supabase
        .from("job_posts")
        .select("id, title, job_type, description, area_id, salary_text, created_at, poster:profiles!job_posts_posted_by_fkey(full_name)")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(50);
      error = r.error;
      items = (r.data ?? []).map((x) => ({
        id: x.id,
        title: x.title,
        meta: [tj(x.job_type), area(x.area_id), x.salary_text].filter(Boolean) as string[],
        body: x.description,
        by: x.poster?.full_name ?? null,
        createdAt: x.created_at,
      }));
      break;
    }
    case "market": {
      const r = await supabase
        .from("market_items")
        .select("id, title, category, condition, price, description, area_id, created_at, seller:profiles!market_items_seller_id_fkey(full_name)")
        .in("status", ["available", "reserved"])
        .order("created_at", { ascending: false })
        .limit(50);
      error = r.error;
      items = (r.data ?? []).map((x) => ({
        id: x.id,
        title: x.title,
        meta: [tmc(x.category), tic(x.condition), formatTaka(x.price, locale), area(x.area_id)].filter(Boolean) as string[],
        body: x.description,
        by: x.seller?.full_name ?? null,
        createdAt: x.created_at,
      }));
      break;
    }
  }
  if (error) throw new Error((error as { message?: string }).message ?? "moderation query failed");

  return (
    <div className="grid gap-5">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label={t("kinds")}>
        {MODERATION_KINDS.map((k) => (
          <Link
            key={k}
            href={`/admin/moderation?kind=${k}`}
            aria-current={k === kind ? "page" : undefined}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm transition-colors",
              k === kind ? "border-primary/50 bg-mint-soft font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`tabs.${k}`)}
            {count[k] > 0 && (
              <span className="rounded-full bg-muted px-1.5 text-xs font-semibold text-foreground">{formatNumber(count[k], locale)}</span>
            )}
          </Link>
        ))}
      </nav>
      <p className="text-sm text-muted-foreground">{kind === "job" || kind === "market" ? t("postModerated") : t("preModerated")}</p>

      {items.length === 0 ? (
        <EmptyState icon={ShieldCheck} title={t("empty")} body={t("emptyBody")} className="rounded-2xl border bg-card py-10" />
      ) : (
        <ul className="grid gap-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-2xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 basis-72">
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{item.meta.join(" · ")}</p>
                  {item.body && <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm">{item.body}</p>}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("postedBy", { name: item.by ?? t("unknown"), date: when(item.createdAt) })}
                  </p>
                </div>
                <ModerationActions kind={kind} id={item.id} title={item.title} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

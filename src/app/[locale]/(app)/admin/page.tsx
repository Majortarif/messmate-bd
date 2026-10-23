import { ArrowRight, Building2, Flag, History, type LucideIcon, MessageSquareText, ShieldCheck, Users } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { DailyAreaChart, RankedBarChart } from "@/components/charts/viz";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { Link } from "@/i18n/navigation";
import { requireSuperAdmin } from "@/lib/dal";
import { formatNumber } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { PlatformStats } from "@/types/app";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.overview");
  return { title: t("title") };
}

export default async function AdminOverviewPage() {
  await requireSuperAdmin();
  const supabase = await createClient();
  const [result, t, locale] = await Promise.all([supabase.rpc("get_platform_stats"), getTranslations("admin.overview"), getLocale()]);
  if (result.error) throw new Error(result.error.message);
  const s = result.data as unknown as PlatformStats;
  const n = (v: number) => formatNumber(v, locale);
  const toModerate = s.listings.pending + s.services_pending + s.recipes_pending + s.events_pending;
  const signups30 = s.signups_30d.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="grid gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={Users} label={t("kpi.users")} value={n(s.users)} note={t("kpi.signups", { count: n(signups30) })} href="/admin/users" />
        <Tile
          icon={Building2}
          label={t("kpi.messes")}
          value={n(s.messes)}
          note={s.inactive_messes > 0 ? t("kpi.inactiveMesses", { count: n(s.inactive_messes) }) : t("kpi.members", { count: n(s.active_members) })}
          href="/admin/messes"
        />
        <Tile
          icon={ShieldCheck}
          label={t("kpi.moderation")}
          value={n(toModerate)}
          note={toModerate > 0 ? t("kpi.waiting") : t("kpi.clear")}
          href="/admin/moderation"
          attention={toModerate > 0}
        />
        <Tile
          icon={MessageSquareText}
          label={t("kpi.feedback")}
          value={n(s.feedback_new)}
          note={s.feedback_new > 0 ? t("kpi.unread") : t("kpi.clear")}
          href="/admin/feedback"
          attention={s.feedback_new > 0}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <DailyAreaChart
          data={s.signups_30d}
          title={t("charts.signups")}
          description={t("charts.signupsBody", { count: n(signups30) })}
          seriesLabel={t("charts.newUsers")}
        />
        {s.messes_by_area.length === 0 ? (
          <section className="rounded-2xl border bg-card p-5">
            <h2 className="font-semibold">{t("charts.areas")}</h2>
            <EmptyState icon={Building2} title={t("charts.noMesses")} />
          </section>
        ) : (
        <RankedBarChart
          title={t("charts.areas")}
          description={t("charts.areasBody")}
          columnLabel={t("charts.messCount")}
          data={s.messes_by_area.map((a, i) => ({
            key: `${a.area_en ?? "other"}-${i}`,
            label: (locale === "en" ? a.area_en : a.area_bn) ?? t("charts.noArea"),
            value: a.count,
          }))}
        />
        )}
      </div>

      <section className="rounded-2xl border bg-card p-4 sm:p-5">
        <h2 className="font-semibold">{t("community.title")}</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Fact label={t("community.listings")} value={n(s.listings.approved)} />
          <Fact label={t("community.market")} value={n(s.market_available)} />
          <Fact label={t("community.jobs")} value={n(s.open_jobs)} />
          <Fact label={t("community.events")} value={n(s.upcoming_events)} />
        </dl>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <QuickLink href="/admin/moderation" icon={Flag} title={t("links.moderation")} body={t("links.moderationBody")} />
        <QuickLink href="/admin/activity" icon={History} title={t("links.activity")} body={t("links.activityBody")} />
      </div>
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  note,
  href,
  attention = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  note: ReactNode;
  href: string;
  attention?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "card-hover min-w-0 rounded-2xl border bg-card p-4",
        attention && "border-marigold/40",
      )}
    >
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </p>
      <p className="mt-1.5 truncate text-2xl font-semibold">{value}</p>
      <p className={cn("mt-0.5 truncate text-xs", attention ? "text-marigold" : "text-muted-foreground")}>{note}</p>
    </Link>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/50 px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold">{value}</dd>
    </div>
  );
}

function QuickLink({ href, icon: Icon, title, body }: { href: string; icon: LucideIcon; title: string; body: string }) {
  return (
    <Link href={href} className="card-hover group flex items-center gap-3 rounded-2xl border bg-card p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-mint-soft text-mint">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        <span className="block text-sm text-muted-foreground">{body}</span>
      </span>
      <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  );
}

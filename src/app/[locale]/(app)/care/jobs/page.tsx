import { Briefcase, CalendarClock, MapPin, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { CareNav } from "@/components/care/care-nav";
import { JobMenu, NewJobButton } from "@/components/care/community-care";
import { ContactButtons } from "@/components/community/bits";
import { ReportButton } from "@/components/community/interactive";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { type Tone, ToneBadge } from "@/components/shared/tone-badge";
import { Link } from "@/i18n/navigation";
import { areaName, getAreas } from "@/lib/community";
import { requireOnboarded } from "@/lib/dal";
import { dhakaToday, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { JOB_TYPES } from "@/lib/validations/care";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("care.jobs");
  return { title: t("title") };
}

const STATUS_TONE: Record<string, Tone> = { open: "mint", closed: "muted", removed: "coral" };

export default async function JobsPage({ searchParams }: PageProps<"/[locale]/care/jobs">) {
  const viewer = await requireOnboarded();
  const sp = await searchParams;
  const type = JOB_TYPES.find((j) => j === sp.type) ?? null;
  const area = typeof sp.area === "string" && /^\d+$/.test(sp.area) ? Number(sp.area) : null;
  const mine = sp.mine === "1";
  const today = dhakaToday();
  const supabase = await createClient();

  let query = supabase.from("job_posts").select("*").order("created_at", { ascending: false }).limit(60);
  if (mine) query = query.eq("posted_by", viewer.id);
  else query = query.eq("status", "open").or(`expires_at.is.null,expires_at.gte.${today}`);
  if (type) query = query.eq("job_type", type);
  if (area) query = query.eq("area_id", area);

  const [{ data, error }, areas, t, tj, ts, locale] = await Promise.all([
    query,
    getAreas(),
    getTranslations("care.jobs"),
    getTranslations("jobTypes"),
    getTranslations("jobStatus"),
    getLocale(),
  ]);
  if (error) throw new Error(error.message);
  const jobs = data ?? [];
  const areaById = new Map(areas.map((a) => [a.id, a]));
  const chip = (active: boolean) =>
    cn(
      "inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-sm transition-colors",
      active ? "border-primary/50 bg-mint-soft font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
    );
  const href = (patch: Record<string, string | null>) => {
    const next = { type, area: area ? String(area) : null, mine: mine ? "1" : null, ...patch };
    const qs = new URLSearchParams(Object.entries(next).filter((e): e is [string, string] => Boolean(e[1])));
    return qs.size ? `/care/jobs?${qs}` : "/care/jobs";
  };

  return (
    <div className="grid gap-5">
      <PageHeader title={t("title")} description={t("subtitle")} actions={<NewJobButton areas={areas} phone={viewer.context.profile?.phone ?? ""} />} />
      <CareNav active="jobs" />
      <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label={t("filters")}>
        <Link href={href({ type: null })} className={chip(!type)} aria-current={!type ? "page" : undefined}>
          {t("all")}
        </Link>
        {JOB_TYPES.map((j) => (
          <Link key={j} href={href({ type: j })} className={chip(type === j)} aria-current={type === j ? "page" : undefined}>
            {tj(j)}
          </Link>
        ))}
        <Link href={href({ mine: mine ? null : "1" })} className={chip(mine)} aria-pressed={mine}>
          {t("mine")}
        </Link>
      </nav>

      {jobs.length === 0 ? (
        <EmptyState icon={Briefcase} title={mine ? t("emptyMine") : t("empty")} body={t("emptyBody")} className="rounded-2xl border bg-card py-12" />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {jobs.map((j) => {
            const own = j.posted_by === viewer.id;
            return (
              <li key={j.id} className="grid gap-3 rounded-2xl border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <ToneBadge tone="sky">{tj(j.job_type)}</ToneBadge>
                      {own && <ToneBadge tone={STATUS_TONE[j.status]}>{ts(j.status)}</ToneBadge>}
                    </div>
                    <h2 className="mt-1 font-semibold leading-snug">{j.title}</h2>
                    <p className="text-xs text-muted-foreground">{t("posted", { date: formatDate(j.created_at, locale, { day: "numeric", month: "short" }) })}</p>
                  </div>
                  {own && <JobMenu id={j.id} title={j.title} status={j.status} />}
                </div>
                <p className="line-clamp-5 whitespace-pre-line text-sm">{j.description}</p>
                <ul className="grid gap-1 text-sm text-muted-foreground">
                  {j.salary_text && (
                    <li className="flex items-center gap-2">
                      <Wallet className="size-4 shrink-0" aria-hidden="true" />
                      {j.salary_text}
                    </li>
                  )}
                  {j.schedule_text && (
                    <li className="flex items-center gap-2">
                      <CalendarClock className="size-4 shrink-0" aria-hidden="true" />
                      {j.schedule_text}
                    </li>
                  )}
                  {j.area_id && (
                    <li className="flex items-center gap-2">
                      <MapPin className="size-4 shrink-0" aria-hidden="true" />
                      {areaName(areaById.get(j.area_id), locale)}
                    </li>
                  )}
                </ul>
                {!own && j.status === "open" && (
                  <>
                    <ContactButtons phone={j.contact_phone} message={t("whatsappText", { title: j.title })} />
                    <div className="-mt-1 flex justify-end">
                      <ReportButton kind="job" id={j.id} title={j.title} />
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">{t("safety")}</p>
    </div>
  );
}

import { MessageSquareWarning } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { ComplaintMenu, ComplaintThread, NewComplaintButton } from "@/components/mess/complaints";
import { MessTabs } from "@/components/mess/mess-tabs";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { type Tone, ToneBadge } from "@/components/shared/tone-badge";
import { Link } from "@/i18n/navigation";
import { requireMember } from "@/lib/dal";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { COMPLAINT_STATUSES } from "@/lib/validations/mess-life";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("mess.complaints");
  return { title: t("title") };
}

const STATUS_TONE: Record<string, Tone> = { open: "coral", in_progress: "marigold", resolved: "mint", closed: "muted" };
const FILTERS = ["active", ...COMPLAINT_STATUSES, "mine"] as const;

export default async function ComplaintsPage({ searchParams }: PageProps<"/[locale]/mess/complaints">) {
  const member = await requireMember();
  const isManager = member.membership.role === "manager" && member.membership.status === "active";
  const raw = (await searchParams).show;
  const filter = FILTERS.find((f) => f === raw) ?? "active";
  const supabase = await createClient();

  let query = supabase
    .from("complaints")
    .select(
      "id, category, title, description, photo_path, status, priority, created_at, resolved_at, created_by, author:profiles!complaints_created_by_fkey(full_name), updates:complaint_updates(id, message, status_change, created_at, author_id, author:profiles!complaint_updates_author_id_fkey(full_name))",
    )
    .order("created_at", { ascending: false })
    .limit(60);
  if (filter === "active") query = query.in("status", ["open", "in_progress"]);
  else if (filter === "mine") query = query.eq("created_by", member.id);
  else query = query.eq("status", filter);

  const [{ data, error }, t, tc, ts, tp, locale] = await Promise.all([
    query,
    getTranslations("mess.complaints"),
    getTranslations("complaintCategories"),
    getTranslations("complaintStatus"),
    getTranslations("priorities"),
    getLocale(),
  ]);
  if (error) throw new Error(error.message);
  const complaints = data ?? [];

  // complaint photos are private to the mess: short-lived signed links
  const paths = complaints.map((c) => c.photo_path).filter((p): p is string => Boolean(p));
  const signed = paths.length ? ((await supabase.storage.from("complaint-photos").createSignedUrls(paths, 3600)).data ?? []) : [];
  const photoUrl = new Map(signed.filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl]));
  const newButton = <NewComplaintButton messId={member.membership.mess_id} userId={member.id} isManager={isManager} />;

  return (
    <div className="grid gap-5">
      <PageHeader title={t("title")} description={t("subtitle")} actions={newButton} />
      <MessTabs active="complaints" />
      <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label={t("filterLabel")}>
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "active" ? "/mess/complaints" : `/mess/complaints?show=${f}`}
            aria-current={f === filter ? "page" : undefined}
            className={cn(
              "inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-sm transition-colors",
              f === filter ? "border-primary/50 bg-mint-soft font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {f === "active" ? t("filters.active") : f === "mine" ? t("filters.mine") : ts(f)}
          </Link>
        ))}
      </nav>

      {complaints.length === 0 ? (
        <EmptyState icon={MessageSquareWarning} title={filter === "active" ? t("emptyActive") : t("empty")} body={t("emptyBody")} action={newButton} className="rounded-2xl border bg-card py-12" />
      ) : (
        <ul className="grid gap-3">
          {complaints.map((c) => {
            const mine = c.created_by === member.id;
            const photo = c.photo_path ? photoUrl.get(c.photo_path) : null;
            return (
              <li key={c.id} className={cn("rounded-2xl border bg-card p-4 sm:p-5", c.priority === "urgent" && c.status !== "closed" && "border-coral/40")}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <ToneBadge tone={STATUS_TONE[c.status]}>{ts(c.status)}</ToneBadge>
                      <ToneBadge tone="sky">{tc(c.category)}</ToneBadge>
                      {(c.priority === "high" || c.priority === "urgent") && (
                        <ToneBadge tone={c.priority === "urgent" ? "coral" : "marigold"}>{tp(c.priority)}</ToneBadge>
                      )}
                    </div>
                    <h2 className="mt-1.5 font-semibold leading-snug">{c.title}</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("byline", { name: mine ? t("you") : c.author?.full_name || "—", date: formatDate(c.created_at, locale, { day: "numeric", month: "short" }) })}
                      {c.resolved_at && ` · ${t("resolvedOn", { date: formatDate(c.resolved_at, locale, { day: "numeric", month: "short" }) })}`}
                    </p>
                  </div>
                  {((mine && c.status === "open") || isManager) && (
                    <ComplaintMenu
                      id={c.id}
                      title={c.title}
                      messId={member.membership.mess_id}
                      userId={member.id}
                      canEdit={mine && c.status === "open"}
                      isManager={isManager}
                      initial={{ category: c.category, title: c.title, description: c.description ?? "", priority: c.priority }}
                    />
                  )}
                </div>
                {c.description && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{c.description}</p>}
                {photo && (
                  <a href={photo} target="_blank" rel="noreferrer" className="mt-2 block w-fit">
                    {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                    <img src={photo} alt={t("photoAlt", { title: c.title })} className="h-32 rounded-xl border object-cover" />
                  </a>
                )}
                <ComplaintThread
                  complaintId={c.id}
                  status={c.status}
                  isManager={isManager}
                  updates={[...(c.updates ?? [])]
                    .sort((a, b) => a.created_at.localeCompare(b.created_at))
                    .map((u) => ({
                      id: u.id,
                      author: u.author_id === member.id ? t("you") : u.author?.full_name || "—",
                      message: u.message,
                      statusChange: u.status_change,
                      createdAt: u.created_at,
                      mine: u.author_id === member.id,
                    }))}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

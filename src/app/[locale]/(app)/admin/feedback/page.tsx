import { ExternalLink, MessageSquareText } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { FeedbackReview } from "@/components/admin/feedback-review";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { type Tone, ToneBadge } from "@/components/shared/tone-badge";
import { Link } from "@/i18n/navigation";
import { requireSuperAdmin } from "@/lib/dal";
import { formatDate, formatNumber } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.feedback");
  return { title: t("title") };
}

const STATUSES = ["new", "reviewing", "resolved"] as const;
const TYPE_TONE: Record<string, Tone> = { bug: "coral", report: "marigold", contact: "sky", feedback: "mint" };

export default async function FeedbackInboxPage({ searchParams }: PageProps<"/[locale]/admin/feedback">) {
  await requireSuperAdmin();
  const raw = (await searchParams).status;
  const status = STATUSES.find((s) => s === raw) ?? "new";
  const supabase = await createClient();
  const head = { count: "exact" as const, head: true };
  const [list, counts, t, locale] = await Promise.all([
    supabase
      .from("feedback")
      .select(
        "id, type, subject, message, contact_email, page_url, status, admin_note, created_at, author:profiles!feedback_user_id_fkey(full_name, email), mess:messes!feedback_mess_id_fkey(name)",
      )
      .eq("status", status)
      .order("created_at", { ascending: status !== "resolved" })
      .limit(100),
    Promise.all(STATUSES.map((s) => supabase.from("feedback").select("id", head).eq("status", s))),
    getTranslations("admin.feedback"),
    getLocale(),
  ]);
  if (list.error) throw new Error(list.error.message);
  const items = list.data ?? [];

  return (
    <div className="grid gap-5">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label={t("filter")}>
        {STATUSES.map((s, i) => (
          <Link
            key={s}
            href={s === "new" ? "/admin/feedback" : `/admin/feedback?status=${s}`}
            aria-current={s === status ? "page" : undefined}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm transition-colors",
              s === status ? "border-primary/50 bg-mint-soft font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`statuses.${s}`)}
            <span className="rounded-full bg-muted px-1.5 text-xs font-semibold text-foreground">
              {formatNumber(counts[i].count ?? 0, locale)}
            </span>
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <EmptyState icon={MessageSquareText} title={t("empty")} body={t("emptyBody")} className="rounded-2xl border bg-card py-10" />
      ) : (
        <ul className="grid gap-3">
          {items.map((f) => {
            const from = f.author?.full_name || f.contact_email || f.author?.email || t("anonymous");
            const reply = f.contact_email || f.author?.email;
            return (
              <li key={f.id} className="rounded-2xl border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <ToneBadge tone={TYPE_TONE[f.type] ?? "muted"}>{t(`types.${f.type}`)}</ToneBadge>
                  <p className="min-w-0 flex-1 truncate font-medium">{f.subject || t("noSubject")}</p>
                  <time dateTime={f.created_at} className="text-xs text-muted-foreground">
                    {formatDate(f.created_at, locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                  </time>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm">{f.message}</p>
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{t("from", { name: from })}</span>
                  {f.mess?.name && <span>· {f.mess.name}</span>}
                  {reply && (
                    <a href={`mailto:${reply}`} className="underline-offset-2 hover:text-foreground hover:underline">
                      {reply}
                    </a>
                  )}
                  {f.page_url && (
                    <span className="inline-flex min-w-0 items-center gap-1">
                      <ExternalLink className="size-3" aria-hidden="true" />
                      <span className="truncate font-mono">{f.page_url}</span>
                    </span>
                  )}
                </p>
                <FeedbackReview id={f.id} status={f.status} note={f.admin_note} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

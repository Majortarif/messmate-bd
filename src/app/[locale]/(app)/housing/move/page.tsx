import { ArrowRight, CheckCircle2, ClipboardCheck } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { HousingTabs } from "@/components/housing/housing-tabs";
import { NewChecklistButton } from "@/components/housing/move-checklist";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { ToneBadge } from "@/components/shared/tone-badge";
import { Link } from "@/i18n/navigation";
import { requireOnboarded } from "@/lib/dal";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("housing.move");
  return { title: t("title") };
}

export default async function MoveChecklistsPage() {
  await requireOnboarded();
  const supabase = await createClient();
  const [{ data, error }, t, locale] = await Promise.all([
    supabase
      .from("move_checklists")
      .select("id, kind, title, property_address, scheduled_date, completed_at, items:move_checklist_items(is_done)")
      .order("created_at", { ascending: false }),
    getTranslations("housing.move"),
    getLocale(),
  ]);
  if (error) throw new Error(error.message);
  const lists = data ?? [];

  return (
    <div className="grid gap-5">
      <PageHeader title={t("title")} description={t("subtitle")} actions={<NewChecklistButton />} />
      <HousingTabs active="move" />
      {lists.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title={t("empty")} body={t("emptyBody")} action={<NewChecklistButton />} className="rounded-2xl border bg-card py-12" />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {lists.map((c) => {
            const items = c.items ?? [];
            const done = items.filter((i) => i.is_done).length;
            return (
              <li key={c.id}>
                <Link href={`/housing/move/${c.id}`} className="card-hover group grid gap-3 rounded-2xl border bg-card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <ToneBadge tone={c.kind === "move_in" ? "sky" : "marigold"}>{t(`kinds.${c.kind}`)}</ToneBadge>
                    {c.completed_at && (
                      <ToneBadge tone="mint">
                        <CheckCircle2 className="size-3" aria-hidden="true" />
                        {t("done")}
                      </ToneBadge>
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{c.title}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {[c.property_address, c.scheduled_date && formatDate(c.scheduled_date, locale, { day: "numeric", month: "long" })]
                        .filter(Boolean)
                        .join(" · ") || t("noDetails")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground">{t("progress", { done, total: items.length })}</span>
                    <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

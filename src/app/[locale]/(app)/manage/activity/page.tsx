import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ActivityFilters, parseCategory } from "@/components/admin/activity-filters";
import { ActivityLog } from "@/components/admin/activity-log";
import { PageHeader } from "@/components/shared/states";
import { requireManager } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import type { ActivityEntry } from "@/types/app";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("activity");
  return { title: t("title") };
}

const MESS_CATEGORIES = ["money", "members", "spending", "settings"] as const;

export default async function MessActivityPage({ searchParams }: PageProps<"/[locale]/manage/activity">) {
  const manager = await requireManager();
  const category = parseCategory((await searchParams).type, MESS_CATEGORIES);
  const messId = manager.membership.mess_id;
  const supabase = await createClient();
  const [result, t] = await Promise.all([
    supabase.rpc("get_activity_log", { p_mess_id: messId, p_category: category ?? undefined, p_limit: 40 }),
    getTranslations("activity"),
  ]);
  if (result.error) throw new Error(result.error.message);

  return (
    <div className="grid gap-5">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <ActivityFilters path="/manage/activity" active={category} options={MESS_CATEGORIES} />
      <ActivityLog key={category ?? "all"} initial={result.data as unknown as ActivityEntry[]} messId={messId} category={category} />
    </div>
  );
}

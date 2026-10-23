import { X } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { ActivityFilters, parseCategory } from "@/components/admin/activity-filters";
import { ActivityLog } from "@/components/admin/activity-log";
import { PageHeader } from "@/components/shared/states";
import { Link } from "@/i18n/navigation";
import { requireSuperAdmin } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { ACTIVITY_CATEGORIES, type ActivityEntry } from "@/types/app";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("activity");
  return { title: t("platformTitle") };
}

export default async function PlatformActivityPage({ searchParams }: PageProps<"/[locale]/admin/activity">) {
  await requireSuperAdmin();
  const params = await searchParams;
  const category = parseCategory(params.type);
  const messId = typeof params.mess === "string" && z.uuid().safeParse(params.mess).success ? params.mess : null;
  const supabase = await createClient();
  const [result, mess, t] = await Promise.all([
    supabase.rpc("get_activity_log", { p_mess_id: messId ?? undefined, p_category: category ?? undefined, p_limit: 40 }),
    messId ? supabase.from("messes").select("name").eq("id", messId).maybeSingle() : null,
    getTranslations("activity"),
  ]);
  if (result.error) throw new Error(result.error.message);

  return (
    <div className="grid gap-5">
      <PageHeader title={t("platformTitle")} description={t("platformSubtitle")} />
      {messId && (
        <p className="flex w-fit items-center gap-2 rounded-full border bg-card py-1 pl-4 pr-1 text-sm">
          {t("onlyMess", { name: mess?.data?.name ?? "—" })}
          <Link
            href={category ? `/admin/activity?type=${category}` : "/admin/activity"}
            className="flex size-8 items-center justify-center rounded-full hover:bg-accent"
            aria-label={t("clearMess")}
          >
            <X className="size-4" />
          </Link>
        </p>
      )}
      <ActivityFilters path="/admin/activity" active={category} options={ACTIVITY_CATEGORIES} extraQuery={messId ? `mess=${messId}` : ""} />
      <ActivityLog
        key={`${messId ?? "all"}-${category ?? "all"}`}
        initial={result.data as unknown as ActivityEntry[]}
        messId={messId}
        category={category}
        showMess={!messId}
      />
    </div>
  );
}

import { Building2, History, Phone } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { MessStatusButton } from "@/components/admin/admin-actions";
import { PAGE_SIZE, Pager, parsePage, SearchForm } from "@/components/admin/directory";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { ToneBadge } from "@/components/shared/tone-badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requireSuperAdmin } from "@/lib/dal";
import { formatDate, formatNumber } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { AdminMessRow, AdminPage } from "@/types/app";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.messes");
  return { title: t("title") };
}

export default async function AdminMessesPage({ searchParams }: PageProps<"/[locale]/admin/messes">) {
  await requireSuperAdmin();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";
  const page = parsePage(params.page);
  const supabase = await createClient();
  const [result, t, locale] = await Promise.all([
    supabase.rpc("admin_list_messes", { p_search: q || undefined, p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE }),
    getTranslations("admin.messes"),
    getLocale(),
  ]);
  if (result.error) throw new Error(result.error.message);
  const { total, rows } = result.data as unknown as AdminPage<AdminMessRow>;

  return (
    <div className="grid gap-5">
      <PageHeader title={t("title")} description={t("subtitle", { count: formatNumber(total, locale) })} />
      <SearchForm query={q} placeholder={t("searchPlaceholder")} />

      {rows.length === 0 ? (
        <EmptyState icon={Building2} title={q ? t("noMatch", { q }) : t("empty")} className="rounded-2xl border bg-card py-10" />
      ) : (
        <ul className="grid gap-2">
          {rows.map((m) => {
            const area = locale === "en" ? m.area_en : m.area_bn;
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border bg-card p-4">
                <div className="min-w-0 flex-1 basis-64">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {m.name}
                    {!m.is_active && <ToneBadge tone="coral">{t("inactive")}</ToneBadge>}
                    {m.is_active && !m.invite_enabled && <ToneBadge tone="muted">{t("inviteOff")}</ToneBadge>}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {[area, m.address].filter(Boolean).join(" · ") || t("noAddress")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("created", { date: formatDate(m.created_at, locale, { day: "numeric", month: "short", year: "numeric" }) })}
                    {m.last_activity && ` · ${t("lastActive", { date: formatDate(m.last_activity, locale, { day: "numeric", month: "short" }) })}`}
                  </p>
                </div>
                <div className="min-w-0 basis-48 text-sm">
                  <p className="text-xs text-muted-foreground">{t("manager")}</p>
                  {m.manager ? (
                    <p className="flex items-center gap-1.5 truncate">
                      {m.manager.name || "—"}
                      {m.manager.phone && (
                        <a
                          href={`tel:${m.manager.phone}`}
                          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                          aria-label={t("call", { name: m.manager.name })}
                        >
                          <Phone className="size-3.5" />
                        </a>
                      )}
                    </p>
                  ) : (
                    <p className="text-coral">{t("noManager")}</p>
                  )}
                </div>
                <div className="basis-28 text-sm">
                  <p className="text-xs text-muted-foreground">{t("members")}</p>
                  <p>
                    {formatNumber(m.active_members, locale)}
                    {m.pending_members > 0 && (
                      <span className="text-xs text-marigold"> {t("pending", { count: formatNumber(m.pending_members, locale) })}</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/admin/activity?mess=${m.id}`}>
                      <History className="size-4" aria-hidden="true" />
                      {t("activity")}
                    </Link>
                  </Button>
                  <MessStatusButton messId={m.id} name={m.name} active={m.is_active} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Pager path="/admin/messes" page={page} total={total} query={{ q: q || undefined }} />
    </div>
  );
}

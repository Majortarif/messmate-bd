import { Mail, Phone, Users } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { RoleSelect } from "@/components/admin/admin-actions";
import { PAGE_SIZE, Pager, parsePage, SearchForm } from "@/components/admin/directory";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { ToneBadge } from "@/components/shared/tone-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "@/i18n/navigation";
import { requireSuperAdmin } from "@/lib/dal";
import { formatDate, formatNumber, initials } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { type AdminPage, type AdminUserRow, PLATFORM_ROLES, type PlatformRole } from "@/types/app";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.users");
  return { title: t("title") };
}

export default async function AdminUsersPage({ searchParams }: PageProps<"/[locale]/admin/users">) {
  const admin = await requireSuperAdmin();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";
  const role = PLATFORM_ROLES.find((r) => r === params.role) ?? null;
  const page = parsePage(params.page);
  const supabase = await createClient();
  const [result, t, tr, tm, locale] = await Promise.all([
    supabase.rpc("admin_list_users", {
      p_search: q || undefined,
      p_role: role ?? undefined,
      p_limit: PAGE_SIZE,
      p_offset: (page - 1) * PAGE_SIZE,
    }),
    getTranslations("admin.users"),
    getTranslations("platformRoles"),
    getTranslations("roles"),
    getLocale(),
  ]);
  if (result.error) throw new Error(result.error.message);
  const { total, rows } = result.data as unknown as AdminPage<AdminUserRow>;
  const roleHref = (r: PlatformRole | null) => {
    const qs = new URLSearchParams(Object.entries({ q: q || undefined, role: r ?? undefined }).filter((e): e is [string, string] => !!e[1]));
    return qs.size ? `/admin/users?${qs}` : "/admin/users";
  };

  return (
    <div className="grid gap-5">
      <PageHeader title={t("title")} description={t("subtitle", { count: formatNumber(total, locale) })} />
      <div className="grid gap-3">
        <SearchForm query={q} placeholder={t("searchPlaceholder")} hidden={{ role: role ?? undefined }} />
        <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label={t("roleFilter")}>
          {[null, ...PLATFORM_ROLES].map((r) => (
            <Link
              key={r ?? "all"}
              href={roleHref(r)}
              aria-current={r === role ? "page" : undefined}
              className={cn(
                "inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-sm transition-colors",
                r === role ? "border-primary/50 bg-mint-soft font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r ? tr(r) : t("allRoles")}
            </Link>
          ))}
        </nav>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Users} title={q ? t("noMatch", { q }) : t("empty")} className="rounded-2xl border bg-card py-10" />
      ) : (
        <ul className="grid gap-2">
          {rows.map((u) => {
            const name = u.full_name || t("noName");
            return (
              <li key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border bg-card p-4">
                <div className="flex min-w-0 flex-1 basis-64 items-center gap-3">
                  <Avatar className="size-10">
                    {u.avatar_url && <AvatarImage src={u.avatar_url} alt="" />}
                    <AvatarFallback className="bg-mint-soft text-sm font-semibold text-mint">{initials(name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      <span className="truncate">{name}</span>
                      {u.id === admin.id && <span className="text-xs font-normal text-muted-foreground">({t("you")})</span>}
                      {u.is_deleted && <ToneBadge tone="coral">{t("deleted")}</ToneBadge>}
                    </p>
                    <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      {u.email && (
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <Mail className="size-3" aria-hidden="true" />
                          <span className="truncate">{u.email}</span>
                        </span>
                      )}
                      {u.phone && (
                        <a href={`tel:${u.phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
                          <Phone className="size-3" aria-hidden="true" />
                          {u.phone}
                        </a>
                      )}
                    </p>
                  </div>
                </div>
                <div className="min-w-0 basis-44 text-sm">
                  <p className="text-xs text-muted-foreground">{t("mess")}</p>
                  {u.mess_name ? (
                    <p className="truncate">
                      {u.mess_name}
                      <span className="text-xs text-muted-foreground">
                        {" · "}
                        {u.member_status === "pending" ? t("requested") : u.mess_role ? tm(u.mess_role) : ""}
                      </span>
                    </p>
                  ) : (
                    <p className="text-muted-foreground">{t("noMess")}</p>
                  )}
                </div>
                <div className="basis-28 text-sm">
                  <p className="text-xs text-muted-foreground">{t("joined")}</p>
                  <p>{formatDate(u.created_at, locale, { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
                <RoleSelect userId={u.id} name={name} role={u.platform_role} disabled={u.id === admin.id || u.is_deleted} />
              </li>
            );
          })}
        </ul>
      )}
      <Pager path="/admin/users" page={page} total={total} query={{ q: q || undefined, role: role ?? undefined }} />
    </div>
  );
}

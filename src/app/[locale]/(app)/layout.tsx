import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { MobileNav, SidebarNav } from "@/components/app/nav";
import { NotificationBell } from "@/components/app/notification-bell";
import { UserMenu } from "@/components/app/user-menu";
import { Logo } from "@/components/brand/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { getViewer } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

/**
 * App shell. The frame (sidebar, top bar, bottom bar) is static and paints
 * instantly; the parts that depend on who is signed in stream in behind
 * <Suspense> with skeletons.
 */
export default function AppLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-sidebar lg:flex">
        <div className="flex h-16 items-center px-5">
          <Link href="/dashboard" aria-label="MessMate BD">
            <Logo />
          </Link>
        </div>
        <Suspense fallback={<MessChipSkeleton />}>
          <MessChip />
        </Suspense>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <Suspense fallback={<NavSkeleton />}>
            <ViewerNav variant="sidebar" />
          </Suspense>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b bg-background/80 px-4 backdrop-blur-xl sm:px-6">
          <Link href="/dashboard" className="lg:hidden" aria-label="MessMate BD">
            <Logo markClassName="size-7" />
          </Link>
          <div className="hidden min-w-0 lg:block">
            <Suspense fallback={<Skeleton className="h-5 w-40" />}>
              <TopbarTitle />
            </Suspense>
          </div>
          <div className="flex items-center gap-0.5">
            <LocaleSwitcher className="hidden sm:inline-flex" />
            <ThemeToggle className="hidden sm:inline-flex" />
            <Suspense fallback={<Skeleton className="size-10 rounded-full" />}>
              <Bell />
            </Suspense>
            <Suspense fallback={<Skeleton className="ml-1 size-9 rounded-full" />}>
              <ViewerMenu />
            </Suspense>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:pb-12">
          {children}
        </main>
      </div>

      <Suspense fallback={null}>
        <ViewerNav variant="mobile" />
      </Suspense>
    </div>
  );
}

async function ViewerNav({ variant }: { variant: "sidebar" | "mobile" }) {
  const viewer = await getViewer();
  const membership = viewer?.context.membership;
  const access = {
    isManager: membership?.role === "manager" && membership.status === "active",
    isAdmin: viewer?.context.profile?.platform_role === "super_admin",
  };
  return variant === "sidebar" ? <SidebarNav {...access} /> : <MobileNav {...access} />;
}

async function MessChip() {
  const [viewer, t] = await Promise.all([getViewer(), getTranslations("shell")]);
  const membership = viewer?.context.membership;
  if (!membership) return null;
  return (
    <div className="mx-3 rounded-xl border bg-card px-3 py-2.5">
      <p className="text-[0.7rem] text-muted-foreground">{t("yourMess")}</p>
      <p className="truncate font-semibold">{membership.mess_name}</p>
    </div>
  );
}

async function TopbarTitle() {
  const [viewer, t] = await Promise.all([getViewer(), getTranslations("shell")]);
  const name = viewer?.context.profile?.full_name?.split(" ")[0];
  return <p className="truncate text-sm text-muted-foreground">{name ? t("hello", { name }) : ""}</p>;
}

async function Bell() {
  const viewer = await getViewer();
  if (!viewer) return null;
  const supabase = await createClient();
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  return <NotificationBell userId={viewer.id} initialUnread={count ?? 0} />;
}

async function ViewerMenu() {
  const [viewer, t] = await Promise.all([getViewer(), getTranslations("roles")]);
  if (!viewer) return null;
  const { profile, membership } = viewer.context;
  const roleLabel =
    profile?.platform_role === "super_admin"
      ? t("super_admin")
      : membership?.role === "manager"
        ? t("manager")
        : profile?.platform_role === "landlord" || profile?.platform_role === "service_provider"
          ? t(profile.platform_role)
          : t("member");
  return (
    <UserMenu
      name={profile?.full_name || viewer.email || ""}
      email={viewer.email}
      avatarUrl={profile?.avatar_url ?? null}
      roleLabel={roleLabel}
    />
  );
}

function NavSkeleton() {
  return (
    <div className="grid gap-2" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-10 w-full rounded-xl" />
      ))}
    </div>
  );
}

function MessChipSkeleton() {
  return <Skeleton className="mx-3 h-[58px] rounded-xl" aria-hidden="true" />;
}

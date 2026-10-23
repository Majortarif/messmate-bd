import "server-only";
import { connection } from "next/server";
import { getLocale } from "next-intl/server";
import { cache } from "react";
import { redirect } from "@/i18n/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { MyContext } from "@/types/app";

/**
 * Data Access Layer: the only place pages learn who the viewer is.
 * Everything here reads the session cookie, so call it inside <Suspense>
 * (a route's loading.tsx counts). React's cache() dedupes per request.
 */

export const getAuthUser = cache(async () => {
  // Stay request-time even without Supabase env, so builds don't depend on it.
  await connection();
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
});

export type Viewer = {
  id: string;
  email: string | null;
  context: MyContext;
};

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const user = await getAuthUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_my_context");
  const context = (data ?? { profile: null, membership: null }) as MyContext;
  return { id: user.id, email: user.email ?? null, context };
});

async function go(href: string): Promise<never> {
  const locale = await getLocale();
  return redirect({ href, locale });
}

/** Signed in; otherwise to /login. A deleted account only sees /account-deleted. */
export async function requireViewer() {
  const viewer = await getViewer();
  if (!viewer) return go("/login");
  if (viewer.context.profile?.is_deleted) return go("/account-deleted");
  return viewer;
}

/** Signed in, terms accepted and an active/inactive member of a mess; otherwise to onboarding. */
export async function requireMember() {
  const viewer = await requireViewer();
  const membership = viewer.context.membership;
  if (!viewer.context.profile?.terms_accepted || !membership || membership.status === "pending") {
    return go("/onboarding");
  }
  return { ...viewer, membership };
}

/** Signed in with the terms accepted; no mess needed (housing, market, services). */
export async function requireOnboarded() {
  const viewer = await requireViewer();
  if (!viewer.context.profile?.terms_accepted) return go("/onboarding");
  return viewer;
}

/** Platform owner (super admin); anyone else is sent to the dashboard. */
export async function requireSuperAdmin() {
  const viewer = await requireViewer();
  const profile = viewer.context.profile;
  if (profile?.platform_role !== "super_admin" || profile.is_deleted) {
    return go("/dashboard");
  }
  return viewer;
}

/** Active manager of their mess; members are sent to the dashboard. */
export async function requireManager() {
  const member = await requireMember();
  if (member.membership.role !== "manager" || member.membership.status !== "active") {
    return go("/dashboard");
  }
  return member;
}

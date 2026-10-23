import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { applyCookies, refreshSession } from "@/lib/supabase/proxy";

const handleI18nRouting = createIntlMiddleware(routing);

// Pages that need a signed-in user (paths without the locale prefix).
const PROTECTED = [
  "/dashboard", "/onboarding", "/manage", "/meals", "/wallet", "/billing", "/mess", "/care",
  "/housing", "/services", "/market", "/profile", "/settings", "/admin", "/notifications", "/reset-password",
  "/statement",
];
// Pages that only make sense when signed out.
const GUEST_ONLY = ["/login", "/signup", "/forgot-password"];

const matches = (path: string, list: string[]) => list.some((p) => path === p || path.startsWith(`${p}/`));

function splitLocale(pathname: string) {
  for (const locale of routing.locales) {
    if (locale !== routing.defaultLocale && (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`))) {
      return { prefix: `/${locale}`, path: pathname.slice(locale.length + 1) || "/" };
    }
  }
  return { prefix: "", path: pathname };
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = await refreshSession(request);

  // Auth callback route handlers live outside the [locale] tree.
  if (pathname.startsWith("/auth/")) {
    return applyCookies(NextResponse.next({ request }), session.cookies);
  }

  const { prefix, path } = splitLocale(pathname);

  if (!session.isSignedIn && matches(path, PROTECTED)) {
    const url = new URL(`${prefix}/login`, request.url);
    url.searchParams.set("next", `${pathname}${search}`);
    return applyCookies(NextResponse.redirect(url), session.cookies);
  }
  if (session.isSignedIn && matches(path, GUEST_ONLY)) {
    return applyCookies(NextResponse.redirect(new URL(`${prefix}/dashboard`, request.url)), session.cookies);
  }

  return applyCookies(handleI18nRouting(request), session.cookies);
}

export const config = {
  // Everything except Next internals, API routes and files with an extension
  // (icons, manifest, service worker, robots.txt …).
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};

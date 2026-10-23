import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/types/database";
import { env, isSupabaseConfigured } from "@/lib/env";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Refreshes the Supabase session for this request. Updated auth cookies are
 * written onto `request` (so the page rendered next sees them) and returned so
 * the caller can copy them onto whatever response it sends.
 */
export async function refreshSession(request: NextRequest) {
  const cookies: CookieToSet[] = [];
  if (!isSupabaseConfigured) {
    return { isSignedIn: false, cookies };
  }

  const supabase = createServerClient<Database>(env.supabaseUrl, env.supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          request.cookies.set(cookie.name, cookie.value);
          cookies.push(cookie);
        }
      },
    },
  });

  // getClaims() validates the JWT (locally when the project uses asymmetric keys).
  try {
    const { data } = await supabase.auth.getClaims();
    return { isSignedIn: Boolean(data?.claims?.sub), cookies };
  } catch {
    return { isSignedIn: false, cookies };
  }
}

export function applyCookies(response: NextResponse, cookies: CookieToSet[]) {
  for (const { name, value, options } of cookies) {
    response.cookies.set(name, value, options);
  }
  return response;
}

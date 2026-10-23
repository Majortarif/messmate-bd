import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/validations/auth";

/**
 * PKCE return URL for email confirmation, password recovery and Google sign-in.
 * Supabase sends the user here with ?code=…; we trade it for a session cookie.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const base = forwardedHost ? `https://${forwardedHost}` : url.origin;
  const next = safeNext(url.searchParams.get("next"));
  const code = url.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${base}${next}`);
    }
  }

  return NextResponse.redirect(`${base}/login?error=auth_link_invalid`);
}

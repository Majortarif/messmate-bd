import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/validations/auth";

/**
 * Token-hash links (supabase/email-templates, see docs/DEPLOYMENT.md). Unlike the
 * PKCE callback these also work when the email is opened on another device.
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const base = forwardedHost ? `https://${forwardedHost}` : url.origin;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(url.searchParams.get("next"));

  if (tokenHash && type) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      // Email templates can't tell the language, so people who signed up in English go to /en.
      const english = data.user?.user_metadata?.locale === "en" && next !== "/en" && !next.startsWith("/en/");
      return NextResponse.redirect(`${base}${english ? `/en${next}` : next}`);
    }
  }

  return NextResponse.redirect(`${base}/login?error=auth_link_invalid`);
}

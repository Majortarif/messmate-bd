"use server";

import { headers } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { TERMS_VERSION } from "@/lib/constants";
import { env, isSupabaseConfigured } from "@/lib/env";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  safeNext,
  signInSchema,
  signUpSchema,
  type ForgotPasswordInput,
  type ResetPasswordInput,
  type SignInInput,
  type SignUpInput,
} from "@/lib/validations/auth";

const asLocale = (value: string): Locale => (routing.locales.includes(value as Locale) ? (value as Locale) : routing.defaultLocale);
const localePath = (locale: Locale, path: string) => (locale === routing.defaultLocale ? path : `/${locale}${path}`);

/** Public origin of this request (works on localhost, previews and the custom domain). */
async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : env.siteUrl;
}

const callbackUrl = async (next: string) => `${await origin()}/auth/callback?next=${encodeURIComponent(next)}`;

export async function signIn(input: SignInInput): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_credentials");
  if (!isSupabaseConfigured) return fail("not_configured");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  return error ? fail(error) : ok(undefined);
}

export async function signUp(input: SignUpInput, localeInput: string): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return fail("generic");
  if (!isSupabaseConfigured) return fail("not_configured");
  const locale = asLocale(localeInput);
  const { email, password, fullName, phone, accountType } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: await callbackUrl(localePath(locale, "/onboarding")),
      data: {
        full_name: fullName,
        phone: phone || undefined,
        account_type: accountType,
        terms_version: TERMS_VERSION,
        locale,
      },
    },
  });
  if (error) return fail(error);
  // With email confirmation on, Supabase hides existing accounts by returning a user without identities.
  if (data.user && data.user.identities?.length === 0) return fail("user_already_exists");
  return ok({ needsConfirmation: !data.session });
}

export async function signInWithGoogle(nextInput: string | null, localeInput: string): Promise<ActionResult<{ url: string }>> {
  if (!isSupabaseConfigured) return fail("not_configured");
  const locale = asLocale(localeInput);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: await callbackUrl(safeNext(nextInput, localePath(locale, "/dashboard"))),
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) return fail(error);
  return ok({ url: data.url });
}

export async function requestPasswordReset(input: ForgotPasswordInput, localeInput: string): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return fail("email_address_invalid");
  if (!isSupabaseConfigured) return fail("not_configured");
  const locale = asLocale(localeInput);

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: await callbackUrl(localePath(locale, "/reset-password")),
  });
  // Don't reveal whether the email exists; only surface throttling.
  if (error && (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit")) return fail(error);
  return ok(undefined);
}

export async function updatePassword(input: ResetPasswordInput): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return fail("weak_password");
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  return error ? fail(error) : ok(undefined);
}

export async function signOut(localeInput: string) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect({ href: "/login", locale: asLocale(localeInput) });
}

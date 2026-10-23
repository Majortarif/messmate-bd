import { FileText, KeyRound, LifeBuoy, Mail, ShieldCheck, UserRound, Users } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AvatarEditor, DeleteAccountButton, ExportDataButton, LeaveMessButton, PasswordForm, ProfileForm } from "@/components/account/account-forms";
import { PageHeader } from "@/components/shared/states";
import { ToneBadge } from "@/components/shared/tone-badge";
import { Link } from "@/i18n/navigation";
import { requireViewer } from "@/lib/dal";
import { formatDate, formatTaka } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { BLOOD_GROUPS } from "@/lib/validations/account";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("title") };
}

function Section({ id, icon: Icon, title, body, children }: { id: string; icon: typeof UserRound; title: string; body?: string; children: ReactNode }) {
  return (
    <section id={id} className="grid scroll-mt-20 gap-4 rounded-2xl border bg-card p-4 sm:p-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
          {title}
        </h2>
        {body && <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>}
      </div>
      {children}
    </section>
  );
}

export default async function SettingsPage() {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const membership = viewer.context.membership;
  const inMess = membership && (membership.status === "active" || membership.status === "inactive");
  const [{ data: profile }, { data: auth }, balanceRes, t, tr, locale] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", viewer.id).single(),
    supabase.auth.getUser(),
    inMess
      ? supabase.from("member_balances").select("balance").eq("mess_id", membership.mess_id).eq("user_id", viewer.id).maybeSingle()
      : Promise.resolve({ data: null }),
    getTranslations("settings"),
    getTranslations("roles"),
    getLocale(),
  ]);
  const providers = (auth.user?.app_metadata?.providers as string[] | undefined) ?? [auth.user?.app_metadata?.provider ?? "email"];
  const hasPassword = providers.includes("email");
  const balance = Number(balanceRes.data?.balance ?? 0);
  const p = profile;

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-5">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 text-sm" aria-label={t("jump")}>
        {(["profile", "password", ...(inMess ? ["mess"] : []), "data"] as const).map((s) => (
          <a key={s} href={`#${s}`} className="inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-muted-foreground hover:text-foreground">
            {t(`jumpTo.${s as "profile"}`)}
          </a>
        ))}
      </nav>

      <Section id="profile" icon={UserRound} title={t("profile.title")} body={t("profile.body")}>
        <AvatarEditor userId={viewer.id} name={p?.full_name || viewer.email || ""} url={p?.avatar_url ?? null} />
        <ProfileForm
          initial={{
            fullName: p?.full_name ?? "",
            phone: p?.phone ?? "",
            gender: p?.gender ?? null,
            occupation: p?.occupation ?? null,
            institution: p?.institution ?? "",
            homeDistrict: p?.home_district ?? "",
            bloodGroup: BLOOD_GROUPS.find((b) => b === p?.blood_group) ?? null,
            bio: p?.bio ?? "",
            guardianName: p?.guardian_name ?? "",
            guardianPhone: p?.guardian_phone ?? "",
            preferredLocale: p?.preferred_locale === "en" ? "en" : "bn",
          }}
        />
      </Section>

      <Section id="password" icon={KeyRound} title={t("password.title")}>
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <Mail className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="font-medium">{viewer.email}</span>
          {providers.map((pr) => (
            <ToneBadge key={pr} tone="muted">
              {pr === "google" ? "Google" : t("password.emailLogin")}
            </ToneBadge>
          ))}
        </p>
        <PasswordForm hasPassword={hasPassword} />
      </Section>

      {inMess && membership && (
        <Section id="mess" icon={Users} title={t("mess.title")}>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/50 px-4 py-3">
            <div className="min-w-0">
              <p className="font-medium">{membership.mess_name}</p>
              <p className="text-sm text-muted-foreground">
                {tr(membership.role)} · {t("mess.balance", { amount: formatTaka(balance, locale) })}
              </p>
            </div>
            <LeaveMessButton messName={membership.mess_name} balance={formatTaka(balance, locale)} />
          </div>
          <p className="text-xs text-muted-foreground">{t("mess.note")}</p>
        </Section>
      )}

      <Section id="data" icon={ShieldCheck} title={t("data.title")} body={t("data.body")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid content-start gap-2 rounded-xl border p-4">
            <p className="font-medium">{t("data.exportTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("data.exportBody")}</p>
            <div>
              <ExportDataButton />
            </div>
          </div>
          <div className="grid content-start gap-2 rounded-xl border border-coral/30 p-4">
            <p className="font-medium">{t("data.deleteTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("data.deleteCard")}</p>
            <div>
              <DeleteAccountButton />
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("data.since", { date: formatDate(p?.created_at ?? new Date().toISOString(), locale, { day: "numeric", month: "long", year: "numeric" }) })}
          {p?.terms_accepted_at && ` · ${t("data.accepted", { date: formatDate(p.terms_accepted_at, locale, { day: "numeric", month: "long", year: "numeric" }) })}`}
        </p>
      </Section>

      <section className="grid gap-2 sm:grid-cols-3">
        <Link href="/privacy" className="card-hover flex items-center gap-2 rounded-2xl border bg-card px-4 py-3 text-sm font-medium">
          <ShieldCheck className="size-4 text-mint" aria-hidden="true" />
          {t("links.privacy")}
        </Link>
        <Link href="/terms" className="card-hover flex items-center gap-2 rounded-2xl border bg-card px-4 py-3 text-sm font-medium">
          <FileText className="size-4 text-mint" aria-hidden="true" />
          {t("links.terms")}
        </Link>
        <Link href="/feedback" className="card-hover flex items-center gap-2 rounded-2xl border bg-card px-4 py-3 text-sm font-medium">
          <LifeBuoy className="size-4 text-mint" aria-hidden="true" />
          {t("links.feedback")}
        </Link>
      </section>
    </div>
  );
}

import { KeyRound } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { JoinMessForm } from "@/components/onboarding/join-mess-form";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getViewer } from "@/lib/dal";
import { inviteCodeField } from "@/lib/validations/mess";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("join");
  return { title: t("metaTitle"), robots: { index: false } };
}

/** Shareable invite link: /join/NEER2026 */
export default async function JoinPage({ params }: PageProps<"/[locale]/join/[code]">) {
  const { code: raw } = await params;
  const parsed = inviteCodeField.safeParse(decodeURIComponent(raw));
  const code = parsed.success ? parsed.data : "";
  const [viewer, t] = await Promise.all([getViewer(), getTranslations("join")]);
  const self = `/join/${code}`;
  const membership = viewer?.context.membership;

  let body: ReactNode;
  if (!code) {
    body = <p className="text-sm text-muted-foreground">{t("invalid")}</p>;
  } else if (!viewer) {
    body = (
      <div className="grid gap-4">
        <p className="text-sm leading-relaxed text-muted-foreground">{t("guestBody")}</p>
        <p className="rounded-xl bg-muted py-3 text-center font-mono text-xl tracking-[0.3em]">{code}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button asChild className="h-11">
            <Link href={`/signup?next=${encodeURIComponent(self)}`}>{t("signupToJoin")}</Link>
          </Button>
          <Button asChild variant="outline" className="h-11">
            <Link href={`/login?next=${encodeURIComponent(self)}`}>{t("loginToJoin")}</Link>
          </Button>
        </div>
      </div>
    );
  } else if (!viewer.context.profile?.terms_accepted || membership) {
    body = (
      <div className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          {membership ? t("alreadyInMess", { mess: membership.mess_name }) : t("finishSetup")}
        </p>
        <Button asChild className="h-11">
          <Link href={membership && membership.status !== "pending" ? "/dashboard" : "/onboarding"}>{t("continue")}</Link>
        </Button>
      </div>
    );
  } else {
    body = <JoinMessForm initialCode={code} />;
  }

  return (
    <div className="glow-mint min-h-dvh px-4 py-10">
      <div className="mx-auto max-w-lg">
        <Link href="/" className="mb-8 inline-block" aria-label="MessMate BD">
          <Logo />
        </Link>
        <div className="rounded-2xl border bg-card p-6 sm:p-8">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-mint-soft text-mint">
            <KeyRound className="size-6" aria-hidden="true" />
          </span>
          <h1 className="mb-4 mt-4 text-2xl font-bold">{t("title")}</h1>
          {body}
        </div>
      </div>
    </div>
  );
}

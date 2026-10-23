import { Building2, KeyRound, PlusCircle, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { CreateMessForm, type AreaOption } from "@/components/onboarding/create-mess-form";
import { JoinMessForm } from "@/components/onboarding/join-mess-form";
import { PendingCard } from "@/components/onboarding/pending-card";
import { TermsGate } from "@/components/onboarding/terms-gate";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, redirect } from "@/i18n/navigation";
import { requireViewer } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("onboarding");
  return { title: t("metaTitle") };
}

/** For people who don't have a mess yet: look for a seat or a roommate first. */
function ExploreHousing({ t }: { t: Awaited<ReturnType<typeof getTranslations<"onboarding">>> }) {
  return (
    <section className="mt-6 rounded-2xl border border-dashed p-5">
      <h2 className="font-semibold">{t("explore.title")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("explore.body")}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Link href="/housing" className="card-hover flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm font-medium">
          <Building2 className="size-5 text-mint" aria-hidden="true" />
          {t("explore.housing")}
        </Link>
        <Link href="/housing/roommates" className="card-hover flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm font-medium">
          <UsersRound className="size-5 text-mint" aria-hidden="true" />
          {t("explore.roommates")}
        </Link>
      </div>
    </section>
  );
}

export default async function OnboardingPage() {
  const [viewer, t, locale] = await Promise.all([requireViewer(), getTranslations("onboarding"), getLocale()]);
  const { profile, membership } = viewer.context;
  const firstName = profile?.full_name?.split(" ")[0] ?? "";

  if (profile?.terms_accepted && membership && membership.status !== "pending") {
    redirect({ href: "/dashboard", locale });
  }

  const header = (
    <div className="mb-6">
      <h1 className="text-2xl font-bold sm:text-3xl">{t("title", { name: firstName })}</h1>
      <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
    </div>
  );

  if (!profile?.terms_accepted) {
    return (
      <>
        {header}
        <TermsGate />
      </>
    );
  }

  if (membership?.status === "pending") {
    return (
      <>
        {header}
        <PendingCard messName={membership.mess_name} requestedAt={membership.requested_at} />
        <ExploreHousing t={t} />
      </>
    );
  }

  const supabase = await createClient();
  const { data: areas } = await supabase.from("areas").select("id, name_bn, name_en").order("sort_order");

  return (
    <>
      {header}
      <Tabs defaultValue="join" className="gap-4">
        <TabsList className="grid h-auto w-full grid-cols-2 p-1">
          <TabsTrigger value="join" className="h-10 gap-2">
            <KeyRound className="size-4" aria-hidden="true" />
            {t("tabs.join")}
          </TabsTrigger>
          <TabsTrigger value="create" className="h-10 gap-2">
            <PlusCircle className="size-4" aria-hidden="true" />
            {t("tabs.create")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="join" className="rounded-2xl border bg-card p-5 sm:p-7">
          <h2 className="text-lg font-semibold">{t("join.title")}</h2>
          <p className="mb-5 mt-1 text-sm text-muted-foreground">{t("join.body")}</p>
          <JoinMessForm />
        </TabsContent>
        <TabsContent value="create" className="rounded-2xl border bg-card p-5 sm:p-7">
          <h2 className="text-lg font-semibold">{t("create.title")}</h2>
          <p className="mb-5 mt-1 text-sm text-muted-foreground">{t("create.body")}</p>
          <CreateMessForm areas={(areas ?? []) as AreaOption[]} />
        </TabsContent>
      </Tabs>
      <ExploreHousing t={t} />
    </>
  );
}

import { Vote } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MessTabs } from "@/components/mess/mess-tabs";
import { NewPollButton, PollCard } from "@/components/mess/polls";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { requireMember } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import type { MessPoll } from "@/types/app";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("mess.polls");
  return { title: t("title") };
}

export default async function PollsPage() {
  const member = await requireMember();
  const isManager = member.membership.role === "manager" && member.membership.status === "active";
  const supabase = await createClient();
  const [result, t] = await Promise.all([supabase.rpc("get_mess_polls", { p_limit: 40 }), getTranslations("mess.polls")]);
  if (result.error) throw new Error(result.error.message);
  const polls = (result.data ?? []) as unknown as MessPoll[];
  const canVote = member.membership.status === "active";

  return (
    <div className="grid gap-5">
      <PageHeader title={t("title")} description={t("subtitle")} actions={canVote ? <NewPollButton /> : null} />
      <MessTabs active="polls" />
      {polls.length === 0 ? (
        <EmptyState icon={Vote} title={t("empty")} body={t("emptyBody")} action={canVote ? <NewPollButton /> : undefined} className="rounded-2xl border bg-card py-12" />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {polls.map((p) => (
            <li key={p.id}>
              <PollCard poll={p} canManage={isManager || p.created_by === member.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

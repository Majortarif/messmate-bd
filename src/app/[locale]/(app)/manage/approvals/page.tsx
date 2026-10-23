import { History } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { ManualEntryButton, PendingDeposits, RecentEntries, type PendingDeposit, type RecentEntry } from "@/components/manage/approvals";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { requestTone, ToneBadge } from "@/components/shared/tone-badge";
import { requireManager } from "@/lib/dal";
import { formatDate, formatTaka } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("manage.approvals");
  return { title: t("title") };
}

const REVERSIBLE = new Set(["deposit", "adjustment", "refund_payout", "reimbursement"]);

export default async function ApprovalsPage() {
  const manager = await requireManager();
  const messId = manager.membership.mess_id;
  const supabase = await createClient();

  const [pendingRes, reviewedRes, membersRes, balancesRes, ledgerRes, t, locale] = await Promise.all([
    supabase
      .from("deposit_requests")
      .select("id, user_id, amount, method, trx_id, sender_number, paid_at, note, proof_path, created_at, member:profiles!deposit_requests_user_id_fkey(full_name, phone)")
      .eq("mess_id", messId)
      .eq("status", "pending")
      .order("created_at"),
    supabase
      .from("deposit_requests")
      .select("id, amount, method, trx_id, status, reviewed_at, member:profiles!deposit_requests_user_id_fkey(full_name)")
      .eq("mess_id", messId)
      .neq("status", "pending")
      .order("reviewed_at", { ascending: false })
      .limit(10),
    supabase
      .from("mess_members")
      .select("user_id, status, profile:profiles!mess_members_user_id_fkey(full_name)")
      .eq("mess_id", messId)
      .in("status", ["active", "inactive", "left"])
      .order("joined_at"),
    supabase.from("member_balances").select("user_id, balance").eq("mess_id", messId),
    supabase
      .from("ledger_entries")
      .select("id, entry_type, amount, description, created_at, reverses_id, member:profiles!ledger_entries_user_id_fkey(full_name)")
      .eq("mess_id", messId)
      .order("created_at", { ascending: false })
      .limit(25),
    getTranslations("manage.approvals"),
    getLocale(),
  ]);

  const balance = new Map((balancesRes.data ?? []).map((b) => [b.user_id, Number(b.balance ?? 0)]));
  const pendingRows = pendingRes.data ?? [];
  const proofPaths = pendingRows.map((p) => p.proof_path).filter((p): p is string => Boolean(p));
  const signed = proofPaths.length
    ? (await supabase.storage.from("deposit-proofs").createSignedUrls(proofPaths, 3600)).data ?? []
    : [];
  const proofUrl = new Map(signed.filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl]));

  const pending: PendingDeposit[] = pendingRows.map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    method: p.method,
    trxId: p.trx_id,
    sender: p.sender_number,
    paidAt: p.paid_at,
    note: p.note,
    proofUrl: p.proof_path ? proofUrl.get(p.proof_path) ?? null : null,
    createdAt: p.created_at,
    memberName: p.member?.full_name || "—",
    memberPhone: p.member?.phone ?? null,
    balance: balance.get(p.user_id) ?? 0,
  }));

  const ledger = ledgerRes.data ?? [];
  const reversed = new Set(ledger.map((l) => l.reverses_id).filter(Boolean));
  const recent: RecentEntry[] = ledger.map((l) => ({
    id: l.id,
    type: l.entry_type,
    amount: Number(l.amount),
    description: l.description,
    createdAt: l.created_at,
    memberName: l.member?.full_name || "—",
    reversible: REVERSIBLE.has(l.entry_type) && !reversed.has(l.id),
  }));

  const members = (membersRes.data ?? []).map((m) => ({
    userId: m.user_id,
    name: `${m.profile?.full_name || "—"}${m.status === "left" ? ` (${t("left")})` : ""}`,
    balance: balance.get(m.user_id) ?? 0,
  }));

  return (
    <div className="grid gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} actions={<ManualEntryButton members={members} />} />

      <section className="grid gap-3">
        <h2 className="font-semibold">{t("pendingTitle", { count: pending.length })}</h2>
        <PendingDeposits items={pending} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <History className="size-[18px] text-muted-foreground" aria-hidden="true" />
            {t("reviewedTitle")}
          </h2>
          {(reviewedRes.data ?? []).length === 0 ? (
            <EmptyState icon={History} title={t("reviewedEmpty")} className="py-4" />
          ) : (
            <ul className="divide-y">
              {reviewedRes.data!.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.member?.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.trx_id ?? t("cash")} · {r.reviewed_at ? formatDate(r.reviewed_at, locale) : ""}
                    </p>
                  </div>
                  <span className="num text-sm font-semibold">{formatTaka(r.amount, locale)}</span>
                  <ToneBadge tone={requestTone[r.status]}>{t(`status.${r.status}`)}</ToneBadge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border bg-card p-5">
          <h2 className="mb-1 font-semibold">{t("recent.heading")}</h2>
          <p className="mb-3 text-xs text-muted-foreground">{t("recent.hint")}</p>
          <RecentEntries entries={recent} />
        </section>
      </div>
    </div>
  );
}

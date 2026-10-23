import { PartyPopper, Phone, Users } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { InviteCard } from "@/components/manage/invite-card";
import { JoinRequests, type JoinRequest } from "@/components/manage/join-requests";
import { MemberActions } from "@/components/manage/member-actions";
import { RoomManager, type RoomRow } from "@/components/manage/rooms";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { ToneBadge } from "@/components/shared/tone-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { requireManager } from "@/lib/dal";
import { formatDate, formatNumber, formatTaka, initials } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("members");
  return { title: t("title") };
}

export default async function MembersPage({ searchParams }: PageProps<"/[locale]/manage/members">) {
  const manager = await requireManager();
  const messId = manager.membership.mess_id;
  const supabase = await createClient();
  const [{ welcome }, t, tr, locale, messResult, membersResult, roomsResult, balancesResult] = await Promise.all([
    searchParams,
    getTranslations("members"),
    getTranslations("roles"),
    getLocale(),
    supabase.from("messes").select("id, name, invite_code, invite_enabled").eq("id", messId).single(),
    supabase
      .from("mess_members")
      .select(
        "id, user_id, role, status, room_id, seat_label, joined_at, created_at, request_note, room:mess_rooms(room_label), profile:profiles!mess_members_user_id_fkey(full_name, phone, avatar_url, institution)",
      )
      .eq("mess_id", messId)
      .in("status", ["pending", "active", "inactive"])
      .order("created_at"),
    supabase.from("mess_rooms").select("id, building, flat, room_label, room_type, capacity, monthly_rent").eq("mess_id", messId).order("room_label"),
    supabase.from("member_balances").select("user_id, balance").eq("mess_id", messId),
  ]);

  if (messResult.error) throw new Error(messResult.error.message);
  const mess = messResult.data;
  const rows = membersResult.data ?? [];
  const balance = new Map((balancesResult.data ?? []).map((b) => [b.user_id, Number(b.balance ?? 0)]));

  const requests: JoinRequest[] = rows
    .filter((r) => r.status === "pending")
    .map((r) => ({
      id: r.id,
      requestedAt: r.created_at,
      note: r.request_note,
      name: r.profile?.full_name || "—",
      phone: r.profile?.phone ?? null,
      avatarUrl: r.profile?.avatar_url ?? null,
      occupation: r.profile?.institution ?? null,
    }));
  const members = rows.filter((r) => r.status === "active" || r.status === "inactive");

  const occupants = new Map<string, number>();
  for (const m of members) if (m.room_id) occupants.set(m.room_id, (occupants.get(m.room_id) ?? 0) + 1);
  const rooms: RoomRow[] = (roomsResult.data ?? []).map((r) => ({
    id: r.id,
    building: r.building,
    flat: r.flat,
    label: r.room_label,
    type: r.room_type,
    capacity: r.capacity,
    rent: Number(r.monthly_rent),
    occupants: occupants.get(r.id) ?? 0,
  }));
  const roomOptions = rooms.map((r) => ({ id: r.id, label: r.label, free: r.capacity - r.occupants }));

  return (
    <div className="grid gap-6">
      <PageHeader title={t("title")} description={t("subtitle", { mess: mess.name })} />

      {welcome && (
        <div className="flex items-start gap-3 rounded-2xl border border-primary/30 bg-mint-soft p-4">
          <PartyPopper className="mt-0.5 size-5 shrink-0 text-mint" aria-hidden="true" />
          <div>
            <p className="font-semibold">{t("welcomeTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("welcomeBody")}</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <InviteCard messId={mess.id} messName={mess.name} code={mess.invite_code} enabled={mess.invite_enabled} />
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold">
            {t("requests.title")}
            {requests.length > 0 && <Badge className="bg-marigold text-[#2a1a02]">{formatNumber(requests.length, locale)}</Badge>}
          </h2>
          <JoinRequests requests={requests} />
        </section>
      </div>

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="mb-4 font-semibold">{t("list.title", { count: formatNumber(members.length, locale) })}</h2>
        {members.length === 0 ? (
          <EmptyState icon={Users} title={t("list.empty")} />
        ) : (
          <ul className="grid gap-2 lg:grid-cols-2">
            {members.map((m) => {
              const name = m.profile?.full_name || "—";
              const bal = balance.get(m.user_id) ?? 0;
              return (
                <li key={m.id} className="flex items-center gap-3 rounded-xl border px-3 py-3">
                  <Avatar className="size-10">
                    {m.profile?.avatar_url && <AvatarImage src={m.profile.avatar_url} alt="" />}
                    <AvatarFallback className="bg-mint-soft text-sm font-semibold text-mint">{initials(name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate font-medium">
                      {name}
                      {m.user_id === manager.id && <span className="text-xs font-normal text-muted-foreground">({t("list.you")})</span>}
                      {m.role === "manager" && <ToneBadge tone="mint">{tr("manager")}</ToneBadge>}
                      {m.status === "inactive" && <ToneBadge tone="muted">{t("list.inactive")}</ToneBadge>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {m.room?.room_label ? t("list.room", { room: m.room.room_label }) : t("list.noRoom")}
                      {m.seat_label ? ` · ${m.seat_label}` : ""}
                      {m.joined_at ? ` · ${t("list.joined", { date: formatDate(m.joined_at, locale) })}` : ""}
                    </p>
                  </div>
                  <span className={cn("num shrink-0 text-sm font-semibold", bal < 0 ? "text-coral" : "text-mint")} title={t("list.balance")}>
                    {formatTaka(bal, locale)}
                  </span>
                  {m.profile?.phone && (
                    <a
                      href={`tel:${m.profile.phone}`}
                      className="hidden size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground sm:flex"
                      aria-label={t("list.call", { name })}
                    >
                      <Phone className="size-4" />
                    </a>
                  )}
                  <MemberActions
                    membershipId={m.id}
                    name={name}
                    role={m.role}
                    status={m.status as "active" | "inactive"}
                    roomId={m.room_id}
                    seat={m.seat_label}
                    rooms={roomOptions}
                    isSelf={m.user_id === manager.id}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <RoomManager messId={messId} rooms={rooms} />
    </div>
  );
}

import { Clock, ExternalLink, MapPin, Navigation, Phone, PhoneCall, ShieldCheck, Star, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { CareNav } from "@/components/care/care-nav";
import { AddContactButton, ContactMenu, type Messmate } from "@/components/care/contacts";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { ToneBadge } from "@/components/shared/tone-badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { areaName, getAreas } from "@/lib/community";
import { requireOnboarded } from "@/lib/dal";
import { directionsHref } from "@/lib/links";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("care.emergency");
  return { title: t("title") };
}

const KINDS = ["hospital", "ambulance", "police", "fire_service", "pharmacy", "blood_bank", "helpline", "mental_health"] as const;

export default async function EmergencyPage({ searchParams }: PageProps<"/[locale]/care/emergency">) {
  const viewer = await requireOnboarded();
  const sp = await searchParams;
  const kind = KINDS.find((k) => k === sp.kind) ?? null;
  const area = typeof sp.area === "string" && /^\d+$/.test(sp.area) ? Number(sp.area) : null;
  const supabase = await createClient();
  const messId = viewer.context.membership?.status === "active" ? viewer.context.membership.mess_id : null;

  let places = supabase
    .from("emergency_places")
    .select("id, kind, name_bn, name_en, area_id, phone, address, lat, lng, is_24h, website, notes")
    .order("sort_order")
    .order("name_en")
    .limit(120);
  if (kind) places = places.eq("kind", kind);
  if (area) places = places.or(`area_id.eq.${area},area_id.is.null`);

  const [placesRes, contactsRes, matesRes, areas, t, tk, locale] = await Promise.all([
    places,
    supabase.from("emergency_contacts").select("*").order("is_primary", { ascending: false }).order("name"),
    messId
      ? supabase
          .from("mess_members")
          .select("user_id, profile:profiles!mess_members_user_id_fkey(full_name, phone)")
          .eq("mess_id", messId)
          .eq("status", "active")
          .neq("user_id", viewer.id)
      : Promise.resolve({ data: [] as { user_id: string; profile: { full_name: string; phone: string | null } | null }[] }),
    getAreas(),
    getTranslations("care.emergency"),
    getTranslations("placeKinds"),
    getLocale(),
  ]);
  const list = placesRes.data ?? [];
  const contacts = contactsRes.data ?? [];
  const messmates: Messmate[] = (matesRes.data ?? []).map((m) => ({ id: m.user_id, name: m.profile?.full_name || "—", phone: m.profile?.phone ?? null }));
  const areaById = new Map(areas.map((a) => [a.id, a]));
  const href = (patch: { kind?: string | null; area?: number | null }) => {
    const next = { kind: patch.kind !== undefined ? patch.kind : kind, area: patch.area !== undefined ? patch.area : area };
    const qs = new URLSearchParams(Object.entries(next).filter((e): e is [string, string | number] => e[1] !== null).map(([k, v]) => [k, String(v)]));
    return qs.size ? `/care/emergency?${qs}` : "/care/emergency";
  };

  return (
    <div className="grid gap-5">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <CareNav active="emergency" />

      <a
        href="tel:999"
        className="flex items-center gap-4 rounded-2xl bg-coral p-5 text-white shadow-lg shadow-coral/25 transition-transform active:scale-[0.99]"
      >
        <PhoneCall className="size-9 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-2xl font-bold">999</span>
          <span className="block text-sm opacity-90">{t("national")}</span>
        </span>
        <span className="rounded-xl bg-white/20 px-4 py-2 font-semibold">{t("call")}</span>
      </a>

      <section id="contacts" className="grid scroll-mt-20 gap-3 rounded-2xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 font-semibold">
              <UsersRound className="size-[18px] text-muted-foreground" aria-hidden="true" />
              {t("myContacts")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("myContactsBody")}</p>
          </div>
          <AddContactButton messmates={messmates} />
        </div>
        {contacts.length === 0 ? (
          <EmptyState icon={UsersRound} title={t("noContacts")} body={t("noContactsBody")} className="py-4" />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {contacts.map((c) => (
              <li key={c.id} className="flex items-center gap-3 rounded-xl border px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-medium">
                    {c.is_primary && <Star className="size-3.5 shrink-0 fill-marigold text-marigold" aria-label={t("primary")} />}
                    {c.name}
                    {c.relation && <span className="font-normal text-muted-foreground"> · {c.relation}</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.phone}
                    {c.contact_user_id ? ` · ${t("inApp")}` : ` · ${t("byWhatsapp")}`}
                  </p>
                </div>
                <Button asChild size="icon" variant="outline">
                  <a href={`tel:${c.phone}`} aria-label={t("callName", { name: c.name })}>
                    <Phone className="size-4" />
                  </a>
                </Button>
                <ContactMenu
                  id={c.id}
                  name={c.name}
                  messmates={messmates}
                  initial={{
                    name: c.name,
                    relation: c.relation ?? "",
                    phone: c.phone,
                    contactUserId: c.contact_user_id,
                    isPrimary: c.is_primary,
                    notifyOnSos: c.notify_on_sos,
                    notifyOnSick: c.notify_on_sick,
                    notifyOnCheckin: c.notify_on_checkin,
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="font-semibold">{t("directory")}</h2>
        <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label={t("kindFilter")}>
          {[null, ...KINDS].map((k) => (
            <Link
              key={k ?? "all"}
              href={href({ kind: k })}
              aria-current={k === kind ? "page" : undefined}
              className={cn(
                "inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-sm transition-colors",
                k === kind ? "border-primary/50 bg-mint-soft font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {k ? tk(k) : t("all")}
            </Link>
          ))}
        </nav>
        <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label={t("areaFilter")}>
          {[null, ...areas.slice(0, 16).map((a) => a.id)].map((id) => (
            <Link
              key={id ?? "all"}
              href={href({ area: id })}
              aria-current={id === area ? "page" : undefined}
              className={cn(
                "inline-flex h-9 shrink-0 items-center rounded-full border px-3 text-xs transition-colors",
                id === area ? "border-primary/50 bg-mint-soft font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {id ? areaName(areaById.get(id), locale) : t("allAreas")}
            </Link>
          ))}
        </nav>
        {list.length === 0 ? (
          <EmptyState icon={ShieldCheck} title={t("noPlaces")} className="rounded-2xl border bg-card py-10" />
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {list.map((p) => {
              const lat = p.lat === null ? null : Number(p.lat);
              const lng = p.lng === null ? null : Number(p.lng);
              return (
                <li key={p.id} className="flex items-start gap-3 rounded-2xl border bg-card p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <ToneBadge tone={p.kind === "mental_health" || p.kind === "helpline" ? "sky" : p.kind === "pharmacy" ? "mint" : "coral"}>{tk(p.kind)}</ToneBadge>
                      {p.is_24h && (
                        <ToneBadge tone="muted">
                          <Clock className="size-3" aria-hidden="true" />
                          {t("open24")}
                        </ToneBadge>
                      )}
                    </div>
                    <p className="mt-1 font-medium">{locale === "en" ? p.name_en : p.name_bn}</p>
                    {(p.address || p.area_id) && (
                      <p className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
                        <MapPin className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                        {[p.address, p.area_id ? areaName(areaById.get(p.area_id), locale) : null].filter(Boolean).join(", ")}
                      </p>
                    )}
                    {p.notes && <p className="mt-1 text-xs text-muted-foreground">{p.notes}</p>}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {lat !== null && lng !== null && (
                        <Button asChild size="sm" variant="ghost" className="h-8 px-2">
                          <a href={directionsHref(lat, lng)} target="_blank" rel="noreferrer">
                            <Navigation className="size-3.5" aria-hidden="true" />
                            {t("directions")}
                          </a>
                        </Button>
                      )}
                      {p.website && (
                        <Button asChild size="sm" variant="ghost" className="h-8 px-2">
                          <a href={p.website} target="_blank" rel="noreferrer">
                            <ExternalLink className="size-3.5" aria-hidden="true" />
                            {t("website")}
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                  {p.phone && (
                    <Button asChild className="shrink-0">
                      <a href={`tel:${p.phone.replace(/[^\d+]/g, "")}`} aria-label={t("callName", { name: locale === "en" ? p.name_en : p.name_bn })}>
                        <Phone className="size-4" aria-hidden="true" />
                        <span className="num">{p.phone}</span>
                      </a>
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">{t("disclaimer")}</p>
      </section>
    </div>
  );
}

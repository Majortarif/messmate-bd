import { ArrowLeft, CalendarDays, CheckCircle2, MapPin } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { ChecklistItems, DeleteChecklistButton, HandoverForm } from "@/components/housing/move-checklist";
import { ToneBadge } from "@/components/shared/tone-badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requireOnboarded } from "@/lib/dal";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("housing.move");
  return { title: t("title"), robots: { index: false } };
}

export default async function MoveChecklistPage({ params }: PageProps<"/[locale]/housing/move/[id]">) {
  const viewer = await requireOnboarded();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const [{ data: c }, t, locale] = await Promise.all([
    supabase
      .from("move_checklists")
      .select("*, items:move_checklist_items(id, label, is_done, note, photo_path, sort_order)")
      .eq("id", id)
      .maybeSingle(),
    getTranslations("housing.move"),
    getLocale(),
  ]);
  if (!c) notFound();

  const items = [...(c.items ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  // personal bucket is private: short-lived signed links for the photos
  const paths = items.map((i) => i.photo_path).filter((p): p is string => Boolean(p));
  const signed = paths.length ? ((await supabase.storage.from("personal").createSignedUrls(paths, 3600)).data ?? []) : [];
  const urlFor = new Map(signed.filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl]));
  const num = (v: number | string | null) => (v === null ? "" : Number(v));

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between gap-2 print:hidden">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/housing/move">
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t("back")}
          </Link>
        </Button>
        <DeleteChecklistButton checklistId={c.id} title={c.title} />
      </div>

      <header>
        <div className="flex flex-wrap items-center gap-2">
          <ToneBadge tone={c.kind === "move_in" ? "sky" : "marigold"}>{t(`kinds.${c.kind}`)}</ToneBadge>
          {c.completed_at && (
            <ToneBadge tone="mint">
              <CheckCircle2 className="size-3" aria-hidden="true" />
              {t("completedOn", { date: formatDate(c.completed_at, locale, { day: "numeric", month: "short", year: "numeric" }) })}
            </ToneBadge>
          )}
        </div>
        <h1 className="mt-2 text-2xl font-semibold sm:text-[1.7rem]">{c.title}</h1>
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {c.property_address && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden="true" />
              {c.property_address}
            </span>
          )}
          {c.scheduled_date && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" aria-hidden="true" />
              {formatDate(c.scheduled_date, locale, { weekday: "long", day: "numeric", month: "long" })}
            </span>
          )}
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <ChecklistItems
          checklistId={c.id}
          userId={viewer.id}
          items={items.map((i) => ({
            id: i.id,
            label: i.label,
            isDone: i.is_done,
            note: i.note,
            photoUrl: i.photo_path ? (urlFor.get(i.photo_path) ?? null) : null,
          }))}
        />
        <HandoverForm
          checklistId={c.id}
          completed={Boolean(c.completed_at)}
          initial={{
            handoverTo: c.handover_to ?? "",
            handoverPhone: c.handover_phone ?? "",
            electricityMeter: num(c.electricity_meter),
            gasMeter: num(c.gas_meter),
            waterMeter: num(c.water_meter),
            keysCount: num(c.keys_count),
            depositAmount: num(c.deposit_amount),
            depositReturned: num(c.deposit_returned),
            handoverNotes: c.handover_notes ?? "",
          }}
        />
      </div>
    </div>
  );
}

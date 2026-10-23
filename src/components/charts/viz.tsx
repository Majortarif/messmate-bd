"use client";

import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useState, useSyncExternalStore } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Rectangle,
  ReferenceLine,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";
import { formatCompact, formatDate, formatNumber, formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * Chart building blocks. Colours come from --chart-1..4 in globals.css (an
 * order validated for colour-blind separation); marks follow one spec:
 * columns ≤ 24px with a 4px rounded data end, a 2px card-coloured gap between
 * touching bars, solid hairline grid, and a table view for every chart.
 */

const AXIS = { stroke: "var(--chart-axis)" };

const noSubscribe = () => () => {};
/** Draw-in animation only when it can be seen and the reader hasn't asked for less motion. */
function useAnimate() {
  return useSyncExternalStore(
    noSubscribe,
    () => document.visibilityState === "visible" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
}
const GRID = "var(--chart-grid)";
const GAP = { stroke: "var(--card)", strokeWidth: 2 };

// ------------------------------------------------------------------ frame ---
export function ChartCard({
  title,
  description,
  legend,
  table,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  legend?: ReactNode;
  table: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const t = useTranslations("charts");
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <section className={cn("min-w-0 rounded-2xl border bg-card p-4 sm:p-5", className)}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        <div className="flex rounded-lg border p-0.5 text-xs" role="group" aria-label={t("view")}>
          {(["chart", "table"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={cn(
                "h-8 rounded-md px-3 transition-colors",
                view === v ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(v)}
            </button>
          ))}
        </div>
      </div>
      {view === "chart" ? (
        <>
          {legend && <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">{legend}</div>}
          {children}
        </>
      ) : (
        <div className="max-h-80 overflow-auto rounded-xl border">{table}</div>
      )}
    </section>
  );
}

/** Legend key: a swatch shaped like the mark (rect for bars, line for lines). */
export function LegendKey({ color, label, shape = "rect" }: { color: string; label: ReactNode; shape?: "rect" | "line" }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn("inline-block shrink-0", shape === "rect" ? "size-2.5 rounded-[3px]" : "h-0.5 w-3.5 rounded-full")}
        style={{ background: color }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

export type TableColumn = { key: string; label: ReactNode; numeric?: boolean };

export function VizTable({ columns, rows }: { columns: TableColumn[]; rows: Record<string, ReactNode>[] }) {
  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-card">
        <tr className="border-b text-left text-xs text-muted-foreground">
          {columns.map((c) => (
            <th key={c.key} scope="col" className={cn("px-3 py-2 font-medium", c.numeric && "text-right")}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-b last:border-0">
            {columns.map((c) => (
              <td key={c.key} className={cn("px-3 py-1.5", c.numeric && "num text-right")}>
                {row[c.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------- tooltip ---
type Row = { key: string; label: ReactNode; color: string };

/** One readout per x position: the value leads, the series name follows. */
function Readout({
  active,
  payload,
  title,
  rows,
  format,
}: Pick<TooltipContentProps<number, string>, "active" | "payload"> & {
  title: ReactNode;
  rows: Row[];
  format: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const datum = payload[0]?.payload as Record<string, number>;
  return (
    <div className="min-w-36 rounded-xl border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1.5 text-muted-foreground">{title}</p>
      <div className="grid gap-1">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-2">
            <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: r.color }} aria-hidden="true" />
            <span className="num font-semibold text-foreground">{format(Number(datum[r.key] ?? 0))}</span>
            <span className="text-muted-foreground">{r.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------ daily meals ---
export type DailyMeals = { date: string; breakfast: number; lunch: number; dinner: number; total: number };

export function DailyMealsChart({ data, title, description }: { data: DailyMeals[]; title: ReactNode; description?: ReactNode }) {
  const t = useTranslations("slots");
  const tc = useTranslations("charts");
  const animate = useAnimate();
  const locale = useLocale();
  const series: Row[] = [
    { key: "breakfast", label: t("breakfast"), color: "var(--chart-1)" },
    { key: "lunch", label: t("lunch"), color: "var(--chart-2)" },
    { key: "dinner", label: t("dinner"), color: "var(--chart-3)" },
  ];
  const config = Object.fromEntries(series.map((s) => [s.key, { label: s.label, color: s.color }])) satisfies ChartConfig;
  const num = (v: number) => formatNumber(v, locale);

  return (
    <ChartCard
      title={title}
      description={description}
      legend={series.map((s) => <LegendKey key={s.key} color={s.color} label={s.label} />)}
      table={
        <VizTable
          columns={[{ key: "date", label: tc("date") }, ...series.map((s) => ({ key: s.key, label: s.label, numeric: true })), { key: "total", label: tc("total"), numeric: true }]}
          rows={data.map((d) => ({
            date: formatDate(d.date, locale, { day: "numeric", month: "short" }),
            breakfast: num(d.breakfast),
            lunch: num(d.lunch),
            dinner: num(d.dinner),
            total: num(d.total),
          }))}
        />
      }
    >
      <ChartContainer config={config} className="aspect-auto h-60 w-full">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }} barCategoryGap="18%">
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={AXIS}
            tickMargin={6}
            minTickGap={10}
            tickFormatter={(d: string) => formatDate(d, locale, { day: "numeric" })}
          />
          <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={false} tickFormatter={(v: number) => formatCompact(v, locale)} />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.6 }}
            content={(p) => (
              <Readout
                {...p}
                title={p.label ? formatDate(String(p.label), locale, { weekday: "short", day: "numeric", month: "short" }) : ""}
                rows={[...series].reverse()}
                format={num}
              />
            )}
          />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              stackId="meals"
              fill={s.color}
              maxBarSize={24}
              isAnimationActive={animate}
              radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
              {...GAP}
            />
          ))}
        </BarChart>
      </ChartContainer>
    </ChartCard>
  );
}

// ------------------------------------------------- money in vs money out ---
export type MoneyMonth = { month: string; collected: number; spent: number };

export function MoneyTrendChart({ data, title, description }: { data: MoneyMonth[]; title: ReactNode; description?: ReactNode }) {
  const t = useTranslations("charts");
  const animate = useAnimate();
  const locale = useLocale();
  const series: Row[] = [
    { key: "collected", label: t("collected"), color: "var(--chart-1)" },
    { key: "spent", label: t("spent"), color: "var(--chart-2)" },
  ];
  const config = Object.fromEntries(series.map((s) => [s.key, { label: s.label, color: s.color }])) satisfies ChartConfig;
  const taka = (v: number) => formatTaka(v, locale);
  const monthLabel = (m: string) => formatDate(m, locale, { month: "short" });

  return (
    <ChartCard
      title={title}
      description={description}
      legend={series.map((s) => <LegendKey key={s.key} color={s.color} label={s.label} />)}
      table={
        <VizTable
          columns={[{ key: "month", label: t("month") }, ...series.map((s) => ({ key: s.key, label: s.label, numeric: true }))]}
          rows={data.map((d) => ({
            month: formatDate(d.month, locale, { month: "long", year: "numeric" }),
            collected: taka(d.collected),
            spent: taka(d.spent),
          }))}
        />
      }
    >
      <ChartContainer config={config} className="aspect-auto h-56 w-full">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -4, bottom: 0 }} barGap={2} barCategoryGap="24%">
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="month" tickLine={false} axisLine={AXIS} tickMargin={6} tickFormatter={monthLabel} />
          <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => `৳${formatCompact(v, locale)}`} />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.6 }}
            content={(p) => (
              <Readout
                {...p}
                title={p.label ? formatDate(String(p.label), locale, { month: "long", year: "numeric" }) : ""}
                rows={series}
                format={taka}
              />
            )}
          />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} fill={s.color} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={animate} />
          ))}
        </BarChart>
      </ChartContainer>
    </ChartCard>
  );
}

// ------------------------------------------- one series, ranked categories ---
export type RankedRow = { key: string; label: string; value: number };

/** Horizontal bars in one colour (magnitude by category), value at the tip. */
export function RankedBarChart({
  data,
  title,
  description,
  money = false,
  columnLabel,
}: {
  data: RankedRow[];
  title: ReactNode;
  description?: ReactNode;
  money?: boolean;
  columnLabel: ReactNode;
}) {
  const t = useTranslations("charts");
  const animate = useAnimate();
  const locale = useLocale();
  const fmt = (v: number) => (money ? formatTaka(v, locale) : formatNumber(v, locale));
  const config = { value: { label: columnLabel, color: "var(--chart-1)" } } satisfies ChartConfig;

  return (
    <ChartCard
      title={title}
      description={description}
      table={
        <VizTable
          columns={[{ key: "label", label: t("item") }, { key: "value", label: columnLabel, numeric: true }]}
          rows={data.map((d) => ({ label: d.label, value: fmt(d.value) }))}
        />
      }
    >
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height: Math.max(data.length * 38 + 12, 96) }}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 64, left: 0, bottom: 0 }} barCategoryGap="28%">
          <XAxis type="number" hide domain={[0, "dataMax"]} />
          <YAxis type="category" dataKey="label" tickLine={false} axisLine={AXIS} width={96} tickMargin={6} />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.6 }}
            content={(p) => (
              <Readout {...p} title={String(p.label ?? "")} rows={[{ key: "value", label: columnLabel, color: "var(--chart-1)" }]} format={fmt} />
            )}
          />
          <Bar dataKey="value" fill="var(--chart-1)" maxBarSize={24} radius={[0, 4, 4, 0]} isAnimationActive={animate}>
            <LabelList dataKey="value" position="right" offset={8} className="fill-foreground text-xs" formatter={(v) => fmt(Number(v))} />
          </Bar>
        </BarChart>
      </ChartContainer>
    </ChartCard>
  );
}

// ------------------------------------------------------ member balances ---
export type BalanceRow = { id: string; name: string; balance: number };

/** Diverging bars around ৳0: advance one way, due the other. */
export function BalanceChart({ data, title, description }: { data: BalanceRow[]; title: ReactNode; description?: ReactNode }) {
  const t = useTranslations("charts");
  const animate = useAnimate();
  const locale = useLocale();
  const taka = (v: number) => formatTaka(v, locale);
  const extent = Math.max(1, ...data.map((d) => Math.abs(d.balance)));
  const config = {
    balance: { label: t("balance"), color: "var(--chart-1)" },
  } satisfies ChartConfig;

  return (
    <ChartCard
      title={title}
      description={description}
      legend={
        <>
          <LegendKey color="var(--chart-1)" label={t("advance")} />
          <LegendKey color="var(--chart-4)" label={t("due")} />
        </>
      }
      table={
        <VizTable
          columns={[{ key: "name", label: t("member") }, { key: "balance", label: t("balance"), numeric: true }]}
          rows={data.map((d) => ({ name: d.name, balance: taka(d.balance) }))}
        />
      }
    >
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height: Math.max(data.length * 32 + 28, 120) }}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }} barCategoryGap="24%">
          <CartesianGrid horizontal={false} stroke={GRID} />
          <XAxis
            type="number"
            domain={[-extent, extent]}
            tickLine={false}
            axisLine={false}
            tickCount={5}
            tickFormatter={(v: number) => `${v < 0 ? "−" : ""}৳${formatCompact(Math.abs(v), locale)}`}
          />
          <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={96} tickMargin={6} />
          <ReferenceLine x={0} stroke="var(--chart-axis)" />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.6 }}
            content={(p) => {
              const balance = Number((p.payload?.[0]?.payload as BalanceRow | undefined)?.balance ?? 0);
              return (
                <Readout
                  {...p}
                  title={String(p.label ?? "")}
                  rows={[{ key: "balance", label: balance < 0 ? t("due") : t("advance"), color: balance < 0 ? "var(--chart-4)" : "var(--chart-1)" }]}
                  format={taka}
                />
              );
            }}
          />
          <Bar
            dataKey="balance"
            maxBarSize={20}
            isAnimationActive={animate}
            shape={(props: Parameters<typeof Rectangle>[0] & { payload?: BalanceRow }) => (
              <Rectangle {...props} radius={(props.payload?.balance ?? 0) < 0 ? [4, 0, 0, 4] : [0, 4, 4, 0]} />
            )}
          >
            {data.map((d) => (
              <Cell key={d.id} fill={d.balance < 0 ? "var(--chart-4)" : "var(--chart-1)"} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </ChartCard>
  );
}

// ------------------------------------------------------------ daily count ---
export type DailyCount = { date: string; count: number };

/** One series over time: 2px line, 10% wash, crosshair readout. */
export function DailyAreaChart({
  data,
  title,
  description,
  seriesLabel,
}: {
  data: DailyCount[];
  title: ReactNode;
  description?: ReactNode;
  seriesLabel: string;
}) {
  const t = useTranslations("charts");
  const animate = useAnimate();
  const locale = useLocale();
  const num = (v: number) => formatNumber(v, locale);
  const config = { count: { label: seriesLabel, color: "var(--chart-1)" } } satisfies ChartConfig;

  return (
    <ChartCard
      title={title}
      description={description}
      table={
        <VizTable
          columns={[{ key: "date", label: t("date") }, { key: "count", label: seriesLabel, numeric: true }]}
          rows={data.map((d) => ({ date: formatDate(d.date, locale, { day: "numeric", month: "short" }), count: num(d.count) }))}
        />
      }
    >
      <ChartContainer config={config} className="aspect-auto h-56 w-full">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={AXIS}
            tickMargin={6}
            minTickGap={16}
            tickFormatter={(d: string) => formatDate(d, locale, { day: "numeric", month: "short" })}
          />
          <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={false} tickFormatter={(v: number) => formatCompact(v, locale)} />
          <Tooltip
            cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }}
            content={(p) => (
              <Readout
                {...p}
                title={p.label ? formatDate(String(p.label), locale, { weekday: "short", day: "numeric", month: "short" }) : ""}
                rows={[{ key: "count", label: seriesLabel, color: "var(--chart-1)" }]}
                format={num}
              />
            )}
          />
          <Area
            dataKey="count"
            type="monotone"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="var(--chart-1)"
            fillOpacity={0.1}
            isAnimationActive={animate}
            activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
          />
        </AreaChart>
      </ChartContainer>
    </ChartCard>
  );
}

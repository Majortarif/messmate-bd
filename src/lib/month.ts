import { dhakaToday } from "@/lib/format";

// Dates travel as plain 'YYYY-MM-DD' strings (Dhaka calendar), months as their first day.

const pad = (n: number) => String(n).padStart(2, "0");
const toIso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const fromIso = (iso: string) => new Date(`${iso}T00:00:00Z`);

export function currentMonth() {
  return `${dhakaToday().slice(0, 7)}-01`;
}

/** Accepts ?month=YYYY-MM (or YYYY-MM-DD); anything else falls back to the current month. */
export function parseMonth(param: string | string[] | undefined | null) {
  const value = Array.isArray(param) ? param[0] : param;
  if (value && /^\d{4}-(0[1-9]|1[0-2])(-\d{2})?$/.test(value)) return `${value.slice(0, 7)}-01`;
  return currentMonth();
}

export function shiftMonth(month: string, delta: number) {
  const d = fromIso(month);
  d.setUTCMonth(d.getUTCMonth() + delta, 1);
  return toIso(d);
}

/** 'YYYY-MM' for URLs. */
export const monthParam = (month: string) => month.slice(0, 7);

export function addDays(date: string, days: number) {
  const d = fromIso(date);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}

/** Saturday that starts the week containing `date` (the Bangladeshi work week). */
export function weekStart(date: string) {
  const d = fromIso(date);
  const back = (d.getUTCDay() + 1) % 7; // Sat → 0, Sun → 1, … Fri → 6
  return addDays(date, -back);
}

export function parseDate(param: string | string[] | undefined | null) {
  const value = Array.isArray(param) ? param[0] : param;
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(fromIso(value).getTime()) ? value : dhakaToday();
}

export const dayRange = (start: string, days: number) => Array.from({ length: days }, (_, i) => addDays(start, i));

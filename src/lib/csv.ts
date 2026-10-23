/** RFC 4180 CSV with a UTF-8 BOM so Excel shows Bangla correctly. */
export function toCsv(rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

export function csvResponse(body: string, filename: string) {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/** Datasets a manager can download from /api/export/mess. */
export const MESS_EXPORTS = ["members", "ledger", "deposits", "expenses", "bills", "meals"] as const;
export type MessExport = (typeof MESS_EXPORTS)[number];

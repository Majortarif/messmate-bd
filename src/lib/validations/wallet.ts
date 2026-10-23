import { z } from "zod";
import { bdPhoneField } from "@/lib/validations/auth";

export const PAYMENT_METHODS = ["bkash", "nagad", "rocket", "cash"] as const;

export const depositSchema = z
  .object({
    method: z.enum(PAYMENT_METHODS),
    amount: z.coerce.number<string | number>({ error: "amountRange" }).min(10, { error: "amountRange" }).max(100000, { error: "amountRange" }),
    trxId: z
      .string()
      .transform((v) => v.toUpperCase().replace(/\s/g, ""))
      .optional(),
    senderNumber: bdPhoneField.optional(),
    paidAt: z.string().optional(),
    note: z.string().trim().max(300, { error: "tooLong" }).optional(),
    proofPath: z.string().max(300).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.method === "cash") return;
    if (!v.trxId) ctx.addIssue({ code: "custom", path: ["trxId"], message: "trxRequired" });
    else if (!/^[A-Z0-9]{6,20}$/.test(v.trxId)) ctx.addIssue({ code: "custom", path: ["trxId"], message: "trxFormat" });
  });

export type DepositInput = z.input<typeof depositSchema>;

export const managerEntrySchema = z
  .object({
    userId: z.uuid({ error: "required" }),
    type: z.enum(["deposit", "adjustment", "refund_payout"]),
    direction: z.enum(["credit", "debit"]).default("credit"),
    amount: z.coerce.number<string | number>({ error: "amountRange" }).positive({ error: "amountRange" }).max(1000000, { error: "amountRange" }),
    note: z.string().trim().max(200, { error: "tooLong" }).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.type === "adjustment" && (!v.note || v.note.length < 3)) {
      ctx.addIssue({ code: "custom", path: ["note"], message: "reasonRequired" });
    }
  });

export type ManagerEntryInput = z.input<typeof managerEntrySchema>;

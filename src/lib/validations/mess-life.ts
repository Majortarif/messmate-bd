import { z } from "zod";

// Notices, complaints, polls and the duty roster. Messages are `validation.*` keys.

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: "tooLong" })
    .transform((v) => v || null)
    .nullable()
    .optional();

export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export const noticeSchema = z.object({
  title: z.string().trim().min(3, { error: "titleLength" }).max(120, { error: "tooLong" }),
  body: z.string().trim().min(1, { error: "required" }).max(3000, { error: "tooLong" }),
  priority: z.enum(PRIORITIES),
  isPinned: z.boolean(),
  expiresOn: z
    .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "required" })])
    .transform((v) => v || null)
    .nullable()
    .optional(),
});
export type NoticeInput = z.input<typeof noticeSchema>;

export const COMPLAINT_CATEGORIES = ["bua", "landlord", "load_shedding", "water", "gas", "wifi", "noise", "cleanliness", "security", "other"] as const;
export const COMPLAINT_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;

export const complaintSchema = z.object({
  category: z.enum(COMPLAINT_CATEGORIES),
  title: z.string().trim().min(3, { error: "titleLength" }).max(120, { error: "tooLong" }),
  description: optionalText(2000),
  priority: z.enum(PRIORITIES),
  photoPath: z.string().max(300).nullable().optional(),
});
export type ComplaintInput = z.input<typeof complaintSchema>;

export const replySchema = z.object({
  complaintId: z.uuid(),
  message: z.string().trim().min(1, { error: "required" }).max(1000, { error: "tooLong" }),
  statusChange: z.enum(COMPLAINT_STATUSES).nullable().optional(),
});
export type ReplyInput = z.input<typeof replySchema>;

export const pollSchema = z
  .object({
    question: z.string().trim().min(3, { error: "titleLength" }).max(200, { error: "tooLong" }),
    description: optionalText(1000),
    options: z.array(z.object({ label: z.string().trim().max(100, { error: "tooLong" }) })).max(10, { error: "tooMany" }),
    allowMultiple: z.boolean(),
    isAnonymous: z.boolean(),
    closesAt: z
      .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, { error: "required" })])
      .transform((v) => v || null)
      .nullable()
      .optional(),
  })
  .refine((v) => new Set(v.options.map((o) => o.label).filter(Boolean)).size >= 2, { path: ["options"], error: "pollOptions" });
export type PollInput = z.input<typeof pollSchema>;

export const CHORE_TYPES = ["bazar", "cleaning", "cooking_help", "garbage", "water_filter", "other"] as const;

export const rosterSchema = z.object({
  choreType: z.enum(CHORE_TYPES),
  title: z.string().trim().min(2, { error: "nameLength" }).max(100, { error: "tooLong" }),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "required" }),
  days: z.coerce.number<string | number>({ error: "amountRange" }).int().min(1, { error: "amountRange" }).max(62, { error: "amountRange" }),
  everyDays: z.coerce.number<string | number>({ error: "amountRange" }).int().min(1, { error: "amountRange" }).max(31, { error: "amountRange" }),
  userIds: z.array(z.uuid()).min(1, { error: "pickMembers" }).max(30),
});
export type RosterInput = z.input<typeof rosterSchema>;

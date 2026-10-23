import { z } from "zod";

export const SLOTS = ["breakfast", "lunch", "dinner"] as const;

export const menuDraftSchema = z.object({
  id: z.uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: z.enum(SLOTS),
  items: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v.length >= 2 ? v : undefined))
    .optional(),
  price: z.number().min(0).max(2000).optional(),
  locked: z.boolean().default(false),
});

export type MenuDraft = z.input<typeof menuDraftSchema>;

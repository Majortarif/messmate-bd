import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: "tooLong" })
    .transform((v) => (v === "" ? undefined : v))
    .optional();

export const createMessSchema = z.object({
  name: z.string().trim().min(3, { error: "messNameLength" }).max(80, { error: "tooLong" }),
  areaId: z.coerce
    .number<string | number>({ error: "areaRequired" })
    .int({ error: "areaRequired" })
    .positive({ error: "areaRequired" }),
  address: optionalText(200),
  buildingName: optionalText(80),
  description: optionalText(500),
  mealRateMode: z.enum(["auto", "fixed"]),
  genderPolicy: z.enum(["any", "male", "female"]),
});

/** Accepts "neer-2026", " neer 2026 " etc. and normalises to NEER2026. */
export const inviteCodeField = z
  .string()
  .transform((v) => v.toUpperCase().replace(/[^A-Z0-9]/g, ""))
  .refine((v) => /^[A-Z0-9]{8}$/.test(v), { error: "inviteCode" });

export const joinMessSchema = z.object({
  code: inviteCodeField,
  note: optionalText(300),
});

export const decideJoinSchema = z.object({
  membershipId: z.uuid(),
  approve: z.boolean(),
  note: optionalText(300),
});

export type CreateMessInput = z.input<typeof createMessSchema>;
export type JoinMessInput = z.input<typeof joinMessSchema>;

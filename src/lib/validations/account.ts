import { z } from "zod";
import { bdPhoneField, emailField } from "@/lib/validations/auth";

// Account settings and feedback. Messages are `validation.*` keys.

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: "tooLong" })
    .transform((v) => v || null)
    .nullable()
    .optional();
const optionalPhone = bdPhoneField.transform((v) => v || null);

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export const GENDER_OPTIONS = ["male", "female", "other"] as const;
export const OCCUPATION_OPTIONS = ["student", "job_holder", "business", "other"] as const;

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, { error: "nameLength" }).max(80, { error: "tooLong" }),
  phone: optionalPhone,
  gender: z.enum(GENDER_OPTIONS).nullable(),
  occupation: z.enum(OCCUPATION_OPTIONS).nullable(),
  institution: optionalText(120),
  homeDistrict: optionalText(60),
  bloodGroup: z.enum(BLOOD_GROUPS).nullable(),
  bio: optionalText(300),
  guardianName: optionalText(80),
  guardianPhone: optionalPhone,
  preferredLocale: z.enum(["bn", "en"]),
});
export type ProfileInput = z.input<typeof profileSchema>;

export const FEEDBACK_TYPES = ["feedback", "bug", "contact", "report"] as const;
export const feedbackSchema = z.object({
  type: z.enum(FEEDBACK_TYPES),
  subject: optionalText(120),
  message: z.string().trim().min(5, { error: "messageLength" }).max(2000, { error: "tooLong" }),
  contactEmail: z.union([z.literal(""), emailField]).optional(),
  pageUrl: z.string().max(300).optional(),
});
export type FeedbackInput = z.input<typeof feedbackSchema>;

/** Typed confirmation for deleting an account. */
export const DELETE_WORD = "DELETE";

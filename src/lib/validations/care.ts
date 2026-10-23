import { z } from "zod";
import { bdPhoneField } from "@/lib/validations/auth";

// Care: sick mode / SOS, check-ins, mood, contacts, reminders, money,
// recipes, events and the tuition board. Messages are `validation.*` keys.

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: "tooLong" })
    .transform((v) => v || null)
    .nullable()
    .optional();
const amount = (max = 10000000) =>
  z.coerce.number<string | number>({ error: "amountRange" }).positive({ error: "amountRange" }).max(max, { error: "amountRange" });
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "required" });
const optionalDate = z
  .union([z.literal(""), date])
  .transform((v) => v || null)
  .nullable()
  .optional();
const optionalPhone = bdPhoneField.transform((v) => v || null);
const requiredPhone = bdPhoneField.refine((v) => v !== "", { error: "phone" });
const optionalInt = (min: number, max: number) =>
  z
    .union([z.literal(""), z.coerce.number<string | number>({ error: "amountRange" }).int().min(min, { error: "amountRange" }).max(max, { error: "amountRange" })])
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

// ------------------------------------------------------------ alerts / safety --
export const CARE_NEEDS = ["light_food", "medicine", "doctor", "company", "ride", "call_me"] as const;
export const alertSchema = z.object({
  type: z.enum(["sick", "sos"]),
  message: optionalText(500),
  needs: z.array(z.enum(CARE_NEEDS)).max(CARE_NEEDS.length),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  locationText: optionalText(200),
  notifyMess: z.boolean(),
});
export type AlertInput = z.input<typeof alertSchema>;

export const checkinSchema = z.object({
  label: z.string().trim().min(2, { error: "nameLength" }).max(100, { error: "tooLong" }),
  minutes: z.coerce.number<string | number>().int().min(10).max(1440),
});
export type CheckinInput = z.input<typeof checkinSchema>;

export const MOODS = ["great", "good", "okay", "tired", "sad", "stressed"] as const;

export const contactSchema = z.object({
  name: z.string().trim().min(1, { error: "required" }).max(80, { error: "tooLong" }),
  relation: optionalText(40),
  phone: requiredPhone,
  contactUserId: z.uuid().nullable(),
  isPrimary: z.boolean(),
  notifyOnSos: z.boolean(),
  notifyOnSick: z.boolean(),
  notifyOnCheckin: z.boolean(),
});
export type ContactInput = z.input<typeof contactSchema>;

// ---------------------------------------------------------------- reminders --
export const REMINDER_TYPES = ["medicine", "water", "sleep", "call_home", "rent", "bill", "custom"] as const;
export const reminderSchema = z.object({
  type: z.enum(REMINDER_TYPES),
  title: z.string().trim().min(1, { error: "required" }).max(80, { error: "tooLong" }),
  note: optionalText(200),
  remindAt: z.string().regex(/^\d{2}:\d{2}$/, { error: "required" }),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1, { error: "pickDays" }).max(7),
  isActive: z.boolean(),
});
export type ReminderInput = z.input<typeof reminderSchema>;

// -------------------------------------------------------------------- money --
export const BUDGET_CATEGORIES = [
  "food",
  "rent",
  "transport",
  "mobile_internet",
  "education",
  "health",
  "family",
  "shopping",
  "entertainment",
  "savings",
  "salary",
  "tuition_income",
  "other",
] as const;
export const INCOME_CATEGORIES = ["salary", "tuition_income", "family", "other"] as const;
export const EXPENSE_CATEGORIES = ["food", "rent", "transport", "mobile_internet", "education", "health", "family", "shopping", "entertainment", "savings", "other"] as const;

export const budgetEntrySchema = z.object({
  entryType: z.enum(["income", "expense"]),
  category: z.enum(BUDGET_CATEGORIES),
  amount: amount(),
  entryDate: date,
  note: optionalText(200),
});
export type BudgetEntryInput = z.input<typeof budgetEntrySchema>;

export const monthlyBudgetSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  limitAmount: amount(),
  expectedIncome: z
    .union([z.literal(""), z.coerce.number<string | number>({ error: "amountRange" }).min(0, { error: "amountRange" }).max(10000000, { error: "amountRange" })])
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
});
export type MonthlyBudgetInput = z.input<typeof monthlyBudgetSchema>;

export const loanSchema = z.object({
  direction: z.enum(["lent", "borrowed"]),
  counterpartyName: z.string().trim().min(1, { error: "required" }).max(80, { error: "tooLong" }),
  counterpartyPhone: optionalPhone,
  amount: amount(),
  dueDate: optionalDate,
  note: optionalText(300),
});
export type LoanInput = z.input<typeof loanSchema>;

export const loanPaymentSchema = z.object({
  loanId: z.uuid(),
  amount: amount(),
  paidOn: date,
  note: optionalText(200),
});
export type LoanPaymentInput = z.input<typeof loanPaymentSchema>;

// ---------------------------------------------------- recipes, events, jobs --
export const EQUIPMENT = ["rice_cooker", "stove", "kettle", "no_cook"] as const;
export const recipeSchema = z.object({
  titleBn: z.string().trim().min(2, { error: "nameLength" }).max(100, { error: "tooLong" }),
  titleEn: optionalText(100),
  description: optionalText(500),
  ingredients: z.string().trim().min(3, { error: "required" }).max(2000, { error: "tooLong" }),
  steps: z.string().trim().min(3, { error: "required" }).max(4000, { error: "tooLong" }),
  equipment: z.enum(EQUIPMENT),
  cookMinutes: optionalInt(1, 300),
  servings: z.coerce.number<string | number>({ error: "amountRange" }).int().min(1, { error: "amountRange" }).max(20, { error: "amountRange" }),
  costEstimate: optionalInt(0, 100000),
  isSickFriendly: z.boolean(),
});
export type RecipeInput = z.input<typeof recipeSchema>;

export const EVENT_TYPES = ["iftar", "eid", "puja", "meetup", "sports", "study", "other"] as const;
const datetime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, { error: "required" });
export const eventSchema = z
  .object({
    eventType: z.enum(EVENT_TYPES),
    title: z.string().trim().min(3, { error: "titleLength" }).max(120, { error: "tooLong" }),
    description: optionalText(2000),
    areaId: z
      .union([z.literal(""), z.coerce.number<string | number>().int().positive()])
      .transform((v) => (v === "" ? null : v))
      .nullable()
      .optional(),
    venue: optionalText(200),
    startsAt: datetime,
    endsAt: z
      .union([z.literal(""), datetime])
      .transform((v) => v || null)
      .nullable()
      .optional(),
    maxPeople: optionalInt(2, 1000),
    contactPhone: optionalPhone,
  })
  .refine((v) => !v.endsAt || v.endsAt > v.startsAt, { path: ["endsAt"], error: "dateOrder" });
export type EventInput = z.input<typeof eventSchema>;

export const JOB_TYPES = ["tuition", "part_time", "freelance", "internship"] as const;
export const jobSchema = z.object({
  jobType: z.enum(JOB_TYPES),
  title: z.string().trim().min(3, { error: "titleLength" }).max(120, { error: "tooLong" }),
  description: z.string().trim().min(10, { error: "descriptionLength" }).max(2000, { error: "tooLong" }),
  areaId: z
    .union([z.literal(""), z.coerce.number<string | number>().int().positive()])
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  salaryText: optionalText(80),
  scheduleText: optionalText(120),
  contactPhone: requiredPhone,
  expiresAt: optionalDate,
});
export type JobInput = z.input<typeof jobSchema>;

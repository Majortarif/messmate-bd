import { z } from "zod";
import { bdPhoneField } from "@/lib/validations/auth";

// Housing, roommates, rent tracker, move checklists, marketplace and services.
// Error messages are keys under `validation.*` in the message files.

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: "tooLong" })
    .transform((v) => v || null)
    .nullable()
    .optional();
const money = (max: number) =>
  z.coerce.number<string | number>({ error: "amountRange" }).min(0, { error: "amountRange" }).max(max, { error: "amountRange" });
const optionalMoney = (max: number) =>
  z
    .union([z.literal(""), z.coerce.number<string | number>({ error: "amountRange" }).min(0, { error: "amountRange" }).max(max, { error: "amountRange" })])
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();
const optionalDate = z
  .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "required" })])
  .transform((v) => v || null)
  .nullable()
  .optional();
const requiredPhone = bdPhoneField.refine((v) => v !== "", { error: "phone" });
const optionalPhone = bdPhoneField.transform((v) => v || null);
const areaId = z.coerce.number<string | number>({ error: "areaRequired" }).int().positive({ error: "areaRequired" });

// ------------------------------------------------------------------ listings --
export const LISTING_TYPES = ["seat", "room", "flat", "sublet"] as const;
export const GENDER_PREFS = ["any", "male", "female"] as const;
export const TENANT_PREFS = ["any", "student", "job_holder"] as const;
export const FACILITIES = [
  "wifi",
  "gas",
  "lift",
  "generator",
  "ips",
  "attached_bath",
  "balcony",
  "parking",
  "security",
  "cctv",
  "water_filter",
  "furnished",
  "kitchen",
  "meal_system",
  "laundry",
] as const;
export type Facility = (typeof FACILITIES)[number];

export const listingSchema = z
  .object({
    listingType: z.enum(LISTING_TYPES),
    title: z.string().trim().min(5, { error: "titleLength" }).max(120, { error: "tooLong" }),
    description: optionalText(2000),
    areaId,
    addressLine: optionalText(200),
    lat: z.number().min(20).max(27).nullable(),
    lng: z.number().min(88).max(93).nullable(),
    rent: money(1000000),
    advanceDeposit: money(10000000),
    availableFrom: optionalDate,
    genderPref: z.enum(GENDER_PREFS),
    tenantPref: z.enum(TENANT_PREFS),
    seatsAvailable: z.coerce.number<string | number>({ error: "amountRange" }).int().min(0, { error: "amountRange" }).max(50, { error: "amountRange" }),
    facilities: z.array(z.enum(FACILITIES)).max(FACILITIES.length),
    contactName: optionalText(80),
    contactPhone: requiredPhone,
  })
  .refine((v) => (v.lat === null) === (v.lng === null), { path: ["lat"], error: "required" });
export type ListingInput = z.input<typeof listingSchema>;
export type ListingValues = z.output<typeof listingSchema>;

// ---------------------------------------------------------------- roommates --
export const SLEEP_SCHEDULES = ["early", "late", "flexible"] as const;
export const FOOD_PREFS = ["any", "halal_only", "vegetarian"] as const;
export const GENDERS = ["male", "female", "other"] as const;
export const OCCUPATIONS = ["student", "job_holder", "business", "other"] as const;

export const roommateSchema = z
  .object({
    isActive: z.boolean(),
    gender: z.enum(GENDERS, { error: "required" }),
    occupation: z.enum(OCCUPATIONS, { error: "required" }),
    budgetMin: money(200000),
    budgetMax: money(200000),
    smoking: z.boolean(),
    sleepSchedule: z.enum(SLEEP_SCHEDULES),
    cleanliness: z.coerce.number<string | number>().int().min(1).max(5),
    foodPref: z.enum(FOOD_PREFS),
    guestsOk: z.boolean(),
    moveInDate: optionalDate,
    about: optionalText(500),
    contactPhone: optionalPhone,
    showPhone: z.boolean(),
    areaIds: z.array(z.number().int().positive()).max(10, { error: "tooMany" }),
  })
  .refine((v) => v.budgetMax >= v.budgetMin, { path: ["budgetMax"], error: "budgetRange" })
  .refine((v) => !v.showPhone || v.contactPhone, { path: ["contactPhone"], error: "phone" });
export type RoommateInput = z.input<typeof roommateSchema>;

// ------------------------------------------------------------- rent tracker --
export const rentRecordSchema = z
  .object({
    title: z.string().trim().min(2, { error: "nameLength" }).max(80, { error: "tooLong" }),
    landlordName: optionalText(80),
    landlordPhone: optionalPhone,
    propertyAddress: optionalText(200),
    monthlyRent: money(1000000),
    advancePaid: money(10000000),
    securityDeposit: money(10000000),
    rentDueDay: z.coerce.number<string | number>({ error: "amountRange" }).int().min(1, { error: "amountRange" }).max(28, { error: "amountRange" }),
    agreementStart: optionalDate,
    agreementEnd: optionalDate,
    noticePeriodDays: optionalMoney(365),
    agreementNotes: optionalText(3000),
    isActive: z.boolean(),
  })
  .refine((v) => !v.agreementStart || !v.agreementEnd || v.agreementEnd >= v.agreementStart, {
    path: ["agreementEnd"],
    error: "dateOrder",
  });
export type RentRecordInput = z.input<typeof rentRecordSchema>;

export const PAYMENT_METHODS = ["cash", "bkash", "nagad", "rocket", "bank"] as const;
export const rentPaymentSchema = z.object({
  recordId: z.uuid(),
  month: z.string().regex(/^\d{4}-\d{2}$/, { error: "required" }),
  amount: z.coerce.number<string | number>({ error: "amountRange" }).positive({ error: "amountRange" }).max(1000000, { error: "amountRange" }),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "required" }),
  method: z.enum(PAYMENT_METHODS),
  note: optionalText(200),
});
export type RentPaymentInput = z.input<typeof rentPaymentSchema>;

// ----------------------------------------------------------- move checklists --
export const moveChecklistSchema = z.object({
  kind: z.enum(["move_in", "move_out"]),
  title: z.string().trim().min(2, { error: "nameLength" }).max(100, { error: "tooLong" }),
  address: optionalText(200),
  date: optionalDate,
});
export type MoveChecklistInput = z.input<typeof moveChecklistSchema>;

const meter = z
  .union([z.literal(""), z.coerce.number<string | number>({ error: "amountRange" }).min(0, { error: "amountRange" }).max(9999999999, { error: "amountRange" })])
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();
export const handoverSchema = z.object({
  handoverTo: optionalText(80),
  handoverPhone: optionalPhone,
  electricityMeter: meter,
  gasMeter: meter,
  waterMeter: meter,
  keysCount: optionalMoney(50),
  depositAmount: optionalMoney(10000000),
  depositReturned: optionalMoney(10000000),
  handoverNotes: optionalText(2000),
});
export type HandoverInput = z.input<typeof handoverSchema>;

// -------------------------------------------------------------- marketplace --
export const MARKET_CATEGORIES = ["furniture", "bed", "fan", "electronics", "books", "kitchen", "clothing", "other"] as const;
export const ITEM_CONDITIONS = ["new", "like_new", "good", "fair"] as const;
export const MARKET_STATUSES = ["available", "reserved", "sold"] as const;

export const marketItemSchema = z.object({
  title: z.string().trim().min(3, { error: "titleLength" }).max(100, { error: "tooLong" }),
  description: optionalText(1500),
  category: z.enum(MARKET_CATEGORIES),
  condition: z.enum(ITEM_CONDITIONS),
  price: money(1000000),
  isNegotiable: z.boolean(),
  areaId: z.union([z.literal(""), areaId]).transform((v) => (v === "" ? null : v)).nullable().optional(),
  contactPhone: requiredPhone,
});
export type MarketItemInput = z.input<typeof marketItemSchema>;

// ----------------------------------------------------------------- services --
export const SERVICE_CATEGORIES = [
  "bua_cook",
  "tiffin",
  "electrician",
  "plumber",
  "gas_cylinder",
  "internet",
  "laundry",
  "tutor",
  "moving_van",
  "doctor",
  "other",
] as const;

export const serviceSchema = z.object({
  name: z.string().trim().min(2, { error: "nameLength" }).max(100, { error: "tooLong" }),
  category: z.enum(SERVICE_CATEGORIES),
  areaId: z.union([z.literal(""), areaId]).transform((v) => (v === "" ? null : v)).nullable().optional(),
  phone: requiredPhone,
  altPhone: optionalPhone,
  description: optionalText(1000),
  priceNote: optionalText(120),
});
export type ServiceInput = z.input<typeof serviceSchema>;

export const reviewSchema = z.object({
  providerId: z.uuid(),
  rating: z.number().int().min(1, { error: "ratingRequired" }).max(5),
  comment: optionalText(500),
});
export type ReviewInput = z.input<typeof reviewSchema>;

// ------------------------------------------------------------------- report --
export const REPORT_KINDS = ["listing", "market", "service", "event", "job"] as const;
export const reportSchema = z.object({
  kind: z.enum(REPORT_KINDS),
  id: z.uuid(),
  title: z.string().trim().max(120),
  reason: z.string().trim().min(5, { error: "reasonRequired" }).max(1000, { error: "tooLong" }),
});
export type ReportInput = z.input<typeof reportSchema>;

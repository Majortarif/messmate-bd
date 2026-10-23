import { z } from "zod";
import { bdPhoneField } from "@/lib/validations/auth";

const money = (max: number) =>
  z.coerce.number<string | number>({ error: "amountRange" }).min(0, { error: "amountRange" }).max(max, { error: "amountRange" });
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: "tooLong" })
    .transform((v) => v || null)
    .nullable()
    .optional();
const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, { error: "required" });
const weight = z.coerce.number<string | number>({ error: "amountRange" }).min(0, { error: "amountRange" }).max(2, { error: "amountRange" });

export const EXPENSE_CATEGORIES = ["bazar", "cooking_gas", "utensils", "cleaning", "repair", "other"] as const;
export const BILL_TYPES = ["rent", "electricity", "gas", "water", "wifi", "bua", "service_charge", "other"] as const;
export const ROOM_TYPES = ["single", "double", "shared", "seat"] as const;

export const expenseSchema = z
  .object({
    category: z.enum(EXPENSE_CATEGORIES),
    amount: z.coerce.number<string | number>({ error: "amountRange" }).positive({ error: "amountRange" }).max(1000000, { error: "amountRange" }),
    expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "required" }),
    description: optionalText(300),
    paidFrom: z.enum(["mess_fund", "member"]),
    paidBy: z.string().optional(),
    receiptPath: z.string().max(300).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.paidFrom === "member" && !z.uuid().safeParse(v.paidBy).success) {
      ctx.addIssue({ code: "custom", path: ["paidBy"], message: "required" });
    }
  });
export type ExpenseInput = z.input<typeof expenseSchema>;

export const billSchema = z
  .object({
    billType: z.enum(BILL_TYPES),
    splitMode: z.enum(["equal", "by_room", "custom"]),
    totalAmount: money(10000000).optional(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
    description: optionalText(300),
  })
  .superRefine((v, ctx) => {
    if (v.splitMode !== "by_room" && !(Number(v.totalAmount) > 0)) {
      ctx.addIssue({ code: "custom", path: ["totalAmount"], message: "amountRange" });
    }
  });
export type BillInput = z.input<typeof billSchema>;

export const customSplitSchema = z
  .array(z.object({ user_id: z.uuid(), amount: z.number().min(0).max(10000000) }))
  .min(1);

export const roomSchema = z.object({
  id: z.uuid().optional(),
  building: optionalText(60),
  flat: optionalText(30),
  roomLabel: z.string().trim().min(1, { error: "required" }).max(30, { error: "tooLong" }),
  roomType: z.enum(ROOM_TYPES),
  capacity: z.coerce.number<string | number>({ error: "amountRange" }).int().min(1, { error: "amountRange" }).max(20, { error: "amountRange" }),
  monthlyRent: money(1000000),
});
export type RoomInput = z.input<typeof roomSchema>;

export const messInfoSchema = z.object({
  name: z.string().trim().min(3, { error: "messNameLength" }).max(80, { error: "tooLong" }),
  areaId: z.coerce.number<string | number>({ error: "areaRequired" }).int().positive({ error: "areaRequired" }),
  address: optionalText(200),
  buildingName: optionalText(80),
  description: optionalText(500),
  genderPolicy: z.enum(["any", "male", "female"]),
});
export type MessInfoInput = z.input<typeof messInfoSchema>;

export const mealSettingsSchema = z.object({
  mealRateMode: z.enum(["auto", "fixed"]),
  breakfastPrice: money(2000),
  lunchPrice: money(2000),
  dinnerPrice: money(2000),
  breakfastWeight: weight,
  lunchWeight: weight,
  dinnerWeight: weight,
  breakfastCutoff: time,
  breakfastPrevDay: z.boolean(),
  lunchCutoff: time,
  lunchPrevDay: z.boolean(),
  dinnerCutoff: time,
  dinnerPrevDay: z.boolean(),
  guestMealAllowed: z.boolean(),
  maxGuests: z.coerce.number<string | number>({ error: "amountRange" }).int().min(0, { error: "amountRange" }).max(10, { error: "amountRange" }),
  creditLimit: money(100000),
  lowBalanceThreshold: money(100000),
  splitSharedExpenses: z.boolean(),
  autoCloseEnabled: z.boolean(),
  autoCloseDay: z.coerce.number<string | number>({ error: "amountRange" }).int().min(1, { error: "amountRange" }).max(10, { error: "amountRange" }),
});
export type MealSettingsInput = z.input<typeof mealSettingsSchema>;

const mobileWallet = bdPhoneField.transform((v) => v || null);
export const paymentSchema = z.object({
  bkash: mobileWallet,
  nagad: mobileWallet,
  // Rocket = 11-digit mobile + 1 check digit
  rocket: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, "").replace(/^\+?880/, "0"))
    .refine((v) => v === "" || /^01[3-9]\d{8,9}$/.test(v), { error: "phone" })
    .transform((v) => v || null),
  note: optionalText(300),
});
export type PaymentInput = z.input<typeof paymentSchema>;

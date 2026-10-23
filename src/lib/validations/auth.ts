import { z } from "zod";

// Error messages are keys under `validation.*` in the message files.

export const emailField = z.string().trim().toLowerCase().min(1, { error: "required" }).pipe(z.email({ error: "email" }));

export const passwordField = z
  .string()
  .min(8, { error: "passwordMin" })
  .max(72, { error: "tooLong" })
  .regex(/[A-Za-z]/, { error: "passwordWeak" })
  .regex(/[0-9]/, { error: "passwordWeak" });

/** Bangladeshi mobile number, stored as 01XXXXXXXXX. */
export const bdPhoneField = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, "").replace(/^\+?880/, "0"))
  .refine((v) => v === "" || /^01[3-9]\d{8}$/.test(v), { error: "phone" });

export const signInSchema = z.object({
  email: emailField,
  password: z.string().min(1, { error: "required" }),
});

export const signUpSchema = z
  .object({
    fullName: z.string().trim().min(2, { error: "nameLength" }).max(80, { error: "tooLong" }),
    email: emailField,
    phone: bdPhoneField,
    password: passwordField,
    confirmPassword: z.string().min(1, { error: "required" }),
    accountType: z.enum(["user", "landlord", "service_provider"]),
    acceptTerms: z.boolean().refine((v) => v, { error: "termsRequired" }),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], error: "passwordMismatch" });

export const forgotPasswordSchema = z.object({ email: emailField });

export const resetPasswordSchema = z
  .object({
    password: passwordField,
    confirmPassword: z.string().min(1, { error: "required" }),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], error: "passwordMismatch" });

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.input<typeof signUpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/** Only allow same-site relative redirects (blocks //evil.com and absolute URLs). */
export function safeNext(next: string | null | undefined, fallback = "/dashboard") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

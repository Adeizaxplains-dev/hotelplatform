import { z } from "zod";
import { passwordSchema } from "../../shared/password.js";

const email = z.email("Enter a valid email address.").max(254).transform((v) => v.trim().toLowerCase());

// Every schema is strict(): unknown fields (role, tenantId, isActive, ...) are rejected, never ignored.
export const loginSchema = z.object({ email, password: z.string().min(1).max(128) }).strict();
export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email,
  password: passwordSchema,
  phone: z.string().trim().min(6).max(30).optional(),
}).strict();
export const forgotPasswordSchema = z.object({ email }).strict();
export const resetPasswordSchema = z.object({ token: z.string().min(20).max(200), password: passwordSchema }).strict();
export const verifyEmailSchema = z.object({ token: z.string().min(20).max(200) }).strict();

export type LoginBody = z.infer<typeof loginSchema>;
export type RegisterBody = z.infer<typeof registerSchema>;
export type ForgotBody = z.infer<typeof forgotPasswordSchema>;
export type ResetBody = z.infer<typeof resetPasswordSchema>;
export type VerifyBody = z.infer<typeof verifyEmailSchema>;

import { z } from "zod";
import { objectIdSchema, paginationSchema } from "../../shared/pagination.js";
import { FEATURES, LIMIT_KEYS, PLAN_KEYS } from "../entitlements/features.js";

const email = z.email().max(254).transform((v) => v.trim().toLowerCase());

export const createTenantSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().toLowerCase().min(3).max(40),
  plan: z.enum(PLAN_KEYS),
  ownerName: z.string().trim().min(2).max(120),
  ownerEmail: email,
  timezone: z.string().trim().min(3).max(60).refine((value) => { try { new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0)); return true; } catch { return false; } }, "Use a valid IANA timezone.").optional(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
}).strict();

export const tenantIdParams = z.object({ id: objectIdSchema }).strict();
export const featureParams = z.object({ id: objectIdSchema, feature: z.enum(FEATURES) }).strict();
export const domainParams = z.object({ id: objectIdSchema, hostname: z.string().min(4).max(253) }).strict();
export const listQuerySchema = paginationSchema.strict();

export const statusSchema = z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]), reason: z.string().trim().min(3).max(300).optional() }).strict()
  .refine((v) => v.status === "ACTIVE" || Boolean(v.reason), { message: "A reason is required to suspend a hotel.", path: ["reason"] });
export const planSchema = z.object({ plan: z.enum(PLAN_KEYS) }).strict();
export const overrideSchema = z.object({
  feature: z.enum(FEATURES), enabled: z.boolean(),
  expiresAt: z.coerce.date().nullable().optional(), reason: z.string().trim().max(300).optional(),
}).strict();
export const limitsSchema = z.object(Object.fromEntries(LIMIT_KEYS.map((k) => [k, z.number().int().min(0).nullable().optional()]))).strict();
export const domainSchema = z.object({ hostname: z.string().trim().min(4).max(253), verified: z.boolean().default(false) }).strict();

export type CreateTenantBody = z.infer<typeof createTenantSchema>;


/** Platform-operator controls for trials and billing state. */
export const trialSchema = z.object({
  action: z.enum(["START", "EXTEND", "END"]),
  endsAt: z.coerce.date().optional(),
  reason: z.string().trim().min(3).max(300),
}).strict().refine((v) => v.action !== "EXTEND" || Boolean(v.endsAt), { message: "endsAt is required when extending a trial.", path: ["endsAt"] });

export const subscriptionAdminSchema = z.object({
  plan: z.enum(PLAN_KEYS),
  status: z.enum(["ACTIVE", "PAST_DUE", "CANCELLED", "EXPIRED"]),
  currentPeriodStart: z.coerce.date().optional(),
  currentPeriodEnd: z.coerce.date().optional(),
  reason: z.string().trim().min(3).max(300),
}).strict().refine((v) => !v.currentPeriodStart || !v.currentPeriodEnd || v.currentPeriodEnd > v.currentPeriodStart, { message: "currentPeriodEnd must be after currentPeriodStart.", path: ["currentPeriodEnd"] });

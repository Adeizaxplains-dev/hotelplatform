import { z } from "zod";
import { objectIdSchema, paginationSchema } from "../../shared/pagination.js";
import { ROLES, STAFF_ROLES } from "../rbac/roles.js";

const email = z.email("Enter a valid email address.").max(254).transform((v) => v.trim().toLowerCase());
const staffRole = z.enum(STAFF_ROLES);

// strict(): a body that tries to set tenantId, isActive, passwordHash, createdBy... is rejected outright.
export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email,
  phone: z.string().trim().min(6).max(30).optional(),
  role: staffRole,
}).strict();

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().min(6).max(30).optional(),
  role: staffRole.optional(),
}).strict().refine((v) => Object.keys(v).length > 0, "Nothing to update.");

export const listUsersQuerySchema = paginationSchema.extend({
  role: z.enum(ROLES).optional(),
  active: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
  search: z.string().trim().min(1).max(80).optional(),
}).strict();

export const userIdParams = z.object({ id: objectIdSchema }).strict();

export type CreateUserBody = z.infer<typeof createUserSchema>;
export type UpdateUserBody = z.infer<typeof updateUserSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

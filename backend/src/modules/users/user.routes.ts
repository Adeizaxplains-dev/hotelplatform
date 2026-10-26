import { Router } from "express";
import { authenticate, requireFeature, requirePermission } from "../../middleware/authenticate.js";
import { requireActiveTenant, requireTenant } from "../../middleware/tenantContext.js";
import { validate } from "../../middleware/validate.js";
import type { AuthService } from "../auth/auth.service.js";
import type { EntitlementService } from "../entitlements/entitlement.service.js";
import { createUserSchema, listUsersQuerySchema, updateUserSchema, userIdParams } from "./user.schemas.js";
import type { createUserController } from "./user.controller.js";

/**
 * Pipeline per request: tenant (from host) → active tenant → authenticate → permission → feature
 * entitlement → validation → controller → service → tenant-pinned queries → audit.
 */
export function createUserRouter(auth: AuthService, entitlements: EntitlementService, c: ReturnType<typeof createUserController>): Router {
  const router = Router();
  router.use(requireTenant, requireActiveTenant, authenticate(auth), requireFeature(entitlements, "staff"));

  router.get("/roles", requirePermission("staff.read"), c.roles);
  router.get("/", requirePermission("staff.read"), validate({ query: listUsersQuerySchema }), c.list);
  router.post("/", requirePermission("staff.create"), validate({ body: createUserSchema }), c.create);
  router.get("/:id", requirePermission("staff.read"), validate({ params: userIdParams }), c.get);
  router.patch("/:id", requirePermission("staff.update"), validate({ params: userIdParams, body: updateUserSchema }), c.update);
  router.post("/:id/disable", requirePermission("staff.disable"), validate({ params: userIdParams }), c.disable);
  router.post("/:id/enable", requirePermission("staff.disable"), validate({ params: userIdParams }), c.enable);
  return router;
}

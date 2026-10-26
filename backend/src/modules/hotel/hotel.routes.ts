import { Router } from "express";
import { authenticate, requireFeature, requirePermission } from "../../middleware/authenticate.js";
import { requireActiveTenant, requireTenant } from "../../middleware/tenantContext.js";
import { getValidated, validate } from "../../middleware/validate.js";
import { actorAndTenant, handler, metaOf } from "../../shared/http.js";
import { sendSuccess } from "../../shared/response.js";
import type { AuthService } from "../auth/auth.service.js";
import type { EntitlementService } from "../entitlements/entitlement.service.js";
import { updateContentSchema, updateProfileSchema, type UpdateContentBody, type UpdateProfileBody } from "./hotel.schemas.js";
import type { HotelService } from "./hotel.service.js";

export function createHotelRouter(auth: AuthService, entitlements: EntitlementService, hotel: HotelService): Router {
  const router = Router();
  router.use(requireTenant, requireActiveTenant, authenticate(auth));

  router.get("/profile", requirePermission("settings.read"), requireFeature(entitlements, "website"), handler(async (_req, res) => {
    sendSuccess(res, await hotel.getProfile(actorAndTenant(res).tenant.id));
  }));
  router.patch("/profile", requirePermission("settings.update"), requireFeature(entitlements, "website"), validate({ body: updateProfileSchema }), handler(async (req, res) => {
    const { actor, tenant } = actorAndTenant(res);
    sendSuccess(res, await hotel.updateProfile(actor, tenant, getValidated<UpdateProfileBody>(res).body, metaOf(req, res)));
  }));

  router.get("/content", requirePermission("cms.read"), requireFeature(entitlements, "cms"), handler(async (_req, res) => {
    sendSuccess(res, await hotel.getContent(actorAndTenant(res).tenant.id));
  }));
  router.patch("/content", requirePermission("cms.update"), requireFeature(entitlements, "cms"), validate({ body: updateContentSchema }), handler(async (req, res) => {
    const { actor, tenant } = actorAndTenant(res);
    sendSuccess(res, await hotel.updateContent(actor, tenant, getValidated<UpdateContentBody>(res).body, metaOf(req, res)));
  }));
  return router;
}

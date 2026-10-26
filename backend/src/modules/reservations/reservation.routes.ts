import { Router } from "express";
import { authenticate, requireFeature, requirePermission } from "../../middleware/authenticate.js";
import { requireActiveTenant, requireTenant } from "../../middleware/tenantContext.js";
import { getValidated, validate } from "../../middleware/validate.js";
import { actorAndTenant, handler, metaOf } from "../../shared/http.js";
import { getCtx } from "../../shared/context.js";
import { sendSuccess } from "../../shared/response.js";
import { AuthorizationError } from "../../shared/errors.js";
import { hasPermission } from "../rbac/roles.js";
import type { AuthService } from "../auth/auth.service.js";
import type { EntitlementService } from "../entitlements/entitlement.service.js";
import type { ReservationService } from "./reservation.service.js";
import { availabilitySchema, createPublicReservationSchema, listReservationsSchema, reservationIdParams, updateReservationStatusSchema, type AvailabilityQuery, type CreatePublicReservationBody, type ListReservationsQuery } from "./reservation.schemas.js";

type Id = { id: string };

export function createReservationsRouter(auth: AuthService, entitlements: EntitlementService, reservations: ReservationService): Router {
  const router = Router();
  const publicBase = [requireTenant, requireActiveTenant, requireFeature(entitlements, "booking")] as const;
  router.get("/availability", ...publicBase, validate({ query: availabilitySchema }), handler(async (_req, res) => {
    sendSuccess(res, await reservations.availability(getCtx(res).tenant!, getValidated<unknown, AvailabilityQuery>(res).query));
  }));
  router.post("/", ...publicBase, validate({ body: createPublicReservationSchema }), handler(async (req, res) => {
    sendSuccess(res, await reservations.createPublic(getCtx(res).tenant!, getValidated<CreatePublicReservationBody>(res).body, metaOf(req, res)), 201);
  }));

  const staffBase = [requireTenant, requireActiveTenant, authenticate(auth), requireFeature(entitlements, "reservations")] as const;
  router.get("/", ...staffBase, requirePermission("reservations.read"), validate({ query: listReservationsSchema }), handler(async (_req, res) => {
    const { tenant } = actorAndTenant(res);
    const { items, meta } = await reservations.list(tenant.id, getValidated<unknown, ListReservationsQuery>(res).query);
    sendSuccess(res, items, 200, meta);
  }));
  router.get("/:id", ...staffBase, requirePermission("reservations.read"), validate({ params: reservationIdParams }), handler(async (_req, res) => {
    const { tenant } = actorAndTenant(res);
    sendSuccess(res, await reservations.get(tenant.id, getValidated<unknown, unknown, Id>(res).params.id));
  }));
  router.patch("/:id/status", ...staffBase, requirePermission("reservations.update"), validate({ params: reservationIdParams, body: updateReservationStatusSchema }), handler(async (req, res) => {
    const { actor, tenant } = actorAndTenant(res);
    const v = getValidated<{ status: "CONFIRMED" | "CANCELLED" | "CHECKED_IN" | "CHECKED_OUT" | "NO_SHOW" }, unknown, Id>(res);
    if (v.body.status === "CANCELLED" && !hasPermission(actor.role, "reservations.cancel")) throw new AuthorizationError("You do not have permission to cancel reservations.");
    sendSuccess(res, await reservations.updateStatus(actor, tenant, v.params.id, v.body.status, metaOf(req, res)));
  }));
  return router;
}

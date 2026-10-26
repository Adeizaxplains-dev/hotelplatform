import { Router } from "express";
import { authenticate, requireAnyPermission, requireFeature, requirePermission } from "../../middleware/authenticate.js";
import { requireActiveTenant, requireTenant } from "../../middleware/tenantContext.js";
import { getValidated, validate } from "../../middleware/validate.js";
import { actorAndTenant, handler, metaOf } from "../../shared/http.js";
import { sendSuccess } from "../../shared/response.js";
import type { AuthService } from "../auth/auth.service.js";
import type { EntitlementService } from "../entitlements/entitlement.service.js";
import { AMENITIES, FEATURE_ICONS } from "./amenities.js";
import { createRoomSchema, createRoomTypeSchema, idParams, listRoomTypesQuery, listRoomsQuery, updateRoomSchema, updateRoomTypeSchema } from "./rooms.schemas.js";
import type { CreateRoomBody, CreateRoomTypeBody, ListRoomTypesQuery, ListRoomsQuery, UpdateRoomBody, UpdateRoomTypeBody } from "./rooms.schemas.js";
import type { RoomService } from "./rooms.service.js";

type Id = { id: string };

export function createRoomsRouter(auth: AuthService, entitlements: EntitlementService, rooms: RoomService): { types: Router; rooms: Router; catalog: Router } {
  const base = [requireTenant, requireActiveTenant, authenticate(auth), requireFeature(entitlements, "rooms")] as const;

  const types = Router();
  types.use(...base);
  types.get("/", requirePermission("rooms.read"), validate({ query: listRoomTypesQuery }), handler(async (_req, res) => {
    const { items, meta } = await rooms.listTypes(actorAndTenant(res).tenant.id, getValidated<unknown, ListRoomTypesQuery>(res).query);
    sendSuccess(res, items, 200, meta);
  }));
  types.post("/", requirePermission("rooms.create"), validate({ body: createRoomTypeSchema }), handler(async (req, res) => {
    const { actor, tenant } = actorAndTenant(res);
    sendSuccess(res, await rooms.createType(actor, tenant, getValidated<CreateRoomTypeBody>(res).body, metaOf(req, res)), 201);
  }));
  types.get("/:id", requirePermission("rooms.read"), validate({ params: idParams }), handler(async (_req, res) => {
    sendSuccess(res, await rooms.getType(actorAndTenant(res).tenant.id, getValidated<unknown, unknown, Id>(res).params.id));
  }));
  types.patch("/:id", requirePermission("rooms.update"), validate({ params: idParams, body: updateRoomTypeSchema }), handler(async (req, res) => {
    const { actor, tenant } = actorAndTenant(res);
    const v = getValidated<UpdateRoomTypeBody, unknown, Id>(res);
    sendSuccess(res, await rooms.updateType(actor, tenant, v.params.id, v.body, metaOf(req, res)));
  }));
  types.delete("/:id", requirePermission("rooms.delete"), validate({ params: idParams }), handler(async (req, res) => {
    const { actor, tenant } = actorAndTenant(res);
    await rooms.deleteType(actor, tenant, getValidated<unknown, unknown, Id>(res).params.id, metaOf(req, res));
    sendSuccess(res, { deleted: true });
  }));

  const r = Router();
  r.use(...base);
  r.get("/", requirePermission("rooms.read"), validate({ query: listRoomsQuery }), handler(async (_req, res) => {
    const { items, meta } = await rooms.listRooms(actorAndTenant(res).tenant.id, getValidated<unknown, ListRoomsQuery>(res).query);
    sendSuccess(res, items, 200, meta);
  }));
  r.post("/", requirePermission("rooms.create"), validate({ body: createRoomSchema }), handler(async (req, res) => {
    const { actor, tenant } = actorAndTenant(res);
    sendSuccess(res, await rooms.createRoom(actor, tenant, getValidated<CreateRoomBody>(res).body, metaOf(req, res)), 201);
  }));
  r.get("/:id", requirePermission("rooms.read"), validate({ params: idParams }), handler(async (_req, res) => {
    sendSuccess(res, await rooms.getRoom(actorAndTenant(res).tenant.id, getValidated<unknown, unknown, Id>(res).params.id));
  }));
  r.patch("/:id", requirePermission("rooms.update"), validate({ params: idParams, body: updateRoomSchema }), handler(async (req, res) => {
    const { actor, tenant } = actorAndTenant(res);
    const v = getValidated<UpdateRoomBody, unknown, Id>(res);
    sendSuccess(res, await rooms.updateRoom(actor, tenant, v.params.id, v.body, metaOf(req, res)));
  }));
  r.delete("/:id", requirePermission("rooms.delete"), validate({ params: idParams }), handler(async (req, res) => {
    const { actor, tenant } = actorAndTenant(res);
    await rooms.deleteRoom(actor, tenant, getValidated<unknown, unknown, Id>(res).params.id, metaOf(req, res));
    sendSuccess(res, { deleted: true });
  }));

  // Fixed lists the editors choose from (amenities and icons).
  const catalog = Router();
  catalog.use(requireTenant, requireActiveTenant, authenticate(auth), requireAnyPermission("rooms.read", "cms.read", "settings.read"));
  catalog.get("/amenities", (_req, res) => sendSuccess(res, AMENITIES));
  catalog.get("/icons", (_req, res) => sendSuccess(res, FEATURE_ICONS));

  return { types, rooms: r, catalog };
}

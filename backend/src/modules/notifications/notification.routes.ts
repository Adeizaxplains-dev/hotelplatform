import { Router } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "../../middleware/authenticate.js";
import { requireActiveTenant, requireTenant } from "../../middleware/tenantContext.js";
import { getValidated, validate } from "../../middleware/validate.js";
import { actorAndTenant, handler, metaOf } from "../../shared/http.js";
import { sendSuccess } from "../../shared/response.js";
import type { AuthService } from "../auth/auth.service.js";
import type { GuestNotificationService } from "./guestNotification.service.js";
import { GUEST_NOTIFICATION_STATUSES } from "./guestNotification.model.js";

const listQuery = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), limit: z.coerce.number().int().min(1).max(100).default(25), status: z.enum(GUEST_NOTIFICATION_STATUSES).optional() }).strict();
const idParams = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) }).strict();
export function createNotificationRouter(auth: AuthService, notifications: GuestNotificationService): Router {
  const router = Router();
  router.use(requireTenant, requireActiveTenant, authenticate(auth));
  router.get("/", requirePermission("notifications.read"), validate({ query: listQuery }), handler(async (_req, res) => {
    const { tenant } = actorAndTenant(res); const q = getValidated<unknown, { page: number; limit: number; status?: (typeof GUEST_NOTIFICATION_STATUSES)[number] }>(res).query;
    const result = await notifications.list(tenant.id, q.page, q.limit, q.status); sendSuccess(res, result.items, 200, result.meta);
  }));
  router.post("/:id/retry", requirePermission("notifications.retry"), validate({ params: idParams }), handler(async (req, res) => {
    const { actor, tenant } = actorAndTenant(res); const { id } = getValidated<unknown, unknown, { id: string }>(res).params;
    sendSuccess(res, await notifications.retryFailed(actor, tenant, id, metaOf(req, res)));
  }));
  return router;
}

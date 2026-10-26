import { Router } from "express";
import { z } from "zod";
import { authenticate, requireFeature, requirePermission } from "../../middleware/authenticate.js";
import { requireActiveTenant, requireTenant } from "../../middleware/tenantContext.js";
import { getValidated, validate } from "../../middleware/validate.js";
import { actorAndTenant, handler, metaOf } from "../../shared/http.js";
import { sendSuccess } from "../../shared/response.js";
import type { AuthService } from "../auth/auth.service.js";
import type { EntitlementService } from "../entitlements/entitlement.service.js";
import type { OperationsService } from "./operations.service.js";
import { localDateString } from "../../shared/localDate.js";
import { HOUSEKEEPING_STATUSES } from "../rooms/room.model.js";

const idParams = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) }).strict();
const housekeepingQuery = z.object({ status: z.enum(HOUSEKEEPING_STATUSES).optional() }).strict();
const housekeepingBody = z.object({ status: z.enum(HOUSEKEEPING_STATUSES) }).strict();
const reportQuery = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).strict();

type Id = { id: string };
export function createOperationsRouter(auth: AuthService, entitlements: EntitlementService, operations: OperationsService): { housekeeping: Router; reports: Router } {
  const base = [requireTenant, requireActiveTenant, authenticate(auth)] as const;
  const housekeeping = Router();
  housekeeping.use(...base, requireFeature(entitlements, "housekeeping"));
  housekeeping.get("/", requirePermission("housekeeping.read"), validate({ query: housekeepingQuery }), handler(async (_req, res) => {
    const { tenant } = actorAndTenant(res);
    sendSuccess(res, await operations.listHousekeeping(tenant.id, getValidated<unknown, { status?: (typeof HOUSEKEEPING_STATUSES)[number] }>(res).query.status));
  }));
  housekeeping.patch("/:id/status", requirePermission("housekeeping.update"), validate({ params: idParams, body: housekeepingBody }), handler(async (req, res) => {
    const { actor, tenant } = actorAndTenant(res);
    const v = getValidated<{ status: string }, unknown, Id>(res);
    sendSuccess(res, await operations.updateHousekeeping(actor, tenant, v.params.id, v.body.status, metaOf(req, res)));
  }));

  const reports = Router();
  reports.use(...base, requireFeature(entitlements, "reports"), requirePermission("reports.read"));
  reports.get("/operations", validate({ query: reportQuery }), handler(async (_req, res) => {
    const { tenant } = actorAndTenant(res);
    const date = getValidated<unknown, { date?: string }>(res).query.date ?? localDateString(new Date(), tenant.timezone);
    sendSuccess(res, await operations.operationsReport(tenant.id, date, tenant.timezone));
  }));
  return { housekeeping, reports };
}

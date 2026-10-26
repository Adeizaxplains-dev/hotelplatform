import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { authenticate, requireFeature, requirePermission } from "../../middleware/authenticate.js";
import { requireActiveTenant, requireTenant } from "../../middleware/tenantContext.js";
import { getValidated, validate } from "../../middleware/validate.js";
import { getCtx } from "../../shared/context.js";
import { pageMeta, paginationSchema } from "../../shared/pagination.js";
import { sendSuccess } from "../../shared/response.js";
import type { AuthService } from "../auth/auth.service.js";
import type { EntitlementService } from "../entitlements/entitlement.service.js";
import type { AuditService } from "./audit.service.js";

const querySchema = paginationSchema.extend({ action: z.string().regex(/^[A-Z_]{3,60}$/).optional() }).strict();
type Q = z.infer<typeof querySchema>;

export function createAuditRouter(auth: AuthService, entitlements: EntitlementService, audit: AuditService): Router {
  const router = Router();
  const list: RequestHandler = (_req, res, next) => {
    const { tenant } = getCtx(res);
    const { query } = getValidated<unknown, Q>(res);
    audit.list(tenant!.id, query.page, query.limit, query.action).then(({ items, total }) => sendSuccess(res, items, 200, pageMeta(total, query.page, query.limit))).catch(next);
  };
  router.get("/", requireTenant, requireActiveTenant, authenticate(auth), requirePermission("audit.read"), requireFeature(entitlements, "auditLogs"), validate({ query: querySchema }), list);
  return router;
}

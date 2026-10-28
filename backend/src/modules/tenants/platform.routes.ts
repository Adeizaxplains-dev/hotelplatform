import { Router, type Request, type RequestHandler, type Response } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { authenticate, requirePermission, requirePlatform } from "../../middleware/authenticate.js";
import { getValidated, validate } from "../../middleware/validate.js";
import { addLogContext, getCtx } from "../../shared/context.js";
import { AuthenticationError } from "../../shared/errors.js";
import { objectIdSchema, pageMeta, paginationSchema } from "../../shared/pagination.js";
import { sendSuccess } from "../../shared/response.js";
import type { AuditService } from "../audit/audit.service.js";
import { requestMeta } from "../auth/auth.controller.js";
import type { AuthService } from "../auth/auth.service.js";
import type { PlatformService } from "./platform.service.js";
import type { TenantService } from "./tenant.service.js";
import { createTenantSchema, editTenantSchema, domainParams, domainSchema, featureParams, limitsSchema, listQuerySchema, overrideSchema, planSchema, statusSchema, tenantIdParams, trialSchema, subscriptionAdminSchema, type CreateTenantBody } from "./platform.schemas.js";

const h = (fn: (req: Request, res: Response) => Promise<void>): RequestHandler => (req, res, next) => void fn(req, res).catch(next);

/** /api/v1/platform/*: only a PLATFORM_SUPER_ADMIN signed in on the platform host. Hotel users always get 403. */
export function createPlatformRouter(auth: AuthService, platform: PlatformService, tenants: TenantService, audit: AuditService): Router {
  const router = Router();
  router.use(authenticate(auth), requirePlatform);

  const actor = (res: Response) => {
    const a = getCtx(res).auth;
    if (!a) throw new AuthenticationError();
    addLogContext(res, { platformAction: true });
    return a.userId;
  };
  const idOf = (res: Response) => getValidated<unknown, unknown, { id: string }>(res).params.id;

  router.get("/tenants", requirePermission("platform.tenants.read"), validate({ query: listQuerySchema }), h(async (_req, res) => {
    const { query } = getValidated<unknown, { page: number; limit: number }>(res);
    const { items, meta } = await platform.list(query.page, query.limit);
    sendSuccess(res, items, 200, meta);
  }));

  router.post("/tenants", requirePermission("platform.tenants.create"), validate({ body: createTenantSchema }), h(async (req, res) => {
    const { body } = getValidated<CreateTenantBody>(res);
    const portPart = (req.get("host") ?? "").match(/:\d+$/)?.[0] ?? "";
    const base = (slug: string) => `${req.protocol}://${slug}.${tenants.platformDomain}${portPart}`;
    sendSuccess(res, await platform.createTenant(actor(res), body, base, requestMeta(req, res)), 201);
  }));

  router.get("/tenants/:id", requirePermission("platform.tenants.read"), validate({ params: tenantIdParams }), h(async (_req, res) => {
    sendSuccess(res, await platform.detail(idOf(res)));
  }));

  router.patch(
  "/tenants/:id",
  requirePermission("platform.tenants.update"),
  validate({
    params: tenantIdParams,
    body: editTenantSchema,
  }),
  h(async (req, res) => {
    const { body } = getValidated<z.infer<typeof editTenantSchema>>(res);

    sendSuccess(
      res,
      await platform.updateDetails(
        actor(res),
        idOf(res),
        body,
        requestMeta(req, res),
      ),
    );
  }),
);
  router.patch("/tenants/:id/status", requirePermission("platform.tenants.update"), validate({ params: tenantIdParams, body: statusSchema }), h(async (req, res) => {
    const { body } = getValidated<z.infer<typeof statusSchema>>(res);
    sendSuccess(res, await platform.setStatus(actor(res), idOf(res), body.status, body.reason, requestMeta(req, res)));
  }));

  router.put("/tenants/:id/plan", requirePermission("platform.tenants.update"), validate({ params: tenantIdParams, body: planSchema }), h(async (req, res) => {
    const { body } = getValidated<z.infer<typeof planSchema>>(res);
    sendSuccess(res, await platform.changePlan(actor(res), idOf(res), body.plan, requestMeta(req, res)));
  }));

  router.put("/tenants/:id/trial", requirePermission("platform.tenants.update"), validate({ params: tenantIdParams, body: trialSchema }), h(async (req, res) => {
    const { body } = getValidated<z.infer<typeof trialSchema>>(res);
    sendSuccess(res, await platform.setTrial(actor(res), idOf(res), body, requestMeta(req, res)));
  }));

  router.put("/tenants/:id/subscription", requirePermission("platform.tenants.update"), validate({ params: tenantIdParams, body: subscriptionAdminSchema }), h(async (req, res) => {
    const { body } = getValidated<z.infer<typeof subscriptionAdminSchema>>(res);
    sendSuccess(res, await platform.setSubscription(actor(res), idOf(res), body, requestMeta(req, res)));
  }));

  router.put("/tenants/:id/feature-overrides", requirePermission("platform.tenants.update"), validate({ params: tenantIdParams, body: overrideSchema }), h(async (req, res) => {
    const { body } = getValidated<z.infer<typeof overrideSchema>>(res);
    sendSuccess(res, await platform.setFeatureOverride(actor(res), idOf(res), body, requestMeta(req, res)));
  }));

  router.delete("/tenants/:id/feature-overrides/:feature", requirePermission("platform.tenants.update"), validate({ params: featureParams }), h(async (req, res) => {
    const { params } = getValidated<unknown, unknown, { id: string; feature: z.infer<typeof featureParams>["feature"] }>(res);
    sendSuccess(res, await platform.removeFeatureOverride(actor(res), params.id, params.feature, requestMeta(req, res)));
  }));

  router.put("/tenants/:id/limits", requirePermission("platform.tenants.update"), validate({ params: tenantIdParams, body: limitsSchema }), h(async (req, res) => {
    const { body } = getValidated<z.infer<typeof limitsSchema>>(res);
    sendSuccess(res, await platform.setLimitOverrides(actor(res), idOf(res), body, requestMeta(req, res)));
  }));

  router.post("/tenants/:id/domains", requirePermission("platform.tenants.update"), validate({ params: tenantIdParams, body: domainSchema }), h(async (req, res) => {
    const { body } = getValidated<z.infer<typeof domainSchema>>(res);
    sendSuccess(res, await platform.addDomain(actor(res), idOf(res), body, requestMeta(req, res)), 201);
  }));

  router.delete("/tenants/:id/domains/:hostname", requirePermission("platform.tenants.update"), validate({ params: domainParams }), h(async (req, res) => {
    const { params } = getValidated<unknown, unknown, { id: string; hostname: string }>(res);
    sendSuccess(res, await platform.removeDomain(actor(res), params.id, params.hostname, requestMeta(req, res)));
  }));

  const auditQuery = paginationSchema.extend({ tenantId: objectIdSchema.optional(), action: z.string().regex(/^[A-Z_]{3,60}$/).optional() }).strict();
  router.get("/audit", requirePermission("platform.audit.read"), validate({ query: auditQuery }), h(async (_req, res) => {
    const { query } = getValidated<unknown, z.infer<typeof auditQuery>>(res);
    const { items, total } = await audit.listAll(query.page, query.limit, { tenantId: query.tenantId ? new Types.ObjectId(query.tenantId) : undefined, action: query.action });
    sendSuccess(res, items, 200, pageMeta(total, query.page, query.limit));
  }));

  return router;
}

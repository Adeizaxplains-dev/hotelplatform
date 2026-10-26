import { Router, type RequestHandler } from "express";
import { getCtx } from "../../shared/context.js";
import { TenantNotFoundError } from "../../shared/errors.js";
import { sendSuccess } from "../../shared/response.js";
import { requireTenant } from "../../middleware/tenantContext.js";
import type { EntitlementService } from "../entitlements/entitlement.service.js";
import { enabledFeatures } from "../entitlements/features.js";

/** Public: what a hotel's website needs to bootstrap. Deliberately small; no ids, plan names or limits. */
export function createTenantRouter(entitlements: EntitlementService): Router {
  const router = Router();
  const current: RequestHandler = (_req, res, next) => {
    const { tenant } = getCtx(res);
    if (!tenant) return next(new TenantNotFoundError());
    const suspended = tenant.status !== "ACTIVE";
    void (suspended ? Promise.resolve([]) : entitlements.forTenant(tenant).then(enabledFeatures))
      .then((features) => {
        res.setHeader("Cache-Control", "no-store");
        sendSuccess(res, { name: tenant.name, slug: tenant.slug, status: tenant.status, features });
      })
      .catch(next);
  };
  router.get("/current", requireTenant, current); // intentionally NOT behind requireActiveTenant: the site shows a "suspended" notice

  /**
   * Public: "what kind of address is this?" so the frontend can pick the right screen. Reveals only the scope
   * (platform / hotel / unknown) plus the same minimal hotel info as /current. Never errors for unknown hosts.
   */
  router.get("/context", (_req, res, next) => {
    const { scope, tenant } = getCtx(res);
    if (scope !== "tenant" || !tenant) {
      res.setHeader("Cache-Control", "no-store");
      return sendSuccess(res, { scope, hotel: null });
    }
    const suspended = tenant.status !== "ACTIVE";
    void (suspended ? Promise.resolve([]) : entitlements.forTenant(tenant).then(enabledFeatures))
      .then((features) => {
        res.setHeader("Cache-Control", "no-store");
        sendSuccess(res, { scope, hotel: { name: tenant.name, slug: tenant.slug, status: tenant.status, features } });
      })
      .catch(next);
  });
  return router;
}

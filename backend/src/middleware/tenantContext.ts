import type { RequestHandler } from "express";
import { addLogContext, getCtx, type RequestContext } from "../shared/context.js";
import { TenantNotFoundError, TenantSuspendedError } from "../shared/errors.js";
import type { TenantService } from "../modules/tenants/tenant.service.js";

/**
 * Builds the request context from the VERIFIED hostname only (platform domain, <slug>.<platform domain>,
 * or a verified custom domain). A tenantId in the URL, query, body, header or browser storage is never
 * read, so a user cannot switch hotels by editing anything on their side.
 *
 * `req.hostname` honours TRUST_PROXY: behind a proxy it is the original host from X-Forwarded-Host.
 */
export function tenantContext(tenants: TenantService): RequestHandler {
  return async (req, res, next) => {
    try {
      const resolved = await tenants.resolveHost(req.hostname ?? "");
      const ctx: RequestContext = { host: req.hostname ?? "", scope: resolved.scope, tenant: resolved.tenant, auth: null };
      res.locals["ctx"] = ctx;
      if (resolved.tenant) addLogContext(res, { tenantId: String(resolved.tenant.id) });
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** The route needs a hotel: unknown hosts and the platform host get a uniform 404. */
export const requireTenant: RequestHandler = (_req, res, next) => {
  if (!getCtx(res).tenant) return next(new TenantNotFoundError());
  next();
};

/** Suspended hotels are locked out of everything except reading their own status. */
export const requireActiveTenant: RequestHandler = (_req, res, next) => {
  const { tenant } = getCtx(res);
  if (tenant && tenant.status !== "ACTIVE") return next(new TenantSuspendedError());
  next();
};

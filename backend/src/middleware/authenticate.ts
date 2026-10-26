import type { RequestHandler } from "express";
import { addLogContext, getCtx } from "../shared/context.js";
import { AuthenticationError, AuthorizationError, TenantNotFoundError } from "../shared/errors.js";
import type { AuthService } from "../modules/auth/auth.service.js";
import { hasPermission } from "../modules/rbac/roles.js";
import type { Permission } from "../modules/rbac/permissions.js";
import type { EntitlementService } from "../modules/entitlements/entitlement.service.js";
import type { Feature } from "../modules/entitlements/features.js";

/**
 * Requires a valid access token (Authorization: Bearer ...) whose session is live, whose user is active,
 * and whose tenant is the tenant of the hostname being called. Role comes from the database.
 */
export function authenticate(auth: AuthService): RequestHandler {
  return async (req, res, next) => {
    try {
      const ctx = getCtx(res);
      if (ctx.scope === "unknown") throw new TenantNotFoundError();
      const header = req.header("authorization");
      const match = header?.match(/^Bearer\s+(\S+)$/i);
      if (!match?.[1]) throw new AuthenticationError();
      const result = await auth.authenticate(match[1], ctx.tenant);
      ctx.auth = { userId: result.userId, sessionId: result.sessionId, role: result.role, tenantId: result.tenantId, name: result.name, email: result.email };
      addLogContext(res, { userId: String(result.userId) });
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Backend authorization. Hiding a button is not security; this is. */
export function requirePermission(permission: Permission): RequestHandler {
  return (_req, res, next) => {
    const { auth } = getCtx(res);
    if (!auth) return next(new AuthenticationError());
    if (!hasPermission(auth.role, permission)) return next(new AuthorizationError());
    next();
  };
}

/** Passes if the role holds AT LEAST ONE of the permissions (e.g. any role that may edit content, rooms or settings may upload images). */
export function requireAnyPermission(...permissions: Permission[]): RequestHandler {
  return (_req, res, next) => {
    const { auth } = getCtx(res);
    if (!auth) return next(new AuthenticationError());
    if (!permissions.some((p) => hasPermission(auth.role, p))) return next(new AuthorizationError());
    next();
  };
}

/** Only the platform operator (a PLATFORM_SUPER_ADMIN on the platform host). */
export const requirePlatform: RequestHandler = (_req, res, next) => {
  const { auth, scope } = getCtx(res);
  if (!auth) return next(new AuthenticationError());
  if (scope !== "platform" || auth.role !== "PLATFORM_SUPER_ADMIN") return next(new AuthorizationError());
  next();
};

/** The hotel's plan (plus overrides) must include this feature. Enforced here, never just in the menu. */
export function requireFeature(entitlements: EntitlementService, feature: Feature): RequestHandler {
  return async (_req, res, next) => {
    try {
      const ctx = getCtx(res);
      if (!ctx.tenant) throw new TenantNotFoundError();
      ctx.entitlements ??= await entitlements.forTenant(ctx.tenant);
      entitlements.assertFeature(ctx.entitlements, feature);
      next();
    } catch (err) {
      next(err);
    }
  };
}

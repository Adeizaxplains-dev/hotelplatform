import type { CookieOptions, Request, RequestHandler, Response } from "express";
import type { Env } from "../../config/env.js";
import { getCtx, type RequestContext } from "../../shared/context.js";
import { AuthenticationError, TenantNotFoundError, TenantSuspendedError } from "../../shared/errors.js";
import { getValidated } from "../../middleware/validate.js";
import { sendSuccess } from "../../shared/response.js";
import type { RequestMeta } from "../audit/audit.service.js";
import type { EntitlementService } from "../entitlements/entitlement.service.js";
import { enabledFeatures } from "../entitlements/features.js";
import { permissionsFor } from "../rbac/roles.js";
import type { AuthService, IssuedSession } from "./auth.service.js";
import type { ForgotBody, LoginBody, RegisterBody, ResetBody, VerifyBody } from "./auth.schemas.js";

export const REFRESH_COOKIE = "hp_rt";
const REFRESH_PATH = "/api/v1/auth";

export const requestMeta = (req: Request, res: Response): RequestMeta => ({
  ip: req.ip,
  userAgent: req.get("user-agent")?.slice(0, 200),
  requestId: res.getHeader("X-Request-Id") as string | undefined,
});

/** Base URL for links in emails. Safe because the host was already matched to a known hotel or the platform. */
export const baseUrlFor = (req: Request): string => `${req.protocol}://${req.get("host")}`;

/** Login, refresh and the like only make sense on a known hotel host or the platform host. */
function usableScope(ctx: RequestContext) {
  if (ctx.scope === "unknown") throw new TenantNotFoundError();
  if (ctx.tenant && ctx.tenant.status !== "ACTIVE") throw new TenantSuspendedError();
  return ctx.tenant;
}

export function createAuthController(env: Env, auth: AuthService, entitlements: EntitlementService) {
  // Refresh token lives in an HttpOnly, SameSite=Strict cookie scoped to the auth routes only,
  // and is host-only (no Domain attribute), so one hotel's cookie is never sent to another hotel.
  const cookie = (): CookieOptions => ({
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    path: REFRESH_PATH,
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
  const clearCookie = (res: Response) => res.clearCookie(REFRESH_COOKIE, { ...cookie(), maxAge: undefined });
  const issue = (res: Response, s: IssuedSession, status = 200) => {
    res.cookie(REFRESH_COOKIE, s.refreshToken, cookie());
    res.setHeader("Cache-Control", "no-store");
    sendSuccess(res, { accessToken: s.accessToken, expiresIn: s.expiresIn, user: s.user }, status);
  };

  const h = (fn: (req: Request, res: Response) => Promise<void>): RequestHandler => (req, res, next) => void fn(req, res).catch(next);

  return {
    login: h(async (req, res) => {
      const tenant = usableScope(getCtx(res));
      const { body } = getValidated<LoginBody>(res);
      issue(res, await auth.login(tenant, body, requestMeta(req, res)));
    }),

    refresh: h(async (req, res) => {
      const tenant = usableScope(getCtx(res));
      const raw = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
      if (!raw) throw new AuthenticationError("Please sign in to continue.");
      try {
        issue(res, await auth.refresh(tenant, raw, requestMeta(req, res)));
      } catch (err) {
        clearCookie(res);
        throw err;
      }
    }),

    logout: h(async (req, res) => {
      const ctx = getCtx(res);
      if (ctx.scope !== "unknown") await auth.logout(ctx.tenant, (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE], requestMeta(req, res));
      clearCookie(res);
      sendSuccess(res, { loggedOut: true });
    }),

    logoutAll: h(async (req, res) => {
      const { auth: a } = getCtx(res);
      if (!a) throw new AuthenticationError();
      await auth.logoutAll(a, requestMeta(req, res));
      clearCookie(res);
      sendSuccess(res, { loggedOut: true });
    }),

    register: h(async (req, res) => {
      const tenant = usableScope(getCtx(res));
      if (!tenant) throw new TenantNotFoundError();
      const { body } = getValidated<RegisterBody>(res);
      sendSuccess(res, { user: await auth.register(tenant, body, baseUrlFor(req), requestMeta(req, res)) }, 201);
    }),

    forgotPassword: h(async (req, res) => {
      const tenant = usableScope(getCtx(res));
      const { body } = getValidated<ForgotBody>(res);
      await auth.forgotPassword(tenant, body.email, baseUrlFor(req), requestMeta(req, res));
      sendSuccess(res, { message: "If an account exists for that email, a reset link is on its way." });
    }),

    resetPassword: h(async (req, res) => {
      const tenant = usableScope(getCtx(res));
      const { body } = getValidated<ResetBody>(res);
      await auth.resetPassword(tenant, body.token, body.password, requestMeta(req, res));
      clearCookie(res);
      sendSuccess(res, { message: "Your password has been updated. Please sign in." });
    }),

    verifyEmail: h(async (req, res) => {
      const tenant = usableScope(getCtx(res));
      const { body } = getValidated<VerifyBody>(res);
      await auth.verifyEmail(tenant, body.token, requestMeta(req, res));
      sendSuccess(res, { message: "Your email is confirmed." });
    }),

    me: h(async (_req, res) => {
      const ctx = getCtx(res);
      if (!ctx.auth) throw new AuthenticationError();
      const features = ctx.tenant ? enabledFeatures(await entitlements.forTenant(ctx.tenant)) : [];
      res.setHeader("Cache-Control", "no-store");
      sendSuccess(res, {
        user: { id: String(ctx.auth.userId), name: ctx.auth.name, email: ctx.auth.email, role: ctx.auth.role },
        permissions: permissionsFor(ctx.auth.role),
        features,
        tenant: ctx.tenant ? { name: ctx.tenant.name, slug: ctx.tenant.slug } : null,
      });
    }),
  };
}

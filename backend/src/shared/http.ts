import type { Request, RequestHandler, Response } from "express";
import { getCtx } from "./context.js";
import { AuthenticationError, TenantNotFoundError } from "./errors.js";
import type { AuthContext, TenantView } from "./context.js";
import type { RequestMeta } from "../modules/audit/audit.service.js";

/** Wraps an async handler so rejections reach the central error handler. Handlers only delegate to services. */
export const handler = (fn: (req: Request, res: Response) => Promise<void>): RequestHandler => (req, res, next) => void fn(req, res).catch(next);

/** The signed-in user and the hotel from the verified request context. */
export function actorAndTenant(res: Response): { actor: AuthContext; tenant: TenantView } {
  const { auth, tenant } = getCtx(res);
  if (!auth) throw new AuthenticationError();
  if (!tenant) throw new TenantNotFoundError();
  return { actor: auth, tenant };
}

export const metaOf = (req: Request, res: Response): RequestMeta => ({
  ip: req.ip,
  userAgent: req.get("user-agent")?.slice(0, 200),
  requestId: res.getHeader("X-Request-Id") as string | undefined,
});

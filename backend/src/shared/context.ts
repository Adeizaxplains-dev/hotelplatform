import type { Response } from "express";
import type { Types } from "mongoose";
import type { Role } from "../modules/rbac/roles.js";
import type { Entitlements, PlanKey } from "../modules/entitlements/features.js";

export type TenantStatus = "ACTIVE" | "SUSPENDED";

export interface TenantView {
  id: Types.ObjectId;
  slug: string;
  name: string;
  status: TenantStatus;
  plan: PlanKey;
  currency: string;
  timezone: string;
  limitOverrides: Record<string, number | null>;
}

export interface AuthContext {
  userId: Types.ObjectId;
  sessionId: Types.ObjectId;
  /** Always loaded from the database for the request: never read from the token. */
  role: Role;
  tenantId: Types.ObjectId | null;
  name: string;
  email: string;
}

/**
 * Per-request context, built by the tenantContext() and authenticate() middleware.
 * The tenant comes ONLY from the verified hostname; nothing the client sends can change it.
 */
export interface RequestContext {
  host: string;
  scope: "platform" | "tenant" | "unknown";
  tenant: TenantView | null;
  auth: AuthContext | null;
  entitlements?: Entitlements;
}

export function getCtx(res: Response): RequestContext {
  const ctx = res.locals["ctx"] as RequestContext | undefined;
  if (!ctx) throw new Error("Request context missing: tenantContext() must run first.");
  return ctx;
}

/** Adds ids to every log line of this request. */
export function addLogContext(res: Response, extra: Record<string, unknown>): void {
  res.locals["logContext"] = { ...(res.locals["logContext"] as Record<string, unknown> | undefined), ...extra };
}

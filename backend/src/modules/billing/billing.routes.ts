import express, { Router } from "express";
import { z } from "zod";
import { requireActiveTenant, requireTenant } from "../../middleware/tenantContext.js";
import { authenticate, requirePermission } from "../../middleware/authenticate.js";
import { actorAndTenant, handler, metaOf } from "../../shared/http.js";
import { getValidated, validate } from "../../middleware/validate.js";
import { sendSuccess } from "../../shared/response.js";
import type { AuthService } from "../auth/auth.service.js";
import type { BillingService } from "./billing.service.js";
import { PLAN_KEYS } from "../entitlements/features.js";
import { PaymentError } from "../../shared/errors.js";

const checkoutSchema = z.object({ plan: z.enum(PLAN_KEYS) }).strict();
const verifySchema = z.object({ reference: z.string().trim().min(12).max(120).regex(/^[A-Za-z0-9_-]+$/) }).strict();
const historySchema = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), limit: z.coerce.number().int().min(1).max(25).default(10) }).strict();

export function createBillingRouter(auth: AuthService, billing: BillingService): Router {
  const router = Router();
  router.use(requireTenant, requireActiveTenant, authenticate(auth));

  router.get("/plans", handler(async (_req, res) => sendSuccess(res, billing.plans())));
  router.get("/current", handler(async (_req, res) => {
    const { tenant } = actorAndTenant(res);
    sendSuccess(res, await billing.current(tenant));
  }));

  // Only hotel owners can start trials, purchase plans, or view subscription billing history.
  router.post("/trial", requirePermission("settings.update"), handler(async (req, res) => {
    const { actor, tenant } = actorAndTenant(res);
    sendSuccess(res, await billing.startTrial(tenant, actor.userId, metaOf(req, res)), 201);
  }));
  router.post("/checkout", requirePermission("settings.update"), validate({ body: checkoutSchema }), handler(async (req, res) => {
    const { actor, tenant } = actorAndTenant(res);
    const { body } = getValidated<z.infer<typeof checkoutSchema>>(res);
    const origin = req.get("origin");
    sendSuccess(res, await billing.checkout(tenant, actor.userId, actor.email, body.plan, metaOf(req, res), origin ? `${origin}/admin/billing/callback` : undefined), 201);
  }));
  router.post("/verify", requirePermission("settings.update"), validate({ body: verifySchema }), handler(async (req, res) => {
    const { actor, tenant } = actorAndTenant(res);
    const { body } = getValidated<z.infer<typeof verifySchema>>(res);
    sendSuccess(res, await billing.verify(tenant, actor.userId, body.reference, metaOf(req, res)));
  }));
  router.get("/history", requirePermission("settings.update"), validate({ query: historySchema }), handler(async (_req, res) => {
    const { tenant } = actorAndTenant(res);
    const { query } = getValidated<unknown, z.infer<typeof historySchema>>(res);
    const result = await billing.history(tenant, query.page, query.limit);
    sendSuccess(res, result.items, 200, result.meta);
  }));
  return router;
}

/** Public server-to-server Paystack endpoint; raw bytes are required for signature validation. */
export function createBillingWebhookRouter(billing: BillingService): Router {
  const router = Router();
  router.post("/", express.raw({ type: "application/json", limit: "100kb" }), handler(async (req, res) => {
    if (!Buffer.isBuffer(req.body)) throw new PaymentError("Expected a JSON webhook body.", "INVALID_WEBHOOK_PAYLOAD");
    let payload: unknown;
    try { payload = JSON.parse(req.body.toString("utf8")) as unknown; }
    catch { throw new PaymentError("The subscription webhook body is not valid JSON.", "INVALID_WEBHOOK_PAYLOAD"); }
    sendSuccess(res, await billing.processWebhook(req.body, req.get("x-paystack-signature"), payload, metaOf(req, res)));
  }));
  return router;
}

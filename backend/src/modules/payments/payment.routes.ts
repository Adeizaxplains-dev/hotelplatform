import express, { Router } from "express";
import { z } from "zod";
import { requireActiveTenant, requireTenant } from "../../middleware/tenantContext.js";
import { authenticate, requireFeature, requirePermission } from "../../middleware/authenticate.js";
import type { EntitlementService } from "../entitlements/entitlement.service.js";
import { getValidated, validate } from "../../middleware/validate.js";
import { actorAndTenant, handler, metaOf } from "../../shared/http.js";
import { getCtx } from "../../shared/context.js";
import { sendSuccess } from "../../shared/response.js";
import type { PaymentService } from "./payment.service.js";
import type { AuthService } from "../auth/auth.service.js";
import { initializePaymentSchema, verifyPaymentSchema, type InitializePaymentBody, type VerifyPaymentQuery } from "./payment.schemas.js";
import { PaymentError } from "../../shared/errors.js";

const pageQuery = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), limit: z.coerce.number().int().min(1).max(25).default(10) }).strict();
const reconciliationQuery = pageQuery.extend({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).strict();
const refundBody = z.object({ reason: z.string().trim().min(5).max(500) }).strict();
const paymentIdParams = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) }).strict();

export function createPaymentRouter(auth: AuthService, payments: PaymentService, entitlements: EntitlementService): Router {
  const router = Router();
  const publicBase = [requireTenant, requireActiveTenant, requireFeature(entitlements, "booking"), requireFeature(entitlements, "payments")] as const;
  router.post("/initialize", ...publicBase, validate({ body: initializePaymentSchema }), handler(async (req, res) => {
    const body = getValidated<InitializePaymentBody>(res).body;
    sendSuccess(res, await payments.initialize(getCtx(res).tenant!, body.reservationReference, metaOf(req, res), req.get("origin") ? `${req.get("origin")}/payment/callback` : undefined), 201);
  }));
  router.get("/verify", ...publicBase, validate({ query: verifyPaymentSchema }), handler(async (req, res) => {
    const query = getValidated<unknown, VerifyPaymentQuery>(res).query;
    sendSuccess(res, await payments.verify(getCtx(res).tenant!, query.reference, metaOf(req, res)));
  }));

  const staffBase = [requireTenant, requireActiveTenant, authenticate(auth), requireFeature(entitlements, "payments")] as const;
  router.get("/refunds", ...staffBase, requirePermission("payments.read"), validate({ query: pageQuery }), handler(async (_req, res) => {
    const { tenant } = actorAndTenant(res); const q = getValidated<unknown, { page: number; limit: number }>(res).query;
    const result = await payments.listRefunds(tenant.id, q.page, q.limit); sendSuccess(res, result.items, 200, result.meta);
  }));
  router.get("/reconciliation", ...staffBase, requirePermission("payments.read"), validate({ query: reconciliationQuery }), handler(async (_req, res) => {
    const { tenant } = actorAndTenant(res); const q = getValidated<unknown, { from: string; to: string; page: number; limit: number }>(res).query;
    sendSuccess(res, await payments.reconcile(tenant, q.from, q.to, q.page, q.limit));
  }));
  router.post("/:id/refund", ...staffBase, requirePermission("payments.refund"), validate({ params: paymentIdParams, body: refundBody }), handler(async (req, res) => {
    const { actor, tenant } = actorAndTenant(res); const params = getValidated<unknown, unknown, { id: string }>(res).params; const body = getValidated<{ reason: string }>(res).body;
    sendSuccess(res, await payments.requestRefund(actor, tenant, params.id, body.reason, metaOf(req, res)), 201);
  }));
  return router;
}

/** Public server-to-server endpoint. Mount before express.json() so the signature uses exact bytes. */
export function createPaymentWebhookRouter(payments: PaymentService): Router {
  const router = Router();
  router.post("/", express.raw({ type: "application/json", limit: "100kb" }), handler(async (req, res) => {
    if (!Buffer.isBuffer(req.body)) throw new PaymentError("Expected a JSON webhook body.", "INVALID_WEBHOOK_PAYLOAD");
    let payload: unknown;
    try { payload = JSON.parse(req.body.toString("utf8")) as unknown; }
    catch { throw new PaymentError("The payment webhook body is not valid JSON.", "INVALID_WEBHOOK_PAYLOAD"); }
    const result = await payments.processWebhook(req.body, req.get("x-paystack-signature"), payload, metaOf(req, res));
    sendSuccess(res, result);
  }));
  return router;
}

import { Router } from "express";
import { z } from "zod";
import { authenticate, requireFeature, requirePermission } from "../../middleware/authenticate.js";
import { requireActiveTenant, requireTenant } from "../../middleware/tenantContext.js";
import { getValidated, validate } from "../../middleware/validate.js";
import { actorAndTenant, handler, metaOf } from "../../shared/http.js";
import { sendSuccess } from "../../shared/response.js";
import type { AuthService } from "../auth/auth.service.js";
import type { EntitlementService } from "../entitlements/entitlement.service.js";
import type { FinanceService } from "./finance.service.js";

const pageQuery = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), limit: z.coerce.number().int().min(1).max(100).default(25), q: z.string().max(100).optional() }).strict();
const invoiceBody = z.object({ reservationId: z.string().regex(/^[a-f\d]{24}$/i) }).strict();
const invoiceParams = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) }).strict();
const reportQuery = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).strict();
type Id = { id: string };
export function createFinanceRouter(auth: AuthService, entitlements: EntitlementService, finance: FinanceService): { invoices: Router; guests: Router; reports: Router } {
  const base = [requireTenant, requireActiveTenant, authenticate(auth)] as const;
  const invoices = Router();
  invoices.use(...base, requireFeature(entitlements, "invoices"));
  invoices.get("/", requirePermission("invoices.read"), validate({ query: pageQuery }), handler(async (_req, res) => {
    const { tenant } = actorAndTenant(res); const q = getValidated<unknown, { page: number; limit: number; q?: string }>(res).query;
    const result = await finance.listInvoices(tenant.id, q.page, q.limit, q.q); sendSuccess(res, result.items, 200, result.meta);
  }));
  invoices.post("/", requirePermission("invoices.create"), validate({ body: invoiceBody }), handler(async (req, res) => {
    const { actor, tenant } = actorAndTenant(res); const body = getValidated<{ reservationId: string }>(res).body;
    sendSuccess(res, await finance.createInvoice(actor, tenant, body.reservationId, metaOf(req, res)), 201);
  }));
  invoices.get("/:id", requirePermission("invoices.read"), validate({ params: invoiceParams }), handler(async (_req, res) => {
    const { tenant } = actorAndTenant(res); const id = getValidated<unknown, unknown, Id>(res).params.id; sendSuccess(res, await finance.getInvoice(tenant.id, id));
  }));

  const guests = Router();
  guests.use(...base, requireFeature(entitlements, "guests"), requirePermission("guests.read"));
  guests.get("/", validate({ query: pageQuery }), handler(async (_req, res) => {
    const { tenant } = actorAndTenant(res); const q = getValidated<unknown, { page: number; limit: number; q?: string }>(res).query;
    const result = await finance.listGuests(tenant.id, q.page, q.limit, q.q); sendSuccess(res, result.items, 200, result.meta);
  }));

  const reports = Router();
  reports.use(...base, requireFeature(entitlements, "reports"), requirePermission("reports.read"), requirePermission("reports.financial"));
  reports.get("/financial", validate({ query: reportQuery }), handler(async (_req, res) => {
    const { tenant } = actorAndTenant(res); const q = getValidated<unknown, { from: string; to: string }>(res).query; sendSuccess(res, await finance.financialReport(tenant, q.from, q.to));
  }));
  return { invoices, guests, reports };
}

import { randomBytes } from "node:crypto";
import { Types, trusted } from "mongoose";
import { AuthenticationError, ConflictError, NotFoundError, PaymentError, ServiceUnavailableError, ValidationError } from "../../shared/errors.js";
import type { TenantView } from "../../shared/context.js";
import type { AuditService, RequestMeta } from "../audit/audit.service.js";
import type { PaystackClient } from "../payments/paystack.client.js";
import { Tenant, Subscription } from "../tenants/tenant.model.js";
import { HotelBillingPayment, HotelBillingSubscription } from "./billing.model.js";
import { PLAN_KEYS, type PlanKey } from "../entitlements/features.js";

const TRIAL_DAYS = 14;
const PLAN_LABELS: Record<PlanKey, string> = { WEBSITE: "Website", BOOKING: "Booking", MANAGEMENT: "Management" };
export const parseMonthlyPriceKobo = (raw: string | undefined): number | null => {
  if (!raw || !/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
};

/** Adds one calendar month while clamping end-of-month dates (e.g. Jan 31 → Feb 28/29). */
export function addOneCalendarMonthUtc(value: Date): Date {
  if (!Number.isFinite(value.getTime())) throw new RangeError("A valid date is required.");
  const result = new Date(value);
  const preferredDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(preferredDay, lastDay));
  return result;
}
const priceFor = (plan: PlanKey, prices: Partial<Record<PlanKey, string | undefined>>): number | null => parseMonthlyPriceKobo(prices[plan]);
const ref = () => `SAAS-${Date.now().toString(36).toUpperCase()}-${randomBytes(8).toString("hex").toUpperCase()}`;

export function createBillingService(deps: {
  paystack: PaystackClient;
  audit: AuditService;
  prices: Partial<Record<PlanKey, string | undefined>>;
  callbackUrl: string;
}) {
  const planCatalog = () => PLAN_KEYS.map((plan) => ({
    key: plan,
    name: PLAN_LABELS[plan],
    monthlyPriceKobo: priceFor(plan, deps.prices),
    currency: "NGN",
    features: plan === "WEBSITE" ? ["website", "cms", "rooms", "gallery"] : plan === "BOOKING" ? ["website", "cms", "rooms", "gallery", "booking", "reservations", "guests", "payments", "invoices", "reports"] : ["website", "cms", "rooms", "gallery", "booking", "reservations", "guests", "payments", "invoices", "reports", "staff", "housekeeping", "expenses", "offers", "events", "restaurant", "auditLogs"],
  }));

  async function current(tenant: TenantView) {
    let subscription = await HotelBillingSubscription.findOne({ tenantId: tenant.id });
    if (!subscription) {
      return { plan: tenant.plan, status: "NOT_STARTED" as const, trialStartedAt: null, trialEndsAt: null, currentPeriodStart: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, lastPaymentAt: null, lastPaymentReference: null, plans: planCatalog() };
    }
    let currentPlan = tenant.plan;
    const trialExpired = subscription.status === "TRIALING" && Boolean(subscription.trialEndsAt && subscription.trialEndsAt.getTime() <= Date.now());
    const paidPeriodExpired = subscription.status === "ACTIVE" && Boolean(subscription.currentPeriodEnd && subscription.currentPeriodEnd.getTime() <= Date.now());
    if (subscription.status === "EXPIRED" || subscription.status === "PAST_DUE" || trialExpired || paidPeriodExpired) {
      if (trialExpired) subscription.status = "EXPIRED";
      if (paidPeriodExpired) subscription.status = "PAST_DUE";
      subscription.plan = "WEBSITE";
      currentPlan = "WEBSITE";
      if (trialExpired || paidPeriodExpired) await subscription.save();
      // Expired trials and unpaid periods retain a basic website rather than paid booking/management features.
      await Tenant.updateOne({ _id: tenant.id }, { $set: { plan: "WEBSITE" } });
    }
    return {
      plan: currentPlan,
      status: subscription.status,
      trialStartedAt: subscription.trialStartedAt,
      trialEndsAt: subscription.trialEndsAt,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      lastPaymentAt: subscription.lastPaymentAt,
      lastPaymentReference: subscription.lastPaymentReference,
      plans: planCatalog(),
    };
  }

  return {
    plans: planCatalog,
    current,
    async startTrial(tenant: TenantView, actorId: Types.ObjectId, meta: RequestMeta) {
      const existing = await HotelBillingSubscription.findOne({ tenantId: tenant.id });
      if (existing) {
        if (existing.status === "TRIALING") return current(tenant);
        throw new ConflictError("A trial has already been used for this hotel. Choose a paid plan to continue.");
      }
      const now = new Date();
      const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
      await HotelBillingSubscription.create({ tenantId: tenant.id, plan: tenant.plan, status: "TRIALING", trialStartedAt: now, trialEndsAt, cancelAtPeriodEnd: false });
      await deps.audit.record({ tenantId: tenant.id, actorUserId: actorId, action: "SAAS_TRIAL_STARTED", resourceType: "HotelBillingSubscription", after: { plan: tenant.plan, trialStartedAt: now, trialEndsAt }, meta });
      return current(tenant);
    },
    async checkout(tenant: TenantView, actorId: Types.ObjectId, email: string, plan: PlanKey, meta: RequestMeta, callbackUrl?: string) {
      if (!PLAN_KEYS.includes(plan)) throw new ValidationError("Choose a valid subscription plan.");
      const amountKobo = priceFor(plan, deps.prices);
      if (amountKobo === null) throw new ServiceUnavailableError("Subscription pricing has not been configured by the platform operator.");
      const currency = tenant.currency.toUpperCase();
      if (currency !== "NGN") throw new ValidationError("SaaS subscriptions currently support NGN billing only.");
      const existing = await HotelBillingPayment.findOne({ tenantId: tenant.id, status: "INITIALIZED", createdAt: trusted({ $gt: new Date(Date.now() - 30 * 60 * 1000) }) });
      if (existing) throw new ConflictError("A subscription payment is already in progress. Verify its status before starting another checkout.");
      const reference = ref();
      const payment = await HotelBillingPayment.create({ tenantId: tenant.id, reference, plan, amountKobo, currency, email, status: "INITIALIZED" });
      try {
        const initialized = await deps.paystack.initialize({ email, amountKobo, reference, currency, callbackUrl: callbackUrl ?? deps.callbackUrl });
        await deps.audit.record({ tenantId: tenant.id, actorUserId: actorId, action: "SAAS_BILLING_INITIALIZED", resourceType: "HotelBillingPayment", resourceId: String(payment._id), after: { reference, plan, amountKobo, currency }, meta });
        return { reference: initialized.reference, authorizationUrl: initialized.authorization_url, accessCode: initialized.access_code, plan, amountKobo, currency };
      } catch (error) {
        await HotelBillingPayment.updateOne({ _id: payment._id, tenantId: tenant.id, status: "INITIALIZED" }, { $set: { status: "FAILED" } });
        throw error;
      }
    },
    async processWebhook(rawBody: Buffer, signature: string | undefined, payload: unknown, meta: RequestMeta) {
      if (!deps.paystack.validWebhookSignature(rawBody, signature)) throw new AuthenticationError("Invalid payment webhook signature.");
      if (!payload || typeof payload !== "object") throw new PaymentError("Invalid subscription webhook payload.", "INVALID_WEBHOOK_PAYLOAD");
      const event = payload as { event?: unknown; data?: { reference?: unknown } };
      if (event.event !== "charge.success") return { received: true, processed: false };
      const reference = event.data?.reference;
      if (typeof reference !== "string" || !/^[A-Za-z0-9_-]{12,120}$/.test(reference)) {
        throw new PaymentError("The subscription webhook did not contain a valid reference.", "INVALID_WEBHOOK_REFERENCE");
      }
      // The reference is globally unique. Bypass tenant scope only to discover its owner, then
      // verify and apply the payment through the tenant-pinned service path.
      const payment = await HotelBillingPayment.findOne({ reference }).setOptions({ skipTenantScope: true });
      if (!payment) return { received: true, processed: false, reason: "unknown_reference" };
      const owner = await Tenant.findById(payment.tenantId);
      if (!owner) return { received: true, processed: false, reason: "unknown_tenant" };
      const tenant: TenantView = { id: owner._id, slug: owner.slug, name: owner.name, status: owner.status, plan: owner.plan, currency: owner.currency, timezone: owner.timezone, limitOverrides: owner.limitOverrides ?? {} };
      const result = await this.verify(tenant, undefined, reference, meta);
      return { received: true, processed: result.status === "SUCCESS", reference, status: result.status };
    },
    async verify(tenant: TenantView, actorId: Types.ObjectId | undefined, reference: string, meta: RequestMeta) {
      const payment = await HotelBillingPayment.findOne({ tenantId: tenant.id, reference });
      if (!payment) throw new NotFoundError("Subscription payment reference not found.");
      // A previous request may have persisted SUCCESS but failed before applying the plan. Continue
      // through the idempotent activation path below so a callback/webhook retry repairs the state.
      if (payment.status === "SUCCESS") {
        const active = await HotelBillingSubscription.findOne({ tenantId: tenant.id, status: "ACTIVE", plan: payment.plan, lastPaymentReference: payment.reference });
        const currentTenant = await Tenant.findById(tenant.id);
        if (active && currentTenant?.plan === payment.plan) return { status: "SUCCESS", reference, plan: payment.plan, amountKobo: payment.amountKobo, currency: payment.currency, message: "Subscription payment has already been applied." };
      }
      const transaction = payment.status === "SUCCESS" ? null : await deps.paystack.verify(reference);
      if (transaction) {
        if (transaction.reference !== payment.reference) throw new PaymentError("The payment reference did not match.", "PAYMENT_REFERENCE_MISMATCH");
        if (transaction.status !== "success") {
          if (["failed", "abandoned"].includes(transaction.status)) await HotelBillingPayment.updateOne({ _id: payment._id, tenantId: tenant.id, status: "INITIALIZED" }, { $set: { status: "FAILED" } });
          return { status: ["failed", "abandoned"].includes(transaction.status) ? "FAILED" : "PENDING", reference, message: "The subscription payment has not been confirmed as successful." };
        }
        if (transaction.amount !== payment.amountKobo || transaction.currency.toUpperCase() !== payment.currency || transaction.customer?.email?.toLowerCase() !== payment.email.toLowerCase()) {
          throw new PaymentError("The verified transaction does not match the subscription checkout.", "PAYMENT_DETAILS_MISMATCH");
        }
      }
      const paidAt = payment.status === "SUCCESS" ? (payment.paidAt ?? payment.createdAt ?? new Date()) : (transaction?.paid_at ? new Date(transaction.paid_at) : new Date());
      const updated = payment.status === "SUCCESS" ? payment : await HotelBillingPayment.findOneAndUpdate({ _id: payment._id, tenantId: tenant.id, status: trusted({ $in: ["INITIALIZED", "FAILED"] }) }, { $set: { status: "SUCCESS", ...(transaction?.id === undefined ? {} : { gatewayTransactionId: String(transaction.id) }), paidAt } }, { new: true });
      if (!updated && payment.status !== "SUCCESS") {
        const fresh = await HotelBillingPayment.findOne({ _id: payment._id, tenantId: tenant.id });
        if (fresh?.status !== "SUCCESS") throw new ConflictError("This subscription payment is being processed. Check its status before retrying.");
      }
      const periodEnd = addOneCalendarMonthUtc(paidAt);
      await Tenant.updateOne({ _id: tenant.id }, { $set: { plan: payment.plan } });
      const subscription = await HotelBillingSubscription.findOneAndUpdate(
        { tenantId: tenant.id },
        { $set: { plan: payment.plan, status: "ACTIVE", currentPeriodStart: paidAt, currentPeriodEnd: periodEnd, cancelAtPeriodEnd: false, lastPaymentReference: payment.reference, lastPaymentAt: paidAt }, $unset: { trialStartedAt: 1, trialEndsAt: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      const priorHistory = await Subscription.findOne({ tenantId: tenant.id, note: `SAAS_PAYMENT:${payment.reference}` });
      if (!priorHistory) await Subscription.create({ tenantId: tenant.id, plan: payment.plan, startedAt: paidAt, changedBy: actorId, note: `SAAS_PAYMENT:${payment.reference}` });
      await deps.audit.record({ tenantId: tenant.id, actorUserId: actorId, action: payment.status === "SUCCESS" ? "SAAS_SUBSCRIPTION_RECONCILED" : "SAAS_SUBSCRIPTION_ACTIVATED", resourceType: "HotelBillingSubscription", resourceId: subscription ? String(subscription._id) : undefined, before: { plan: tenant.plan }, after: { plan: payment.plan, status: "ACTIVE", currentPeriodStart: paidAt, currentPeriodEnd: periodEnd, reference: payment.reference }, meta });
      return { status: "SUCCESS", reference, plan: payment.plan, amountKobo: payment.amountKobo, currency: payment.currency, currentPeriodStart: paidAt, currentPeriodEnd: periodEnd, message: payment.status === "SUCCESS" ? "Subscription state reconciled." : "Subscription activated." };
    },
    async history(tenant: TenantView, page = 1, limit = 10) {
      const [items, total] = await Promise.all([
        HotelBillingPayment.find({ tenantId: tenant.id }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        HotelBillingPayment.countDocuments({ tenantId: tenant.id }),
      ]);
      return { items: items.map((p) => ({ reference: p.reference, plan: p.plan, amountKobo: p.amountKobo, currency: p.currency, status: p.status, paidAt: p.paidAt, createdAt: p.createdAt })), meta: { page, limit, total, pages: Math.ceil(total / limit) } };
    },
  };
}
export type BillingService = ReturnType<typeof createBillingService>;

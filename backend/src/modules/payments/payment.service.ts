import { randomBytes } from "node:crypto";
import { trusted } from "mongoose";
import type { AuthContext, TenantView } from "../../shared/context.js";
import { localDateRangeUtc } from "../../shared/localDate.js";
import { formatMinorUnits, gatewayAmountMatches, toPaystackMinorUnits } from "../../shared/money.js";
import { AuthenticationError, BusinessRuleError, ConflictError, NotFoundError, PaymentError } from "../../shared/errors.js";
import type { AuditService, RequestMeta } from "../audit/audit.service.js";
import type { GuestNotificationService } from "../notifications/guestNotification.service.js";
import { Reservation } from "../reservations/reservation.model.js";
import { Payment } from "./payment.model.js";
import { RefundRequest } from "./refund.model.js";
import type { PaystackClient } from "./paystack.client.js";

const makeReference = () => `PAY-${Date.now().toString(36).toUpperCase()}-${randomBytes(8).toString("hex").toUpperCase()}`;

async function reconcilePaidReservation(tenant: TenantView, payment: { _id: unknown; reservationId: unknown; reservationReference: string; reference: string; amount: number; currency: string }, audit: AuditService, meta: RequestMeta, recordAudit = false) {
  const reservation = await Reservation.findOne({ _id: payment.reservationId, tenantId: tenant.id });
  if (!reservation) throw new NotFoundError("Reservation not found for this payment.");
  const previousPaymentStatus = reservation.paymentStatus;
  const previousStatus = reservation.status;
  if (reservation.paymentStatus !== "PAID" || reservation.status === "PENDING") {
    reservation.paymentStatus = "PAID";
    if (reservation.status === "PENDING") reservation.status = "CONFIRMED";
    await reservation.save();
  }
  if (recordAudit && previousPaymentStatus !== "PAID") {
    await audit.record({ tenantId: tenant.id, action: "PAYMENT_VERIFIED", resourceType: "Payment", resourceId: String(payment._id), before: { reservationPaymentStatus: previousPaymentStatus, reservationStatus: previousStatus }, after: { reference: payment.reference, reservationReference: payment.reservationReference, amount: payment.amount, currency: payment.currency }, meta });
  }
}

const refundDto = (r: { _id: unknown; paymentReference: string; reservationReference: string; gatewayRefundReference?: string; amount: number; currency: string; reason: string; status: string; requestedAt: Date; processedAt?: Date; providerMessage?: string }) => ({ id: String(r._id), paymentReference: r.paymentReference, reservationReference: r.reservationReference, gatewayRefundReference: r.gatewayRefundReference, amount: r.amount, currency: r.currency, reason: r.reason, status: r.status, requestedAt: r.requestedAt, processedAt: r.processedAt, providerMessage: r.providerMessage });

export function createPaymentService({ paystack, audit, notifications, callbackUrl }: { paystack: PaystackClient; audit: AuditService; notifications: GuestNotificationService; callbackUrl: string }) {
  async function sendReceipt(tenant: TenantView, payment: { _id: unknown; reservationReference: string; reference: string; amount: number; currency: string; email: string }) {
    const amount = formatMinorUnits(payment.amount, payment.currency);
    await notifications.sendOnce(tenant.id, `payment:${String(payment._id)}:receipt`, {
      to: payment.email,
      subject: `Payment receipt — ${payment.reservationReference}`,
      text: `Payment received\n\nHotel: ${tenant.name}\nReservation reference: ${payment.reservationReference}\nPayment reference: ${payment.reference}\nAmount: ${amount}\nStatus: Successful\n\nKeep this email as your payment receipt. Contact the hotel directly if you have questions.`,
    });
  }
  const service = {
    async initialize(tenant: TenantView, reservationReference: string, meta: RequestMeta, requestCallbackUrl?: string) {
      const reservation = await Reservation.findOne({ tenantId: tenant.id, reference: reservationReference.toUpperCase() });
      if (!reservation) throw new NotFoundError("Reservation not found.");
      if (["CANCELLED", "NO_SHOW", "CHECKED_OUT"].includes(reservation.status)) throw new BusinessRuleError("This reservation can no longer be paid.", "RESERVATION_NOT_PAYABLE");
      if (reservation.paymentStatus === "PAID") throw new ConflictError("This reservation has already been paid.");
      const amountKobo = toPaystackMinorUnits(reservation.totalAmount);
      if (amountKobo === null) throw new BusinessRuleError("This reservation cannot be paid online. Contact the hotel for assistance.", "INVALID_PAYMENT_AMOUNT");
      const recentPending = await Payment.findOne({ tenantId: tenant.id, reservationId: reservation._id, status: "INITIALIZED", createdAt: trusted({ $gt: new Date(Date.now() - 30 * 60 * 1000) }) }).lean();
      if (recentPending) throw new ConflictError("A payment attempt is already in progress for this reservation. Wait a little and check the payment status before trying again.");
      await Payment.updateMany({ tenantId: tenant.id, reservationId: reservation._id, status: "INITIALIZED", createdAt: trusted({ $lte: new Date(Date.now() - 30 * 60 * 1000) }) }, { $set: { status: "FAILED" } });
      const reference = makeReference();
      let payment: InstanceType<typeof Payment>;
      try {
        payment = await Payment.create({ tenantId: tenant.id, reservationId: reservation._id, reservationReference: reservation.reference, reference, amount: reservation.totalAmount, currency: reservation.currency, email: reservation.guest.email, status: "INITIALIZED", gateway: "PAYSTACK" });
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && (error as { code?: number }).code === 11000) {
          throw new ConflictError("A payment attempt is already in progress for this reservation. Check its status before trying again.");
        }
        throw error;
      }
      try {
        const result = await paystack.initialize({ email: reservation.guest.email, amountKobo, reference, currency: reservation.currency, callbackUrl: requestCallbackUrl ?? callbackUrl });
        await audit.record({ tenantId: tenant.id, action: "PAYMENT_INITIALIZED", resourceType: "Payment", resourceId: String(payment._id), after: { reference, reservationReference: reservation.reference, amount: payment.amount, currency: payment.currency }, meta });
        return { reference: result.reference, authorizationUrl: result.authorization_url, accessCode: result.access_code, amount: payment.amount, currency: payment.currency, reservationReference: reservation.reference };
      } catch (error) {
        await Payment.updateOne({ _id: payment._id, tenantId: tenant.id, status: "INITIALIZED" }, { $set: { status: "FAILED" } });
        throw error;
      }
    },

    /** Process Paystack's server-to-server notification. Signature is checked against the exact raw body. */
    async processWebhook(rawBody: Buffer, signature: string | undefined, payload: unknown, meta: RequestMeta) {
      if (!paystack.validWebhookSignature(rawBody, signature)) {
        throw new AuthenticationError();
      }
      if (!payload || typeof payload !== "object") throw new PaymentError("Invalid payment webhook payload.", "INVALID_WEBHOOK_PAYLOAD");
      const event = payload as { event?: unknown; data?: { reference?: unknown } };
      // Paystack sends other events too. Acknowledge valid, irrelevant events without mutating records.
      if (event.event !== "charge.success") return { received: true, processed: false };
      const reference = event.data?.reference;
      if (typeof reference !== "string" || !/^[A-Za-z0-9_-]{12,120}$/.test(reference)) {
        throw new PaymentError("The payment webhook did not contain a valid reference.", "INVALID_WEBHOOK_REFERENCE");
      }
      // The reference is globally unique. Explicitly bypass tenant scope only to discover its owner;
      // all subsequent reads and writes are pinned to that payment's tenant.
      const payment = await Payment.findOne({ reference }).setOptions({ skipTenantScope: true });
      if (!payment) throw new NotFoundError("Payment reference not found.");
      const tenant = { id: payment.tenantId } as TenantView;
      const result = await service.verify(tenant, reference, meta);
      return { received: true, processed: result.status === "SUCCESS", status: result.status, reference };
    },

    async verify(tenant: TenantView, reference: string, meta: RequestMeta) {
      const payment = await Payment.findOne({ tenantId: tenant.id, reference });
      if (!payment) throw new NotFoundError("Payment reference not found.");

      // A previous request may have marked the gateway payment successful but failed before
      // updating the reservation (process crash, DB timeout, or audit failure). Every retry
      // repairs that second write instead of returning early and leaving the booking unpaid.
      if (payment.status === "SUCCESS") {
        await reconcilePaidReservation(tenant, payment, audit, meta, true);
        await sendReceipt(tenant, payment);
        return { status: "SUCCESS", reference: payment.reference, reservationReference: payment.reservationReference, amount: payment.amount, currency: payment.currency, message: "Payment has already been verified." };
      }

      const transaction = await paystack.verify(reference);
      if (transaction.reference !== payment.reference) throw new PaymentError("The payment reference did not match.", "PAYMENT_REFERENCE_MISMATCH");
      if (transaction.status !== "success") {
        if (["failed", "abandoned"].includes(transaction.status)) await Payment.updateOne({ _id: payment._id, tenantId: tenant.id, status: "INITIALIZED" }, { $set: { status: "FAILED" } });
        return { status: ["failed", "abandoned"].includes(transaction.status) ? "FAILED" : "PENDING", reference: payment.reference, reservationReference: payment.reservationReference, message: ["failed", "abandoned"].includes(transaction.status) ? "The payment was not completed. You may start a new payment attempt." : "The payment has not been confirmed as successful." };
      }
      if (!gatewayAmountMatches(payment.amount, transaction.amount) || transaction.currency.toUpperCase() !== payment.currency || transaction.customer?.email?.toLowerCase() !== payment.email.toLowerCase()) {
        throw new PaymentError("The payment details did not match this reservation. Please contact support.", "PAYMENT_DETAILS_MISMATCH");
      }

      const updated = await Payment.findOneAndUpdate(
        { _id: payment._id, tenantId: tenant.id, status: trusted({ $in: ["INITIALIZED", "FAILED"] }) },
        { $set: { status: "SUCCESS", ...(transaction.id === undefined ? {} : { gatewayTransactionId: String(transaction.id) }), paidAt: transaction.paid_at ? new Date(transaction.paid_at) : new Date() } },
        { new: true },
      );
      // Even when another concurrent verifier won the conditional update, reconcile from the
      // persisted payment state. This makes callback and webhook delivery safely repeatable.
      const persisted = updated ?? await Payment.findOne({ _id: payment._id, tenantId: tenant.id, status: "SUCCESS" });
      if (!persisted) throw new ConflictError("Payment verification is already being processed. Please check the payment status again shortly.");
      await reconcilePaidReservation(tenant, persisted, audit, meta, Boolean(updated));
      await sendReceipt(tenant, persisted);
      return { status: "SUCCESS", reference: payment.reference, reservationReference: payment.reservationReference, amount: payment.amount, currency: payment.currency, message: "Payment verified successfully." };
    },

    /** Submit a full refund to Paystack. Ambiguous provider failures are marked UNKNOWN and never retried automatically. */
    async requestRefund(actor: AuthContext, tenant: TenantView, paymentId: string, reason: string, meta: RequestMeta) {
      const payment = await Payment.findOne({ _id: paymentId, tenantId: tenant.id, status: "SUCCESS" });
      if (!payment) throw new NotFoundError("Successful payment not found.");
      const amountKobo = toPaystackMinorUnits(payment.amount);
      if (amountKobo === null) throw new BusinessRuleError("This payment amount cannot be refunded online. Contact support.", "INVALID_REFUND_AMOUNT");
      const prior = await RefundRequest.findOne({ tenantId: tenant.id, paymentId: payment._id }).lean();
      if (prior) return { ...refundDto(prior), alreadyExisted: true };
      let refund;
      try {
        refund = await RefundRequest.create({ tenantId: tenant.id, paymentId: payment._id, reservationId: payment.reservationId, paymentReference: payment.reference, reservationReference: payment.reservationReference, amount: payment.amount, currency: payment.currency, reason: reason.trim(), status: "REQUESTED", requestedBy: actor.userId, requestedAt: new Date() });
      } catch (error) {
        const duplicate = Boolean(error && typeof error === "object" && "code" in error && (error as { code?: number }).code === 11000);
        if (!duplicate) throw error;
        const raced = await RefundRequest.findOne({ tenantId: tenant.id, paymentId: payment._id }).lean();
        if (!raced) throw error;
        return { ...refundDto(raced), alreadyExisted: true };
      }
      // The request is persisted before contacting Paystack. If the network outcome is ambiguous,
      // the UNKNOWN state prevents a second automatic refund request and requires dashboard reconciliation.
      let response: Awaited<ReturnType<PaystackClient["refund"]>>;
      try {
        response = await paystack.refund({ transaction: payment.gatewayTransactionId ?? payment.reference, amountKobo, reason: reason.trim() });
      } catch (error) {
        const safeMessage = error instanceof Error ? error.message.slice(0, 280) : "Payment provider outcome could not be confirmed.";
        const updated = await RefundRequest.findOneAndUpdate({ _id: refund._id, tenantId: tenant.id, status: "REQUESTED" }, { $set: { status: "UNKNOWN", providerMessage: safeMessage } }, { new: true }).lean();
        await audit.record({ tenantId: tenant.id, actorUserId: actor.userId, action: "REFUND_OUTCOME_UNKNOWN", resourceType: "RefundRequest", resourceId: String(refund._id), after: { paymentReference: payment.reference, status: "UNKNOWN" }, meta });
        return { ...refundDto(updated ?? refund.toObject()), alreadyExisted: false, warning: "The provider response was inconclusive. Check Paystack before taking any further action; this request will not be retried automatically." };
      }
      const gatewayStatus = (response.status ?? "pending").toLowerCase();
      const status = gatewayStatus === "processed" || gatewayStatus === "success" ? "PROCESSED" : gatewayStatus === "failed" ? "FAILED" : "PROCESSING";
      const updated = await RefundRequest.findOneAndUpdate({ _id: refund._id, tenantId: tenant.id, status: "REQUESTED" }, { $set: { status, ...(response.refund_reference ? { gatewayRefundReference: response.refund_reference } : {}), ...(status === "PROCESSED" ? { processedAt: new Date() } : {}), ...(response.message ? { providerMessage: response.message.slice(0, 280) } : {}) } }, { new: true }).lean();
      await audit.record({ tenantId: tenant.id, actorUserId: actor.userId, action: "REFUND_REQUESTED", resourceType: "RefundRequest", resourceId: String(refund._id), after: { paymentReference: payment.reference, reservationReference: payment.reservationReference, amount: payment.amount, currency: payment.currency, status: updated?.status ?? status }, meta });
      return { ...refundDto(updated ?? refund.toObject()), alreadyExisted: false };
    },

    async listRefunds(tenantId: TenantView["id"], page: number, limit: number) {
      const filter = { tenantId };
      const [items, total] = await Promise.all([RefundRequest.find(filter).sort({ requestedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), RefundRequest.countDocuments(filter)]);
      return { items: items.map(refundDto), meta: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) } };
    },

    /** Read-only comparison. It deliberately does not mutate financial records. */
    async reconcile(tenant: TenantView, from: string, to: string, page: number, limit: number) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) throw new BusinessRuleError("Choose a valid date range.", "INVALID_RECONCILIATION_DATES");
      let range;
      try { range = { start: localDateRangeUtc(from, tenant.timezone).start, end: localDateRangeUtc(to, tenant.timezone).end }; }
      catch { throw new BusinessRuleError("Choose valid report dates and hotel timezone.", "INVALID_RECONCILIATION_DATES"); }
      if (range.end.getTime() - range.start.getTime() > 32 * 24 * 60 * 60 * 1000) throw new BusinessRuleError("Reconciliation is limited to 31 calendar days per request.", "RECONCILIATION_RANGE_TOO_LARGE");
      const filter = { tenantId: tenant.id, status: "SUCCESS" as const, paidAt: trusted({ $gte: range.start, $lt: range.end }) };
      const [payments, total] = await Promise.all([Payment.find(filter).sort({ paidAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Payment.countDocuments(filter)]);
      const items = [];
      for (const payment of payments) {
        try {
          const gateway = await paystack.verify(payment.reference);
          const issues: string[] = [];
          if (gateway.reference !== payment.reference) issues.push("REFERENCE_MISMATCH");
          if (gateway.status !== "success") issues.push("GATEWAY_NOT_SUCCESSFUL");
          if (!gatewayAmountMatches(payment.amount, gateway.amount)) issues.push("AMOUNT_MISMATCH");
          if (gateway.currency.toUpperCase() !== payment.currency) issues.push("CURRENCY_MISMATCH");
          if (gateway.customer?.email && gateway.customer.email.toLowerCase() !== payment.email.toLowerCase()) issues.push("CUSTOMER_EMAIL_MISMATCH");
          items.push({ paymentId: String(payment._id), reference: payment.reference, reservationReference: payment.reservationReference, localStatus: payment.status, gatewayStatus: gateway.status, amount: payment.amount, gatewayAmountMinor: gateway.amount, currency: payment.currency, paidAt: payment.paidAt, result: issues.length ? "MISMATCH" : "MATCH", issues });
        } catch {
          items.push({ paymentId: String(payment._id), reference: payment.reference, reservationReference: payment.reservationReference, localStatus: payment.status, gatewayStatus: "UNAVAILABLE", amount: payment.amount, currency: payment.currency, paidAt: payment.paidAt, result: "UNVERIFIED", issues: ["GATEWAY_VERIFICATION_UNAVAILABLE"] });
        }
      }
      return { from, to, timezone: tenant.timezone, checked: items.length, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)), items, note: "Read-only reconciliation: no payment or reservation records are changed. Review mismatches against Paystack before making accounting adjustments." };
    },
  };
  return service;
}
export type PaymentService = ReturnType<typeof createPaymentService>;

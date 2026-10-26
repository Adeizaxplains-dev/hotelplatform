import { Types, trusted } from "mongoose";
import type { AuthContext, TenantView } from "../../shared/context.js";
import { NotFoundError, ValidationError } from "../../shared/errors.js";
import { pageMeta } from "../../shared/pagination.js";
import type { AuditService, RequestMeta } from "../audit/audit.service.js";
import { Invoice, type IInvoice } from "../invoices/invoice.model.js";
import { Payment } from "../payments/payment.model.js";
import { RefundRequest } from "../payments/refund.model.js";
import { Reservation } from "../reservations/reservation.model.js";
import { localDateRangeUtc } from "../../shared/localDate.js";

type InvoiceSource = IInvoice & { _id: Types.ObjectId };
interface GuestGroup { _id: string; guest: { fullName: string; email: string; phone: string }; lastReservationAt: Date; reservations: number; totalBooked: number; currency: string; references: Array<{ reference: string; status: string; paymentStatus: string; checkIn: string; checkOut: string; totalAmount: number; currency: string }> }
const dto = (i: InvoiceSource, paid = 0, refunded = 0) => ({ id: String(i._id), invoiceNumber: i.invoiceNumber, reservationId: String(i.reservationId), reservationReference: i.reservationReference, guest: i.guest, lineItems: i.lineItems, currency: i.currency, subtotal: i.subtotal, total: i.total, amountPaid: paid, amountRefunded: refunded, balance: Math.max(0, i.total - paid), paymentStatus: refunded >= i.total && paid === 0 ? "REFUNDED" : refunded > 0 ? "PARTIALLY_REFUNDED" : paid >= i.total ? "PAID" : paid > 0 ? "PARTIALLY_PAID" : "UNPAID", status: i.status, issuedAt: i.issuedAt, voidedAt: i.voidedAt });
const safeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function createFinanceService({ audit }: { audit: AuditService }) {
  async function refundedByReservation(tenantId: Types.ObjectId, reservationIds: Types.ObjectId[]) {
    if (!reservationIds.length) return new Map<string, number>();
    const refunds = await RefundRequest.aggregate<{ _id: Types.ObjectId; amount: number }>([{ $match: { tenantId, reservationId: { $in: reservationIds }, status: "PROCESSED" } }, { $group: { _id: "$reservationId", amount: { $sum: "$amount" } } }]);
    return new Map<string, number>(refunds.map((r) => [String(r._id), r.amount] as const));
  }
  async function paidByReservation(tenantId: Types.ObjectId, reservationIds: Types.ObjectId[]) {
    if (!reservationIds.length) return new Map<string, number>();
    const [rows, refunds] = await Promise.all([
      Payment.aggregate<{ _id: Types.ObjectId; amount: number }>([{ $match: { tenantId, reservationId: { $in: reservationIds }, status: "SUCCESS" } }, { $group: { _id: "$reservationId", amount: { $sum: "$amount" } } }]),
      refundedByReservation(tenantId, reservationIds),
    ]);
    return new Map<string, number>(rows.map((r: { _id: Types.ObjectId; amount: number }) => [String(r._id), Math.max(0, r.amount - (refunds.get(String(r._id)) ?? 0))] as const));
  }
  return {
    async listInvoices(tenantId: Types.ObjectId, page: number, limit: number, q?: string) {
      const filter: Record<string, unknown> = { tenantId };
      if (q?.trim()) { const re = new RegExp(safeRegex(q.trim().slice(0, 80)), "i"); filter.$or = [{ invoiceNumber: re }, { reservationReference: re }, { "guest.fullName": re }, { "guest.email": re }]; }
      const [items, total] = await Promise.all([Invoice.find(filter).sort({ issuedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Invoice.countDocuments(filter)]);
      const [paid, refunded] = await Promise.all([paidByReservation(tenantId, items.map((i) => i.reservationId)), refundedByReservation(tenantId, items.map((i) => i.reservationId))]);
      return { items: items.map((i) => dto(i, paid.get(String(i.reservationId)) ?? 0, refunded.get(String(i.reservationId)) ?? 0)), meta: pageMeta(total, page, limit) };
    },
    async getInvoice(tenantId: Types.ObjectId, id: string) {
      if (!Types.ObjectId.isValid(id)) throw new NotFoundError("Invoice not found.");
      const invoice = await Invoice.findOne({ _id: id, tenantId }).lean();
      if (!invoice) throw new NotFoundError("Invoice not found.");
      const [paid, refunded] = await Promise.all([paidByReservation(tenantId, [invoice.reservationId]), refundedByReservation(tenantId, [invoice.reservationId])]);
      return dto(invoice, paid.get(String(invoice.reservationId)) ?? 0, refunded.get(String(invoice.reservationId)) ?? 0);
    },
    async createInvoice(actor: AuthContext, tenant: TenantView, reservationId: string, meta: RequestMeta) {
      if (!Types.ObjectId.isValid(reservationId)) throw new NotFoundError("Reservation not found.");
      const reservation = await Reservation.findOne({ _id: reservationId, tenantId: tenant.id });
      if (!reservation) throw new NotFoundError("Reservation not found.");
      const existing = await Invoice.findOne({ tenantId: tenant.id, reservationId: reservation._id }).lean();
      if (existing) { const [paid, refunded] = await Promise.all([paidByReservation(tenant.id, [reservation._id]), refundedByReservation(tenant.id, [reservation._id])]); return { ...dto(existing, paid.get(String(reservation._id)) ?? 0, refunded.get(String(reservation._id)) ?? 0), alreadyExisted: true }; }
      const invoiceNumber = `INV-${reservation.reference}`;
      const lineItems = [{ description: `Accommodation — ${reservation.checkIn} to ${reservation.checkOut} (${reservation.nights} night${reservation.nights === 1 ? "" : "s"})`, quantity: 1, unitAmount: reservation.totalAmount, lineTotal: reservation.totalAmount }];
      let invoice;
      try {
        invoice = await Invoice.create({ tenantId: tenant.id, reservationId: reservation._id, reservationReference: reservation.reference, invoiceNumber, guest: reservation.guest, lineItems, currency: reservation.currency, subtotal: reservation.totalAmount, total: reservation.totalAmount, status: "ISSUED", issuedAt: new Date() });
      } catch (err) {
        const raced = await Invoice.findOne({ tenantId: tenant.id, reservationId: reservation._id }).lean();
        if (!raced) throw err;
        const [paid, refunded] = await Promise.all([paidByReservation(tenant.id, [reservation._id]), refundedByReservation(tenant.id, [reservation._id])]);
        return { ...dto(raced, paid.get(String(reservation._id)) ?? 0, refunded.get(String(reservation._id)) ?? 0), alreadyExisted: true };
      }
      await audit.record({ tenantId: tenant.id, actorUserId: actor.userId, action: "INVOICE_ISSUED", resourceType: "Invoice", resourceId: String(invoice._id), after: { invoiceNumber, reservationReference: reservation.reference, total: reservation.totalAmount, currency: reservation.currency }, meta });
      const [paid, refunded] = await Promise.all([paidByReservation(tenant.id, [reservation._id]), refundedByReservation(tenant.id, [reservation._id])]);
      return { ...dto(invoice.toObject(), paid.get(String(reservation._id)) ?? 0, refunded.get(String(reservation._id)) ?? 0), alreadyExisted: false };
    },
    async listGuests(tenantId: Types.ObjectId, page: number, limit: number, q?: string) {
      const match: Record<string, unknown> = { tenantId };
      if (q?.trim()) { const re = new RegExp(safeRegex(q.trim().slice(0, 80)), "i"); match.$or = [{ "guest.fullName": re }, { "guest.email": re }, { "guest.phone": re }, { reference: re }]; }
      const [rows, countRows] = await Promise.all([
        Reservation.aggregate<GuestGroup>([{ $match: match }, { $sort: { createdAt: -1 } }, { $group: { _id: { $toLower: "$guest.email" }, guest: { $first: "$guest" }, lastReservationAt: { $first: "$createdAt" }, reservations: { $sum: 1 }, totalBooked: { $sum: "$totalAmount" }, currency: { $first: "$currency" }, references: { $push: { reference: "$reference", status: "$status", paymentStatus: "$paymentStatus", checkIn: "$checkIn", checkOut: "$checkOut", totalAmount: "$totalAmount", currency: "$currency" } } } }, { $sort: { lastReservationAt: -1 } }, { $skip: (page - 1) * limit }, { $limit: limit }]),
        Reservation.aggregate<{ total: number }>([{ $match: match }, { $group: { _id: { $toLower: "$guest.email" } } }, { $count: "total" }]),
      ]);
      const total = countRows[0]?.total ?? 0;
      return { items: rows.map((r) => ({ email: r._id, guest: r.guest, lastReservationAt: r.lastReservationAt, reservations: r.reservations, totalBooked: r.totalBooked, currency: r.currency, recentReservations: r.references.slice(0, 10) })), meta: pageMeta(total, page, limit) };
    },
    async financialReport(tenant: TenantView, from: string, to: string) {
      if (from > to) throw new ValidationError("The start date must be on or before the end date.");
      let range;
      try { range = { start: localDateRangeUtc(from, tenant.timezone).start, end: localDateRangeUtc(to, tenant.timezone).end }; }
      catch { throw new ValidationError("Choose valid report dates and hotel timezone."); }
      const [payments, refundsProcessed, issuedInvoices, reservations] = await Promise.all([
        Payment.aggregate<{ _id: string; total: number; count: number }>([{ $match: { tenantId: tenant.id, status: "SUCCESS", paidAt: { $gte: range.start, $lt: range.end } } }, { $group: { _id: "$currency", total: { $sum: "$amount" }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
        RefundRequest.aggregate<{ _id: string; total: number; count: number }>([{ $match: { tenantId: tenant.id, status: "PROCESSED", processedAt: { $gte: range.start, $lt: range.end } } }, { $group: { _id: "$currency", total: { $sum: "$amount" }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
        Invoice.aggregate<{ _id: string; total: number; count: number }>([{ $match: { tenantId: tenant.id, status: "ISSUED", issuedAt: { $gte: range.start, $lt: range.end } } }, { $group: { _id: "$currency", total: { $sum: "$total" }, count: { $sum: 1 } } }]),
        Reservation.find({ tenantId: tenant.id, createdAt: trusted({ $gte: range.start, $lt: range.end }), status: trusted({ $nin: ["CANCELLED", "NO_SHOW"] }) }).select("totalAmount currency").lean(),
      ]);
      const allInvoices = await Invoice.find({ tenantId: tenant.id, status: "ISSUED" }).select("reservationId total currency").lean();
      const paidAll = await paidByReservation(tenant.id, allInvoices.map((i) => i.reservationId));
      const outstanding = new Map<string, { currency: string; amount: number; invoices: number }>();
      for (const inv of allInvoices) { const balance = Math.max(0, inv.total - (paidAll.get(String(inv.reservationId)) ?? 0)); if (!balance) continue; const row = outstanding.get(inv.currency) ?? { currency: inv.currency, amount: 0, invoices: 0 }; row.amount += balance; row.invoices += 1; outstanding.set(inv.currency, row); }
      const booked = new Map<string, { currency: string; amount: number; reservations: number }>();
      for (const r of reservations) { const row = booked.get(r.currency) ?? { currency: r.currency, amount: 0, reservations: 0 }; row.amount += r.totalAmount; row.reservations += 1; booked.set(r.currency, row); }
      return { from, to, timezone: tenant.timezone, paymentsCollected: payments.map((p) => ({ currency: p._id, amount: p.total, transactions: p.count })), refundsProcessed: refundsProcessed.map((r) => ({ currency: r._id, amount: r.total, refunds: r.count })), invoicesIssued: issuedInvoices.map((i) => ({ currency: i._id, amount: i.total, invoices: i.count })), outstandingBalances: [...outstanding.values()], reservationsBooked: [...booked.values()], note: "Payments collected are gross successful payment records. Processed refunds are shown separately; outstanding balances deduct processed refunds from successful payments. This is an operational report, not a statutory accounting ledger." };
    },
  };
}
export type FinanceService = ReturnType<typeof createFinanceService>;

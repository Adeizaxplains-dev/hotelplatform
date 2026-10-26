import { Schema, model, type Types } from "mongoose";
import { tenantScope } from "../../database/plugins/tenantScope.js";

export const INVOICE_STATUSES = ["ISSUED", "VOID"] as const;
export interface IInvoiceLine { description: string; quantity: number; unitAmount: number; lineTotal: number }
export interface IInvoice {
  tenantId: Types.ObjectId; reservationId: Types.ObjectId; reservationReference: string; invoiceNumber: string;
  guest: { fullName: string; email: string; phone: string }; lineItems: IInvoiceLine[];
  currency: string; subtotal: number; total: number; status: (typeof INVOICE_STATUSES)[number]; issuedAt: Date; voidedAt?: Date;
}
const lineSchema = new Schema<IInvoiceLine>({ description: { type: String, required: true, trim: true, maxlength: 160 }, quantity: { type: Number, required: true, min: 1, validate: Number.isInteger }, unitAmount: { type: Number, required: true, min: 0, validate: Number.isInteger }, lineTotal: { type: Number, required: true, min: 0, validate: Number.isInteger } }, { _id: false });
const schema = new Schema<IInvoice>({
  reservationId: { type: Schema.Types.ObjectId, ref: "Reservation", required: true }, reservationReference: { type: String, required: true, trim: true, uppercase: true }, invoiceNumber: { type: String, required: true, trim: true, uppercase: true },
  guest: { fullName: { type: String, required: true, trim: true }, email: { type: String, required: true, lowercase: true, trim: true }, phone: { type: String, required: true, trim: true } },
  lineItems: { type: [lineSchema], required: true, validate: (v: unknown[]) => v.length > 0 }, currency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3 },
  subtotal: { type: Number, required: true, min: 0, validate: Number.isInteger }, total: { type: Number, required: true, min: 0, validate: Number.isInteger },
  status: { type: String, enum: INVOICE_STATUSES, default: "ISSUED" }, issuedAt: { type: Date, required: true, default: Date.now }, voidedAt: Date,
}, { timestamps: true, minimize: false });
tenantScope(schema, { indexed: false });
schema.index({ tenantId: 1, reservationId: 1 }, { unique: true });
schema.index({ tenantId: 1, invoiceNumber: 1 }, { unique: true });
schema.index({ tenantId: 1, issuedAt: -1 });
export const Invoice = model<IInvoice>("Invoice", schema);

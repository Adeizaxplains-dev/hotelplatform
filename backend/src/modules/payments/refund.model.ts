import { Schema, model, type Types } from "mongoose";
import { tenantScope } from "../../database/plugins/tenantScope.js";

export const REFUND_STATUSES = ["REQUESTED", "PROCESSING", "PROCESSED", "FAILED", "UNKNOWN"] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];
export interface IRefundRequest {
  tenantId: Types.ObjectId;
  paymentId: Types.ObjectId;
  reservationId: Types.ObjectId;
  paymentReference: string;
  reservationReference: string;
  gatewayRefundReference?: string;
  amount: number;
  currency: string;
  reason: string;
  status: RefundStatus;
  requestedBy: Types.ObjectId;
  requestedAt: Date;
  processedAt?: Date;
  providerMessage?: string;
}
const schema = new Schema<IRefundRequest>({
  paymentId: { type: Schema.Types.ObjectId, ref: "Payment", required: true },
  reservationId: { type: Schema.Types.ObjectId, ref: "Reservation", required: true },
  paymentReference: { type: String, required: true, trim: true },
  reservationReference: { type: String, required: true, trim: true, uppercase: true },
  gatewayRefundReference: { type: String, trim: true },
  amount: { type: Number, required: true, min: 1, validate: Number.isInteger },
  currency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3 },
  reason: { type: String, required: true, trim: true, maxlength: 500 },
  status: { type: String, enum: REFUND_STATUSES, required: true, default: "REQUESTED" },
  requestedBy: { type: Schema.Types.ObjectId, required: true },
  requestedAt: { type: Date, required: true, default: Date.now },
  processedAt: Date,
  providerMessage: { type: String, maxlength: 300 },
}, { timestamps: true, minimize: false });
tenantScope(schema, { indexed: false });
schema.index({ tenantId: 1, paymentId: 1 }, { unique: true });
schema.index({ tenantId: 1, requestedAt: -1 });
schema.index({ tenantId: 1, status: 1, requestedAt: -1 });
export const RefundRequest = model<IRefundRequest>("RefundRequest", schema);

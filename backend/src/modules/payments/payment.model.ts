import { Schema, model, type Types } from "mongoose";
import { tenantScope } from "../../database/plugins/tenantScope.js";

export const PAYMENT_RECORD_STATUSES = ["INITIALIZED", "SUCCESS", "FAILED"] as const;
export interface IPayment {
  tenantId: Types.ObjectId;
  reservationId: Types.ObjectId;
  reservationReference: string;
  reference: string;
  amount: number;
  currency: string;
  email: string;
  status: (typeof PAYMENT_RECORD_STATUSES)[number];
  gateway: "PAYSTACK";
  gatewayTransactionId?: string;
  paidAt?: Date;
}
const schema = new Schema<IPayment>({
  reservationId: { type: Schema.Types.ObjectId, ref: "Reservation", required: true },
  reservationReference: { type: String, required: true, trim: true, uppercase: true },
  reference: { type: String, required: true, trim: true, unique: true },
  amount: { type: Number, required: true, min: 1, validate: Number.isInteger },
  currency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3 },
  email: { type: String, required: true, lowercase: true, trim: true },
  status: { type: String, enum: PAYMENT_RECORD_STATUSES, default: "INITIALIZED" },
  gateway: { type: String, enum: ["PAYSTACK"], required: true },
  gatewayTransactionId: String,
  paidAt: Date,
}, { timestamps: true, minimize: false });
tenantScope(schema, { indexed: false });
schema.index({ tenantId: 1, reservationId: 1, createdAt: -1 });
// Final database-level guard against concurrent requests opening multiple active attempts.
schema.index({ tenantId: 1, reservationId: 1 }, { unique: true, partialFilterExpression: { status: "INITIALIZED" } });
schema.index({ tenantId: 1, reference: 1 }, { unique: true });
export const Payment = model<IPayment>("Payment", schema);

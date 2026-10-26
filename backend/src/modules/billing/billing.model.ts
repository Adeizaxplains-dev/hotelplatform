import { Schema, model, type Types } from "mongoose";
import { PLAN_KEYS, type PlanKey } from "../entitlements/features.js";
import { tenantScope } from "../../database/plugins/tenantScope.js";

export const BILLING_STATES = ["TRIALING", "ACTIVE", "PAST_DUE", "CANCELLED", "EXPIRED"] as const;
export interface IHotelBillingSubscription {
  tenantId: Types.ObjectId;
  plan: PlanKey;
  status: (typeof BILLING_STATES)[number];
  trialStartedAt?: Date;
  trialEndsAt?: Date;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd: boolean;
  lastPaymentReference?: string;
  lastPaymentAt?: Date;
}
const subscriptionSchema = new Schema<IHotelBillingSubscription>({
  plan: { type: String, enum: PLAN_KEYS, required: true },
  status: { type: String, enum: BILLING_STATES, required: true, default: "TRIALING" },
  trialStartedAt: Date,
  trialEndsAt: Date,
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  cancelAtPeriodEnd: { type: Boolean, default: false },
  lastPaymentReference: String,
  lastPaymentAt: Date,
}, { timestamps: true, minimize: false });
tenantScope(subscriptionSchema, { indexed: false });
subscriptionSchema.index({ tenantId: 1 }, { unique: true });
export const HotelBillingSubscription = model<IHotelBillingSubscription>("HotelBillingSubscription", subscriptionSchema);

export const BILLING_PAYMENT_STATES = ["INITIALIZED", "SUCCESS", "FAILED"] as const;
export interface IHotelBillingPayment {
  tenantId: Types.ObjectId;
  reference: string;
  plan: PlanKey;
  amountKobo: number;
  currency: string;
  email: string;
  status: (typeof BILLING_PAYMENT_STATES)[number];
  gatewayTransactionId?: string;
  paidAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
const paymentSchema = new Schema<IHotelBillingPayment>({
  reference: { type: String, required: true, unique: true },
  plan: { type: String, enum: PLAN_KEYS, required: true },
  amountKobo: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  currency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3 },
  email: { type: String, required: true, lowercase: true, trim: true },
  status: { type: String, enum: BILLING_PAYMENT_STATES, default: "INITIALIZED" },
  gatewayTransactionId: String,
  paidAt: Date,
}, { timestamps: true, minimize: false });
tenantScope(paymentSchema);
paymentSchema.index({ tenantId: 1, createdAt: -1 });
paymentSchema.index({ tenantId: 1, reference: 1 }, { unique: true });
export const HotelBillingPayment = model<IHotelBillingPayment>("HotelBillingPayment", paymentSchema);

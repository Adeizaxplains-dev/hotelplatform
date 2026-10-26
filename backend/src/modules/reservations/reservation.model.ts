import { Schema, model, type Types } from "mongoose";
import { tenantScope } from "../../database/plugins/tenantScope.js";

export const RESERVATION_STATUSES = ["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "NO_SHOW"] as const;
export const PAYMENT_STATUSES = ["UNPAID", "PARTIALLY_PAID", "PAID", "REFUNDED"] as const;

export interface IReservation {
  tenantId: Types.ObjectId;
  reference: string;
  roomTypeId: Types.ObjectId;
  roomId: Types.ObjectId;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  guest: { fullName: string; email: string; phone: string };
  specialRequests?: string;
  currency: string;
  nightlyRate: number;
  totalAmount: number;
  status: (typeof RESERVATION_STATUSES)[number];
  paymentStatus: (typeof PAYMENT_STATUSES)[number];
  source: "WEBSITE" | "STAFF";
  cancelledAt?: Date;
  checkedInAt?: Date;
  checkedOutAt?: Date;
}

const schema = new Schema<IReservation>({
  reference: { type: String, required: true, trim: true, uppercase: true },
  roomTypeId: { type: Schema.Types.ObjectId, ref: "RoomType", required: true },
  roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true },
  checkIn: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  checkOut: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  nights: { type: Number, required: true, min: 1, max: 30 },
  adults: { type: Number, required: true, min: 1, max: 20 },
  children: { type: Number, required: true, min: 0, max: 10 },
  guest: {
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
  },
  specialRequests: { type: String, trim: true, maxlength: 1000 },
  currency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3 },
  nightlyRate: { type: Number, required: true, min: 0, validate: Number.isInteger },
  totalAmount: { type: Number, required: true, min: 0, validate: Number.isInteger },
  status: { type: String, enum: RESERVATION_STATUSES, default: "PENDING" },
  paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "UNPAID" },
  source: { type: String, enum: ["WEBSITE", "STAFF"], required: true },
  cancelledAt: Date,
  checkedInAt: Date,
  checkedOutAt: Date,
}, { timestamps: true, minimize: false });
tenantScope(schema, { indexed: false });
schema.index({ tenantId:  1, reference: 1 }, { unique: true });
schema.index({ tenantId: 1, checkIn: 1, status: 1 });
schema.index({ tenantId: 1, "guest.email": 1, createdAt: -1 });
export const Reservation = model<IReservation>("Reservation", schema);

import { Schema, model, type Types } from "mongoose";
import { tenantScope } from "../../database/plugins/tenantScope.js";

export const GUEST_NOTIFICATION_STATUSES = ["PENDING", "SENDING", "SENT", "FAILED"] as const;
export interface IGuestNotification {
  tenantId: Types.ObjectId;
  eventKey: string;
  recipient: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
  status: (typeof GUEST_NOTIFICATION_STATUSES)[number];
  attempts: number;
  sentAt?: Date;
  lastError?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
const schema = new Schema<IGuestNotification>({
  eventKey: { type: String, required: true, trim: true, maxlength: 180 },
  recipient: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
  subject: { type: String, required: true, trim: true, maxlength: 180 },
  textBody: { type: String, required: true, maxlength: 20000, select: false },
  htmlBody: { type: String, maxlength: 20000, select: false },
  status: { type: String, enum: GUEST_NOTIFICATION_STATUSES, default: "PENDING" },
  attempts: { type: Number, default: 0, min: 0 },
  sentAt: Date,
  lastError: { type: String, maxlength: 300 },
}, { timestamps: true, minimize: false });
tenantScope(schema, { indexed: false });
schema.index({ tenantId: 1, eventKey: 1 }, { unique: true });
schema.index({ tenantId: 1, status: 1, updatedAt: -1 });
export const GuestNotification = model<IGuestNotification>("GuestNotification", schema);

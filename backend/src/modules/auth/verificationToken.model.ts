import { Schema, model, type Types } from "mongoose";
import { tenantScope } from "../../database/plugins/tenantScope.js";

export const TOKEN_PURPOSES = ["PASSWORD_RESET", "EMAIL_VERIFY", "INVITE"] as const;
export type TokenPurpose = (typeof TOKEN_PURPOSES)[number];

/** One-time links sent by email. Only the HMAC of the token is stored; each can be used once. */
export interface IVerificationToken {
  tenantId: Types.ObjectId | null;
  userId: Types.ObjectId;
  purpose: TokenPurpose;
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date | null | undefined;
}

const schema = new Schema<IVerificationToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    purpose: { type: String, enum: TOKEN_PURPOSES, required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
tenantScope(schema, { nullable: true });
export const VerificationToken = model<IVerificationToken>("VerificationToken", schema);

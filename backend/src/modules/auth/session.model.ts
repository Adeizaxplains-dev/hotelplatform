import { Schema, model, type Types } from "mongoose";
import { tenantScope } from "../../database/plugins/tenantScope.js";

export const REVOKE_REASONS = ["LOGOUT", "LOGOUT_ALL", "REUSE_DETECTED", "PASSWORD_RESET", "USER_DISABLED", "USER_INACTIVE", "ROLE_CHANGED"] as const;
export type RevokeReason = (typeof REVOKE_REASONS)[number];

/**
 * One row per signed-in device. The refresh token itself is never stored: only its HMAC.
 * `tokenHash` is the current token; `previousTokenHash` is the one it replaced. Presenting the
 * previous token again means it was copied, so the whole session is revoked (reuse detection).
 */
export interface ISession {
  tenantId: Types.ObjectId | null;
  userId: Types.ObjectId;
  tokenHash: string;
  previousTokenHash?: string | undefined;
  expiresAt: Date;
  rotatedAt?: Date | undefined;
  lastUsedAt?: Date | undefined;
  revokedAt?: Date | null | undefined;
  revokedReason?: RevokeReason | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

const sessionSchema = new Schema<ISession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    previousTokenHash: { type: String, index: true },
    expiresAt: { type: Date, required: true },
    rotatedAt: Date,
    lastUsedAt: Date,
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, enum: REVOKE_REASONS },
    ipAddress: { type: String, maxlength: 64 },
    userAgent: { type: String, maxlength: 200 },
  },
  { timestamps: true }
);
tenantScope(sessionSchema, { nullable: true });
// Expired sessions are cleaned by a scheduled job (Phase 6); the TTL index is deliberately not used.
export const Session = model<ISession>("Session", sessionSchema);

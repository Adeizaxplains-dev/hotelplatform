import { Schema, model, type Types } from "mongoose";
import { tenantScope } from "../../database/plugins/tenantScope.js";
import { ROLES, type Role } from "../rbac/roles.js";

export interface IUser {
  /** null = platform operator account. */
  tenantId: Types.ObjectId | null;
  name: string;
  email: string;
  phone?: string | undefined;
  passwordHash: string;
  role: Role;
  isActive: boolean;
  emailVerifiedAt?: Date | undefined;
  failedLoginCount: number;
  lockedUntil?: Date | undefined;
  lastLoginAt?: Date | undefined;
  passwordChangedAt?: Date | undefined;
  createdBy?: Types.ObjectId | undefined;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 30 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true },
    isActive: { type: Boolean, default: true },
    emailVerifiedAt: Date,
    failedLoginCount: { type: Number, default: 0 },
    lockedUntil: Date,
    lastLoginAt: Date,
    passwordChangedAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

tenantScope(userSchema, { nullable: true });
// One account per email per hotel. Platform operators (tenantId null) are unique among themselves.
userSchema.index({ tenantId: 1, email: 1 }, { unique: true });
userSchema.index({ tenantId: 1, role: 1, isActive: 1 });

// A platform role only exists outside tenants, and tenant users never carry it.
userSchema.pre("validate", function () {
  const platform = this.role === "PLATFORM_SUPER_ADMIN";
  if (platform !== (this.tenantId === null || this.tenantId === undefined)) {
    throw new Error("Platform roles must have no tenant, and tenant users must have one.");
  }
});

export const User = model<IUser>("User", userSchema);

/** The only shape of a user that may leave the server. */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  phone?: string | undefined;
  role: Role;
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt?: Date | undefined;
  createdAt?: Date | undefined;
}

export function toPublicUser(u: { _id: Types.ObjectId } & Omit<IUser, "passwordHash" | "tenantId"> & { createdAt?: Date }): PublicUser {
  return {
    id: String(u._id),
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    isActive: u.isActive,
    emailVerified: Boolean(u.emailVerifiedAt),
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
  };
}

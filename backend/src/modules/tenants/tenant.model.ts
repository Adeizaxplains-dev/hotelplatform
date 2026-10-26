import { Schema, model, type Types } from "mongoose";
import { PLAN_KEYS, FEATURES, type Feature, type PlanKey } from "../entitlements/features.js";
import { tenantScope } from "../../database/plugins/tenantScope.js";

export const TENANT_STATUSES = ["ACTIVE", "SUSPENDED"] as const;

/** Hostnames that can never be a hotel slug (they would shadow platform pages or look official). */
export const RESERVED_SLUGS = ["www", "api", "app", "admin", "platform", "status", "mail", "support", "help", "billing", "static", "cdn", "assets", "localhost"] as const;
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/;

export interface ITenant {
  name: string;
  slug: string;
  status: (typeof TENANT_STATUSES)[number];
  plan: PlanKey;
  /** Per-tenant limit overrides (null = unlimited). Validated by the entitlement service. */
  limitOverrides: Record<string, number | null>;
  suspendedReason?: string | undefined;
  timezone: string;
  currency: string;
}

const tenantSchema = new Schema<ITenant>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, match: SLUG_PATTERN },
    status: { type: String, enum: TENANT_STATUSES, default: "ACTIVE", index: true },
    plan: { type: String, enum: PLAN_KEYS, required: true },
    limitOverrides: { type: Schema.Types.Mixed, default: {} },
    suspendedReason: { type: String, maxlength: 300 },
    timezone: { type: String, default: "Africa/Lagos" },
    currency: { type: String, default: "NGN", uppercase: true, minlength: 3, maxlength: 3 },
  },
  { timestamps: true, minimize: false }
);

export const Tenant = model<ITenant>("Tenant", tenantSchema);

/**
 * A custom domain (www.grandhotel.com) mapped to a tenant. Looked up by hostname BEFORE the tenant is
 * known, so this collection is platform-level (not tenant-scoped). Only `verified` domains resolve.
 */
export interface ITenantDomain {
  hostname: string;
  tenantId: Types.ObjectId;
  verified: boolean;
  verifiedAt?: Date | undefined;
}
const domainSchema = new Schema<ITenantDomain>(
  {
    hostname: { type: String, required: true, unique: true, lowercase: true, trim: true },
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    verified: { type: Boolean, default: false },
    verifiedAt: Date,
  },
  { timestamps: true }
);
export const TenantDomain = model<ITenantDomain>("TenantDomain", domainSchema);

/** Append-only history of plan assignments for a tenant (the current plan lives on the Tenant). */
export interface ISubscription {
  tenantId: Types.ObjectId;
  plan: PlanKey;
  startedAt: Date;
  changedBy?: Types.ObjectId | undefined;
  note?: string | undefined;
}
const subscriptionSchema = new Schema<ISubscription>(
  {
    plan: { type: String, enum: PLAN_KEYS, required: true },
    startedAt: { type: Date, default: Date.now },
    changedBy: { type: Schema.Types.ObjectId, ref: "User" },
    note: { type: String, maxlength: 300 },
  },
  { timestamps: true }
);
tenantScope(subscriptionSchema);
subscriptionSchema.index({ tenantId: 1, startedAt: -1 });
export const Subscription = model<ISubscription>("Subscription", subscriptionSchema);

/** A per-tenant exception to the plan: switch a feature on (paid add-on) or off, optionally until a date. */
export interface IFeatureOverride {
  tenantId: Types.ObjectId;
  feature: Feature;
  enabled: boolean;
  expiresAt?: Date | null | undefined;
  reason?: string | undefined;
  createdBy?: Types.ObjectId | undefined;
}
const overrideSchema = new Schema<IFeatureOverride>(
  {
    feature: { type: String, enum: FEATURES, required: true },
    enabled: { type: Boolean, required: true },
    expiresAt: { type: Date, default: null },
    reason: { type: String, maxlength: 300 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);
tenantScope(overrideSchema);
overrideSchema.index({ tenantId: 1, feature: 1 }, { unique: true });
export const FeatureOverride = model<IFeatureOverride>("FeatureOverride", overrideSchema);

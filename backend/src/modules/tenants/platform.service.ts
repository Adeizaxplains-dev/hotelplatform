
import { Types } from "mongoose";
import type { EmailService } from "../../integrations/email/email.service.js";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/errors.js";
import { hashPassword, passwordProblemFor, unusablePasswordHash } from "../../shared/password.js";
import { pageMeta } from "../../shared/pagination.js";
import type { AuditService, RequestMeta } from "../audit/audit.service.js";
import { inviteEmail } from "../auth/auth.emails.js";
import type { OneTimeTokenService } from "../auth/oneTimeToken.service.js";
import type { EntitlementService } from "../entitlements/entitlement.service.js";
import { LIMIT_KEYS, enabledFeatures, type Feature, type LimitKey, type PlanKey } from "../entitlements/features.js";
import { User } from "../users/user.model.js";
import { RESERVED_SLUGS, SLUG_PATTERN, FeatureOverride, Subscription, Tenant, TenantDomain } from "./tenant.model.js";
import { HotelBillingSubscription } from "../billing/billing.model.js";
import { toTenantView, type TenantService } from "./tenant.service.js";

interface Deps {
  tenants: TenantService;
  audit: AuditService;
  entitlements: EntitlementService;
  oneTime: OneTimeTokenService;
  email: EmailService;
}

const DOMAIN_PATTERN = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

/** Operations only the SaaS operator (PLATFORM_SUPER_ADMIN) can perform. Tenant ids here are RESOURCES, not request context. */
export function createPlatformService({ tenants, audit, entitlements, oneTime, email }: Deps) {
  const toObjectId = (id: string) => new Types.ObjectId(id);

  async function loadTenant(id: string) {
    const doc = await Tenant.findById(id);
    if (!doc) throw new NotFoundError("Hotel not found.");
    return doc;
  }

  async function detail(id: string) {
    const doc = await loadTenant(id);
    const view = toTenantView(doc);
    const [ent, overrides, domains, ownerCount, subs] = await Promise.all([
      entitlements.forTenant(view),
      FeatureOverride.find({ tenantId: doc._id }).lean(),
      TenantDomain.find({ tenantId: doc._id }).lean(),
      User.countDocuments({ tenantId: doc._id, role: "HOTEL_OWNER" }),
      Subscription.find({ tenantId: doc._id }).sort({ startedAt: -1 }).limit(10).lean(),
    ]);

    return {
      id: String(doc._id),
      name: doc.name,
      slug: doc.slug,
      status: doc.status,
      plan: doc.plan,
      suspendedReason: doc.suspendedReason,
      timezone: doc.timezone,
      currency: doc.currency,
      createdAt: (doc as unknown as { createdAt: Date }).createdAt,
      limitOverrides: doc.limitOverrides,
      entitlements: { features: enabledFeatures(ent), limits: ent.limits },
      featureOverrides: overrides.map((o) => ({
        feature: o.feature,
        enabled: o.enabled,
        expiresAt: o.expiresAt,
        reason: o.reason,
      })),
      domains: domains.map((d) => ({ hostname: d.hostname, verified: d.verified })),
      ownerCount,
      subscriptions: subs.map((s) => ({
        plan: s.plan,
        startedAt: s.startedAt,
        note: s.note,
      })),
    };
  }

  return {
    detail,

    async list(page: number, limit: number) {
      const [rows, total] = await Promise.all([
        Tenant.find({})
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Tenant.countDocuments({}),
      ]);

      return {
        items: rows.map((t) => ({
          id: String(t._id),
          name: t.name,
          slug: t.slug,
          status: t.status,
          plan: t.plan,
        })),
        meta: pageMeta(total, page, limit),
      };
    },

    /** Creates the hotel, its plan history and an owner account that is invited by email (no shared passwords). */
    async createTenant(
      actorId: Types.ObjectId,
      input: {
        name: string;
        slug: string;
        plan: PlanKey;
        ownerName: string;
        ownerEmail: string;
        timezone?: string | undefined;
        currency?: string | undefined;
      },
      tenantBaseUrl: (slug: string) => string,
      meta: RequestMeta
    ) {
      if (RESERVED_SLUGS.includes(input.slug as never) || !SLUG_PATTERN.test(input.slug)) {
        throw new ValidationError("That address is not available. Use 3-40 lowercase letters, numbers or hyphens.");
      }

      if (await Tenant.exists({ slug: input.slug })) {
        throw new ConflictError("A hotel with this address already exists.");
      }

      const tenant = await Tenant.create({
        name: input.name,
        slug: input.slug,
        plan: input.plan,
        timezone: input.timezone ?? "Africa/Lagos",
        currency: input.currency ?? "NGN",
      });

      try {
        await Subscription.create({
          tenantId: tenant._id,
          plan: input.plan,
          changedBy: actorId,
          note: "Initial plan",
        });

        const trialStartedAt = new Date();
        const trialEndsAt = new Date(trialStartedAt.getTime() + 14 * 24 * 60 * 60 * 1000);

        await HotelBillingSubscription.create({
          tenantId: tenant._id,
          plan: input.plan,
          status: "TRIALING",
          trialStartedAt,
          trialEndsAt,
          cancelAtPeriodEnd: false,
        });

        const owner = await User.create({
          tenantId: tenant._id,
          name: input.ownerName,
          email: input.ownerEmail.trim().toLowerCase(),
          role: "HOTEL_OWNER",
          isActive: true,
          passwordHash: await unusablePasswordHash(),
          createdBy: actorId,
        });

        const raw = await oneTime.issue(tenant._id, owner._id, "INVITE");

        await email.send(
          inviteEmail(
            owner.email,
            tenant.name,
            `${tenantBaseUrl(tenant.slug)}/reset-password?token=${raw}&invite=1`
          )
        );
      } catch (err) {
        // Roll back creation so a failed invitation does not leave a partially created hotel.
        await Subscription.deleteMany({ tenantId: tenant._id });
        await HotelBillingSubscription.deleteMany({ tenantId: tenant._id });
        await User.deleteMany({ tenantId: tenant._id });
        await Tenant.deleteOne({ _id: tenant._id });
        throw err;
      }

      await audit.record({
        tenantId: tenant._id,
        actorUserId: actorId,
        action: "TENANT_CREATED",
        resourceType: "Tenant",
        resourceId: String(tenant._id),
        after: { name: tenant.name, slug: tenant.slug, plan: tenant.plan },
        meta,
      });

      return detail(String(tenant._id));
    },

    /** Updates basic hotel details without changing its address, plan, or status. */
    async updateDetails(
      actorId: Types.ObjectId,
      id: string,
      input: { name: string; timezone: string; currency: string },
      meta: RequestMeta
    ) {
      const doc = await loadTenant(id);

      const before = {
        name: doc.name,
        timezone: doc.timezone,
        currency: doc.currency,
      };

      doc.name = input.name;
      doc.timezone = input.timezone;
      doc.currency = input.currency;

      await doc.save();

      await audit.record({
        tenantId: doc._id,
        actorUserId: actorId,
        action: "TENANT_DETAILS_UPDATED",
        resourceType: "Tenant",
        resourceId: id,
        before,
        after: {
          name: doc.name,
          timezone: doc.timezone,
          currency: doc.currency,
        },
        meta,
      });

      return detail(id);
    },

    async setStatus(
      actorId: Types.ObjectId,
      id: string,
      status: "ACTIVE" | "SUSPENDED",
      reason: string | undefined,
      meta: RequestMeta
    ) {
      const doc = await loadTenant(id);
      const before = { status: doc.status };

      doc.status = status;
      doc.suspendedReason = status === "SUSPENDED" ? reason : undefined;

      await doc.save();

      await audit.record({
        tenantId: doc._id,
        actorUserId: actorId,
        action: status === "SUSPENDED" ? "TENANT_SUSPENDED" : "TENANT_ACTIVATED",
        resourceType: "Tenant",
        resourceId: id,
        before,
        after: { status, reason },
        meta,
      });

      return detail(id);
    },

    /** Operator-managed trial lifecycle. Every change is recorded in the audit trail. */
    async setTrial(
      actorId: Types.ObjectId,
      id: string,
      input: { action: "START" | "EXTEND" | "END"; endsAt?: Date | undefined; reason: string },
      meta: RequestMeta
    ) {
      const doc = await loadTenant(id);
      const now = new Date();

      let billing = await HotelBillingSubscription.findOne({ tenantId: doc._id });

      if (!billing) {
        billing = await HotelBillingSubscription.create({
          tenantId: doc._id,
          plan: doc.plan,
          status: "TRIALING",
          trialStartedAt: now,
          trialEndsAt: new Date(now.getTime() + 14 * 86400000),
          cancelAtPeriodEnd: false,
        });
      }

      const before = {
        status: billing.status,
        trialStartedAt: billing.trialStartedAt,
        trialEndsAt: billing.trialEndsAt,
      };

      if (input.action === "START") {
        billing.status = "TRIALING";
        billing.trialStartedAt = now;
        billing.trialEndsAt = input.endsAt ?? new Date(now.getTime() + 14 * 86400000);
      } else if (input.action === "EXTEND") {
        if (!input.endsAt || input.endsAt <= now) {
          throw new ValidationError("Trial end date must be in the future.");
        }
        if (billing.status !== "TRIALING") {
          throw new ValidationError("Only a trialing subscription can be extended.");
        }
        billing.trialStartedAt ??= now;
        billing.trialEndsAt = input.endsAt;
      } else {
        billing.status = "EXPIRED";
        billing.trialEndsAt = now;
      }

      billing.plan = doc.plan;
      await billing.save();

      await audit.record({
        tenantId: doc._id,
        actorUserId: actorId,
        action: "TRIAL_" + input.action,
        resourceType: "HotelBillingSubscription",
        resourceId: String(billing._id),
        before,
        after: {
          status: billing.status,
          trialStartedAt: billing.trialStartedAt,
          trialEndsAt: billing.trialEndsAt,
          reason: input.reason,
        },
        meta,
      });

      return detail(id);
    },

    /** Manually administer subscription state without bypassing tenant plan history or audit. */
    async setSubscription(
      actorId: Types.ObjectId,
      id: string,
      input: {
        plan: PlanKey;
        status: "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED";
        currentPeriodStart?: Date | undefined;
        currentPeriodEnd?: Date | undefined;
        reason: string;
      },
      meta: RequestMeta
    ) {
      const doc = await loadTenant(id);
      const before = { plan: doc.plan };

      doc.plan = input.plan;
      await doc.save();

      const now = new Date();
      const billing = await HotelBillingSubscription.findOneAndUpdate(
        { tenantId: doc._id },
        {
          $set: {
            plan: input.plan,
            status: input.status,
            cancelAtPeriodEnd: input.status === "CANCELLED",
            ...(input.currentPeriodStart ? { currentPeriodStart: input.currentPeriodStart } : {}),
            ...(input.currentPeriodEnd ? { currentPeriodEnd: input.currentPeriodEnd } : {}),
          },
          $unset: { trialStartedAt: 1, trialEndsAt: 1 },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      await Subscription.create({
        tenantId: doc._id,
        plan: input.plan,
        changedBy: actorId,
        startedAt: input.currentPeriodStart ?? now,
        note: `PLATFORM_ADMIN:${input.status}:${input.reason}`,
      });

      await audit.record({
        tenantId: doc._id,
        actorUserId: actorId,
        action: "SUBSCRIPTION_ADMIN_UPDATED",
        resourceType: "HotelBillingSubscription",
        resourceId: billing ? String(billing._id) : undefined,
        before,
        after: {
          plan: input.plan,
          status: input.status,
          currentPeriodStart: input.currentPeriodStart,
          currentPeriodEnd: input.currentPeriodEnd,
          reason: input.reason,
        },
        meta,
      });

      return detail(id);
    },

    /** Upgrading or downgrading only flips the plan; no data moves or is rewritten. */
    async changePlan(actorId: Types.ObjectId, id: string, plan: PlanKey, meta: RequestMeta) {
      const doc = await loadTenant(id);
      const before = { plan: doc.plan };

      doc.plan = plan;
      await doc.save();

      await Subscription.create({
        tenantId: doc._id,
        plan,
        changedBy: actorId,
        note: `Changed from ${before.plan}`,
      });

      await audit.record({
        tenantId: doc._id,
        actorUserId: actorId,
        action: "PLAN_CHANGED",
        resourceType: "Tenant",
        resourceId: id,
        before,
        after: { plan },
        meta,
      });

      return detail(id);
    },

    async setFeatureOverride(
      actorId: Types.ObjectId,
      id: string,
      input: {
        feature: Feature;
        enabled: boolean;
        expiresAt?: Date | null | undefined;
        reason?: string | undefined;
      },
      meta: RequestMeta
    ) {
      const doc = await loadTenant(id);

      await FeatureOverride.findOneAndUpdate(
        { tenantId: doc._id, feature: input.feature },
        {
          $set: {
            enabled: input.enabled,
            expiresAt: input.expiresAt ?? null,
            reason: input.reason,
            createdBy: actorId,
          },
        },
        { upsert: true, returnDocument: "after" }
      );

      await audit.record({
        tenantId: doc._id,
        actorUserId: actorId,
        action: "FEATURE_OVERRIDE_SET",
        resourceType: "Tenant",
        resourceId: id,
        after: input,
        meta,
      });

      return detail(id);
    },

    async removeFeatureOverride(actorId: Types.ObjectId, id: string, feature: Feature, meta: RequestMeta) {
      const doc = await loadTenant(id);
      await FeatureOverride.deleteOne({ tenantId: doc._id, feature });

      await audit.record({
        tenantId: doc._id,
        actorUserId: actorId,
        action: "FEATURE_OVERRIDE_REMOVED",
        resourceType: "Tenant",
        resourceId: id,
        after: { feature },
        meta,
      });

      return detail(id);
    },

    async setLimitOverrides(
      actorId: Types.ObjectId,
      id: string,
      limits: Partial<Record<LimitKey, number | null>>,
      meta: RequestMeta
    ) {
      const doc = await loadTenant(id);
      const clean: Record<string, number | null> = {};

      for (const key of LIMIT_KEYS) {
        if (key in limits) clean[key] = limits[key] ?? null;
      }

      const before = doc.limitOverrides;
      doc.limitOverrides = clean;
      doc.markModified("limitOverrides");
      await doc.save();

      await audit.record({
        tenantId: doc._id,
        actorUserId: actorId,
        action: "LIMITS_CHANGED",
        resourceType: "Tenant",
        resourceId: id,
        before,
        after: clean,
        meta,
      });

      return detail(id);
    },

    /** Custom domains are verified by the operator for now (DNS-proof verification is NOT IMPLEMENTED). */
    async addDomain(
      actorId: Types.ObjectId,
      id: string,
      input: { hostname: string; verified: boolean },
      meta: RequestMeta
    ) {
      const doc = await loadTenant(id);
      const hostname = input.hostname.trim().toLowerCase();
      const base = tenants.platformDomain;

      if (!DOMAIN_PATTERN.test(hostname) || hostname === base || hostname.endsWith(`.${base}`)) {
        throw new ValidationError("Enter a custom domain such as www.grandhotel.com (platform subdomains are automatic).");
      }

      if (await TenantDomain.exists({ hostname })) {
        throw new ConflictError("That domain is already connected to a hotel.");
      }

      await TenantDomain.create({
        hostname,
        tenantId: doc._id,
        verified: input.verified,
        verifiedAt: input.verified ? new Date() : undefined,
      });

      await audit.record({
        tenantId: doc._id,
        actorUserId: actorId,
        action: "DOMAIN_ADDED",
        resourceType: "Tenant",
        resourceId: id,
        after: { hostname, verified: input.verified },
        meta,
      });

      return detail(id);
    },

    async removeDomain(actorId: Types.ObjectId, id: string, hostname: string, meta: RequestMeta) {
      const doc = await loadTenant(id);
      await TenantDomain.deleteOne({ tenantId: doc._id, hostname: hostname.toLowerCase() });

      await audit.record({
        tenantId: doc._id,
        actorUserId: actorId,
        action: "DOMAIN_REMOVED",
        resourceType: "Tenant",
        resourceId: id,
        after: { hostname },
        meta,
      });

      return detail(id);
    },

    toObjectId,
  };
}

export type PlatformService = ReturnType<typeof createPlatformService>;

/** Bootstrap for the very first operator account (used by scripts/create-platform-admin.ts). */
export async function createPlatformAdmin(input: { name: string; email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  const problem = passwordProblemFor(input.password, email);

  if (problem) throw new ValidationError(problem);

  if (await User.exists({ tenantId: null, email })) {
    throw new ConflictError("A platform administrator with this email already exists.");
  }

  return User.create({
    tenantId: null,
    name: input.name,
    email,
    role: "PLATFORM_SUPER_ADMIN",
    isActive: true,
    passwordHash: await hashPassword(input.password),
    emailVerifiedAt: new Date(),
  });
}

import { BusinessRuleError, FeatureNotAvailableError } from "../../shared/errors.js";
import type { TenantView } from "../../shared/context.js";
import { FeatureOverride, Tenant } from "../tenants/tenant.model.js";
import { HotelBillingSubscription } from "../billing/billing.model.js";
import { computeEntitlements, type Entitlements, type Feature, type LimitKey } from "./features.js";

export function createEntitlementService() {
  return {
    /** Plan defaults + the tenant's active overrides. Two small indexed queries; computed per request. */
    async forTenant(tenant: TenantView): Promise<Entitlements> {
      const [overrides, billing] = await Promise.all([
        FeatureOverride.find({ tenantId: tenant.id }).lean(),
        HotelBillingSubscription.findOne({ tenantId: tenant.id }).lean(),
      ]);
      let effectivePlan = tenant.plan;
      const now = Date.now();
      const trialExpired = billing?.status === "TRIALING" && Boolean(billing.trialEndsAt && billing.trialEndsAt.getTime() <= now);
      const paidPeriodExpired = billing?.status === "ACTIVE" && Boolean(billing.currentPeriodEnd && billing.currentPeriodEnd.getTime() <= now);
      const subscriptionExpired = billing?.status === "EXPIRED" || billing?.status === "PAST_DUE" || trialExpired || paidPeriodExpired;
      if (billing && subscriptionExpired) {
        effectivePlan = "WEBSITE";
        if (trialExpired) {
          await HotelBillingSubscription.updateOne({ _id: billing._id, tenantId: tenant.id, status: "TRIALING" }, { $set: { status: "EXPIRED", plan: "WEBSITE" } });
        } else if (paidPeriodExpired) {
          await HotelBillingSubscription.updateOne({ _id: billing._id, tenantId: tenant.id, status: "ACTIVE" }, { $set: { status: "PAST_DUE", plan: "WEBSITE" } });
        }
        await Tenant.updateOne({ _id: tenant.id }, { $set: { plan: "WEBSITE" } });
      }
      return computeEntitlements(effectivePlan, overrides, tenant.limitOverrides);
    },

    assertFeature(entitlements: Entitlements, feature: Feature): void {
      if (!entitlements.features[feature]) throw new FeatureNotAvailableError();
    },

    /** `current` is how many exist now; creating one more must stay within the limit. */
    assertWithinLimit(entitlements: Entitlements, key: LimitKey, current: number): void {
      const max = entitlements.limits[key];
      if (max !== null && current >= max) {
        throw new BusinessRuleError(`Your plan allows at most ${max} for this. Upgrade your plan to add more.`, "LIMIT_REACHED");
      }
    },
  };
}
export type EntitlementService = ReturnType<typeof createEntitlementService>;
